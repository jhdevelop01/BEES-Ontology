"""
BEES Platform — Server D MQTT 워커
bees/points/# 토픽 구독 → InfluxDB 배치 저장

MQTT 메시지 포맷:
  토픽: bees/points/{point_id}
  페이로드: {"value": 24.3, "ts": "2026-02-11T...", "unit": "degC", "quality": "good"}
"""

import asyncio
import json
import logging
import threading
import time
from datetime import datetime, timezone
from typing import Optional

import paho.mqtt.client as mqtt
from influxdb_client import InfluxDBClient, Point, WritePrecision
from influxdb_client.client.write_api import SYNCHRONOUS

import asyncpg

from .config import settings
from .database import get_pg_pool
from .quality import quality_checker

logger = logging.getLogger("server-d.mqtt")


class MQTTWorker:
    """
    MQTT 구독 → InfluxDB 배치 저장 워커

    - paho-mqtt 콜백 스레드에서 메시지 수신
    - 내부 버퍼에 포인트 축적
    - 배치 플러시: batch_flush_size 도달 또는 batch_flush_interval 경과 시 InfluxDB 쓰기
    """

    def __init__(self) -> None:
        # ── MQTT 클라이언트 ──
        self._mqtt_client: Optional[mqtt.Client] = None
        self._mqtt_connected: bool = False

        # ── InfluxDB 클라이언트 ──
        self._influx_client: Optional[InfluxDBClient] = None
        self._write_api = None

        # ── 배치 버퍼 ──
        self._buffer: list[Point] = []
        self._buffer_lock = threading.Lock()
        self._last_flush_time: float = time.time()

        # ── 알람 저장 버퍼 (Phase 3) ──
        self._alarm_buffer: list[dict] = []
        self._alarm_lock = threading.Lock()

        # ── 통계 ──
        self._messages_received: int = 0
        self._points_written: int = 0
        self._alarms_saved: int = 0
        self._errors: int = 0

        # ── 실행 상태 ──
        self._running: bool = False
        self._flush_task: Optional[asyncio.Task] = None

    # ─────────────────────────────────────────────
    # 수명 주기
    # ─────────────────────────────────────────────

    async def start(self) -> None:
        """워커 시작 — FastAPI lifespan에서 호출"""
        logger.info("MQTT 워커 시작 중...")
        self._running = True

        # InfluxDB 클라이언트 초기화
        try:
            self._influx_client = InfluxDBClient(
                url=settings.influxdb_url,
                token=settings.influxdb_token,
                org=settings.influxdb_org,
            )
            self._write_api = self._influx_client.write_api(write_options=SYNCHRONOUS)
            logger.info(
                "InfluxDB 연결 완료: %s (org=%s, bucket=%s)",
                settings.influxdb_url,
                settings.influxdb_org,
                settings.influxdb_bucket,
            )
        except Exception as e:
            logger.error("InfluxDB 연결 실패: %s", e)
            self._errors += 1

        # MQTT 클라이언트 초기화 및 연결
        try:
            self._mqtt_client = mqtt.Client(
                client_id=settings.mqtt_client_id,
                protocol=mqtt.MQTTv311,
            )
            self._mqtt_client.on_connect = self._on_connect
            self._mqtt_client.on_disconnect = self._on_disconnect
            self._mqtt_client.on_message = self._on_message

            # 비차단 연결 (별도 네트워크 루프 스레드)
            self._mqtt_client.connect_async(
                host=settings.mqtt_broker,
                port=settings.mqtt_port,
                keepalive=60,
            )
            self._mqtt_client.loop_start()
            logger.info(
                "MQTT 브로커 연결 시도: %s:%d",
                settings.mqtt_broker,
                settings.mqtt_port,
            )
        except Exception as e:
            logger.error("MQTT 연결 실패: %s", e)
            self._errors += 1

        # 배치 플러시 타이머 시작
        self._flush_task = asyncio.create_task(self._periodic_flush())
        logger.info("MQTT 워커 시작 완료")

    async def stop(self) -> None:
        """워커 정지 — FastAPI lifespan에서 호출"""
        logger.info("MQTT 워커 정지 중...")
        self._running = False

        # 플러시 태스크 취소
        if self._flush_task:
            self._flush_task.cancel()
            try:
                await self._flush_task
            except asyncio.CancelledError:
                pass

        # 잔여 버퍼 플러시
        self._flush_buffer()

        # MQTT 연결 해제
        if self._mqtt_client:
            self._mqtt_client.loop_stop()
            self._mqtt_client.disconnect()
            logger.info("MQTT 연결 해제 완료")

        # InfluxDB 연결 해제
        if self._influx_client:
            self._influx_client.close()
            logger.info("InfluxDB 연결 해제 완료")

        logger.info(
            "MQTT 워커 정지 완료 — 수신: %d, 저장: %d, 오류: %d",
            self._messages_received,
            self._points_written,
            self._errors,
        )

    # ─────────────────────────────────────────────
    # MQTT 콜백 (paho-mqtt 스레드에서 실행)
    # ─────────────────────────────────────────────

    def _on_connect(
        self,
        client: mqtt.Client,
        userdata,
        flags,
        rc: int,
    ) -> None:
        """MQTT 연결 성공 콜백"""
        if rc == 0:
            self._mqtt_connected = True
            # 토픽 구독
            client.subscribe(settings.mqtt_topic, qos=1)
            client.subscribe("bees/alarms/#", qos=1)
            logger.info("MQTT 연결 성공 — 구독: %s, bees/alarms/#", settings.mqtt_topic)
        else:
            self._mqtt_connected = False
            logger.error("MQTT 연결 실패 — rc=%d", rc)

    def _on_disconnect(
        self,
        client: mqtt.Client,
        userdata,
        rc: int,
    ) -> None:
        """MQTT 연결 해제 콜백"""
        self._mqtt_connected = False
        if rc != 0:
            logger.warning("MQTT 비정상 연결 해제 — rc=%d, 자동 재연결 시도", rc)
        else:
            logger.info("MQTT 정상 연결 해제")

    def _on_message(
        self,
        client: mqtt.Client,
        userdata,
        msg: mqtt.MQTTMessage,
    ) -> None:
        """
        MQTT 메시지 수신 콜백

        토픽: bees/points/{point_id}
        페이로드: {"value": 24.3, "ts": "...", "unit": "degC", "quality": "good"}
        """
        self._messages_received += 1

        try:
            # 알람 토픽 분기 처리 (Phase 3)
            if msg.topic.startswith("bees/alarms/"):
                self._handle_alarm_message(msg)
                return

            # 토픽에서 point_id 추출
            # bees/points/bldg:Zone_Air_Temp_5F → bldg:Zone_Air_Temp_5F
            topic_parts = msg.topic.split("/", 2)
            if len(topic_parts) < 3:
                logger.warning("잘못된 토픽 형식: %s", msg.topic)
                return
            point_id = topic_parts[2]

            # 페이로드 파싱
            payload = json.loads(msg.payload.decode("utf-8"))
            value = float(payload["value"])
            unit = payload.get("unit", "")

            # 타임스탬프 파싱 (없으면 현재 UTC 시각)
            ts_str = payload.get("ts")
            if ts_str:
                ts = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
            else:
                ts = datetime.now(timezone.utc)

            # 데이터 품질 검사 (Phase 4)
            sensor_type = quality_checker.infer_sensor_type(point_id)
            quality = quality_checker.check(point_id, value, sensor_type)
            if quality == "bad":
                logger.warning(
                    "데이터 품질 불량: point=%s, value=%.2f, type=%s",
                    point_id, value, sensor_type,
                )

            # InfluxDB Point 생성
            point = (
                Point("sensor_data")
                .tag("point_id", point_id)
                .tag("unit", unit)
                .tag("quality", quality)
                .field("value", value)
                .time(ts, WritePrecision.NS)
            )

            # 버퍼에 추가
            with self._buffer_lock:
                self._buffer.append(point)
                buffer_size = len(self._buffer)

            # 버퍼 크기 도달 시 즉시 플러시
            if buffer_size >= settings.batch_flush_size:
                self._flush_buffer()

        except json.JSONDecodeError as e:
            logger.error("JSON 파싱 오류 (토픽=%s): %s", msg.topic, e)
            self._errors += 1
        except KeyError as e:
            logger.error("필수 필드 누락 (토픽=%s): %s", msg.topic, e)
            self._errors += 1
        except Exception as e:
            logger.error("메시지 처리 오류 (토픽=%s): %s", msg.topic, e)
            self._errors += 1

    # ─────────────────────────────────────────────
    # 알람 처리 (Phase 3)
    # ─────────────────────────────────────────────

    def _handle_alarm_message(self, msg: mqtt.MQTTMessage) -> None:
        """알람 MQTT 메시지를 파싱하여 버퍼에 추가."""
        try:
            payload = json.loads(msg.payload.decode("utf-8"))
            severity = msg.topic.replace("bees/alarms/", "")

            alarm = {
                "equipment_id": payload.get("equipment", ""),
                "alarm_type": payload.get("alarm_type", "unknown"),
                "severity": severity,
                "message": (
                    f"{payload.get('alarm_type', 'alarm')}: "
                    f"값={payload.get('value')}, 임계값={payload.get('threshold')}"
                ),
                "threshold_value": payload.get("threshold"),
                "actual_value": payload.get("value"),
                "onset_at": payload.get("ts"),
            }

            with self._alarm_lock:
                self._alarm_buffer.append(alarm)

            logger.info(
                "알람 수신: %s %s (장비=%s, 값=%s)",
                severity, alarm["alarm_type"],
                alarm["equipment_id"], alarm["actual_value"],
            )
        except (json.JSONDecodeError, UnicodeDecodeError) as e:
            logger.error("알람 메시지 파싱 실패 (%s): %s", msg.topic, e)
            self._errors += 1

    def _flush_alarms(self) -> None:
        """알람 버퍼를 PostgreSQL alarm_history에 배치 저장 (sync — MQTT 콜백 스레드용)."""
        with self._alarm_lock:
            if not self._alarm_buffer:
                return
            alarms_to_save = self._alarm_buffer.copy()
            self._alarm_buffer.clear()

        pool = get_pg_pool()
        if not pool:
            logger.error("PostgreSQL 미연결 — %d 알람 유실", len(alarms_to_save))
            self._errors += 1
            return

        import asyncio
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                future = asyncio.run_coroutine_threadsafe(
                    self._save_alarms_async(pool, alarms_to_save), loop
                )
                future.result(timeout=10)
            else:
                asyncio.run(self._save_alarms_async(pool, alarms_to_save))
        except Exception as e:
            logger.error("알람 PostgreSQL 저장 실패: %s (%d건 유실)", repr(e), len(alarms_to_save))
            self._errors += 1

    async def _flush_alarms_async(self) -> None:
        """알람 버퍼를 PostgreSQL에 비동기 저장 (이벤트 루프에서 호출)."""
        with self._alarm_lock:
            if not self._alarm_buffer:
                return
            alarms_to_save = self._alarm_buffer.copy()
            self._alarm_buffer.clear()

        pool = get_pg_pool()
        if not pool:
            logger.error("PostgreSQL 미연결 — %d 알람 유실", len(alarms_to_save))
            self._errors += 1
            return

        try:
            await self._save_alarms_async(pool, alarms_to_save)
        except Exception as e:
            logger.error("알람 PostgreSQL 저장 실패: %s (%d건 유실)", repr(e), len(alarms_to_save))
            self._errors += 1

    async def _save_alarms_async(
        self, pool: asyncpg.Pool, alarms: list[dict]
    ) -> None:
        """알람 리스트를 PostgreSQL에 비동기 저장."""
        async with pool.acquire() as conn:
            for alarm in alarms:
                try:
                    ts = alarm.get("onset_at")
                    if isinstance(ts, str):
                        onset_at = datetime.fromisoformat(ts.replace("Z", "+00:00"))
                    else:
                        onset_at = datetime.now(timezone.utc)

                    await conn.execute(
                        """
                        INSERT INTO alarm_history
                            (equipment_id, alarm_type, severity, message,
                             threshold_value, actual_value, onset_at)
                        VALUES ($1, $2, $3, $4, $5, $6, $7)
                        """,
                        alarm["equipment_id"],
                        alarm["alarm_type"],
                        alarm["severity"],
                        alarm["message"],
                        alarm.get("threshold_value"),
                        alarm.get("actual_value"),
                        onset_at,
                    )
                    self._alarms_saved += 1
                except Exception as e:
                    logger.error("알람 INSERT 실패: %s — %s", alarm, e)
                    self._errors += 1

    # ─────────────────────────────────────────────
    # 배치 플러시
    # ─────────────────────────────────────────────

    def _flush_buffer(self) -> None:
        """버퍼의 포인트를 InfluxDB에 배치 쓰기"""
        with self._buffer_lock:
            if not self._buffer:
                return
            points_to_write = self._buffer.copy()
            self._buffer.clear()

        if not self._write_api:
            logger.error("InfluxDB write_api 미초기화 — %d 포인트 유실", len(points_to_write))
            self._errors += 1
            return

        try:
            self._write_api.write(
                bucket=settings.influxdb_bucket,
                org=settings.influxdb_org,
                record=points_to_write,
            )
            self._points_written += len(points_to_write)
            self._last_flush_time = time.time()
            logger.debug(
                "InfluxDB 배치 쓰기 완료: %d 포인트 (누적: %d)",
                len(points_to_write),
                self._points_written,
            )
        except Exception as e:
            logger.error(
                "InfluxDB 배치 쓰기 실패: %s (%d 포인트 유실)",
                e,
                len(points_to_write),
            )
            self._errors += 1

    async def _periodic_flush(self) -> None:
        """주기적 배치 플러시 (batch_flush_interval 간격)"""
        while self._running:
            try:
                await asyncio.sleep(settings.batch_flush_interval)
                self._flush_buffer()
                await self._flush_alarms_async()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error("주기적 플러시 오류: %s", e)

    # ─────────────────────────────────────────────
    # 상태 조회
    # ─────────────────────────────────────────────

    @property
    def is_mqtt_connected(self) -> bool:
        return self._mqtt_connected

    @property
    def stats(self) -> dict:
        """워커 통계 반환"""
        return {
            "mqtt_connected": self._mqtt_connected,
            "messages_received": self._messages_received,
            "points_written": self._points_written,
            "alarms_saved": self._alarms_saved,
            "errors": self._errors,
            "buffer_size": len(self._buffer),
            "quality_stats": quality_checker.stats,
        }


# 싱글톤 워커 인스턴스
mqtt_worker = MQTTWorker()

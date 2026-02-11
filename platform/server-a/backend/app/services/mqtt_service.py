"""
MQTT 서비스
bees/points/# 와 bees/devices/# 토픽을 구독하여
메모리 딕셔너리에 최신값을 캐시한다.
SSE 스트림 및 대시보드에서 사용.
"""

import asyncio
import json
import logging
import time
import threading
from typing import Any
from collections import deque
from datetime import datetime

import paho.mqtt.client as mqtt

from app.config import MQTT_BROKER, MQTT_PORT

logger = logging.getLogger(__name__)

# 최신 포인트 값 캐시 — { point_id: { value, ts, unit, quality } }
_point_cache: dict[str, dict[str, Any]] = {}

# 최신 디바이스 상태 캐시 — { device_id: { is_active, mode, ts } }
_device_cache: dict[str, dict[str, Any]] = {}

# SSE 브로드캐스트용 이벤트 큐 (최근 500건 유지)
_event_queue: deque[dict[str, Any]] = deque(maxlen=500)

# 이벤트 카운터 (monotonic, thread-safe)
_event_counter: int = 0
_counter_lock = threading.Lock()

# MQTT 클라이언트
_client: mqtt.Client | None = None


def _on_connect(client: mqtt.Client, userdata: Any, flags: Any, rc: int, properties: Any = None) -> None:
    """MQTT 연결 성공 콜백"""
    if rc == 0:
        logger.info("MQTT 브로커 연결 성공: %s:%d", MQTT_BROKER, MQTT_PORT)
        client.subscribe("bees/points/#")
        client.subscribe("bees/devices/#")
        client.subscribe("bees/alarms/#")
        logger.info("MQTT 토픽 구독 완료: bees/points/#, bees/devices/#, bees/alarms/#")
    else:
        logger.warning("MQTT 연결 실패, 코드: %d", rc)


def _parse_ts(raw_ts: Any) -> float:
    """타임스탬프를 Unix timestamp(초)로 변환. ISO 문자열 또는 숫자 지원."""
    if isinstance(raw_ts, (int, float)):
        return float(raw_ts)
    if isinstance(raw_ts, str):
        try:
            dt = datetime.fromisoformat(raw_ts)
            return dt.timestamp()
        except (ValueError, TypeError):
            pass
    return time.time()


def _on_message(client: mqtt.Client, userdata: Any, msg: mqtt.MQTTMessage) -> None:
    """MQTT 메시지 수신 콜백 (MQTT 백그라운드 스레드에서 호출)"""
    global _event_counter
    try:
        topic = msg.topic
        payload = json.loads(msg.payload.decode("utf-8"))

        if topic.startswith("bees/points/"):
            point_id = topic.replace("bees/points/", "")
            _point_cache[point_id] = {
                "point_id": point_id,
                "value": payload.get("value"),
                "ts": _parse_ts(payload.get("ts", time.time())),
                "unit": payload.get("unit", ""),
                "quality": payload.get("quality", "good"),
            }
            event = {"type": "point", "data": _point_cache[point_id]}
            _event_queue.append(event)
            with _counter_lock:
                _event_counter += 1

        elif topic.startswith("bees/devices/"):
            parts = topic.replace("bees/devices/", "").split("/")
            device_id = parts[0]
            _device_cache[device_id] = {
                "device_id": device_id,
                "is_active": payload.get("is_active", False),
                "mode": payload.get("mode", "unknown"),
                "ts": _parse_ts(payload.get("ts", time.time())),
            }
            event = {"type": "device", "data": _device_cache[device_id]}
            _event_queue.append(event)
            with _counter_lock:
                _event_counter += 1

        elif topic.startswith("bees/alarms/"):
            severity = topic.replace("bees/alarms/", "")
            event = {
                "type": "alarm",
                "data": {
                    "severity": severity,
                    **payload,
                    "ts": _parse_ts(payload.get("ts", time.time())),
                },
            }
            _event_queue.append(event)
            with _counter_lock:
                _event_counter += 1

    except (json.JSONDecodeError, UnicodeDecodeError) as e:
        logger.warning("MQTT 메시지 파싱 실패 (%s): %s", msg.topic, e)


async def connect() -> None:
    """MQTT 클라이언트 연결 (백그라운드 스레드)"""
    global _client

    _client = mqtt.Client(
        mqtt.CallbackAPIVersion.VERSION2,
        client_id="server-a-backend",
    )
    _client.on_connect = _on_connect
    _client.on_message = _on_message

    try:
        _client.connect_async(MQTT_BROKER, MQTT_PORT, keepalive=60)
        _client.loop_start()
        logger.info("MQTT 클라이언트 시작: %s:%d", MQTT_BROKER, MQTT_PORT)
    except Exception as e:
        logger.warning("MQTT 연결 실패 (서비스는 계속 실행): %s", e)


async def disconnect() -> None:
    """MQTT 클라이언트 종료"""
    global _client
    if _client:
        _client.loop_stop()
        _client.disconnect()
        _client = None
        logger.info("MQTT 클라이언트 종료")


def get_point_cache() -> dict[str, dict[str, Any]]:
    """현재 포인트 캐시 전체 반환"""
    return dict(_point_cache)


def get_device_cache() -> dict[str, dict[str, Any]]:
    """현재 디바이스 캐시 전체 반환"""
    return dict(_device_cache)


def get_latest_point(point_id: str) -> dict[str, Any] | None:
    """특정 포인트의 최신값 반환"""
    return _point_cache.get(point_id)


def get_latest_device(device_id: str) -> dict[str, Any] | None:
    """특정 디바이스의 최신 상태 반환"""
    return _device_cache.get(device_id)


def get_alarm_count() -> int:
    """현재 큐에 있는 알람 이벤트 수 반환"""
    return sum(1 for event in _event_queue if event.get("type") == "alarm")


async def event_generator():
    """
    SSE 이벤트 제너레이터.
    폴링 방식: 0.5초마다 이벤트 카운터를 확인하여 새 이벤트를 전달.
    MQTT 스레드와의 크로스스레드 asyncio.Event 이슈를 방지.
    """
    last_counter = _event_counter
    last_queue_snapshot = len(_event_queue)

    while True:
        await asyncio.sleep(0.5)

        current_counter = _event_counter

        if current_counter > last_counter:
            # 새 이벤트 발생 — 큐에서 새 이벤트 추출
            queue_list = list(_event_queue)
            new_count = current_counter - last_counter
            # 큐 끝에서 new_count개 추출 (deque maxlen으로 앞부분은 사라질 수 있음)
            new_events = queue_list[-min(new_count, len(queue_list)):]
            last_counter = current_counter

            for event in new_events:
                yield {
                    "event": event["type"],
                    "data": json.dumps(event["data"]),
                }
        else:
            # 새 이벤트 없음 — heartbeat
            yield {"event": "heartbeat", "data": json.dumps({"ts": time.time()})}

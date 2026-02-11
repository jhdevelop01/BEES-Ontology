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
from typing import Any
from collections import deque

import paho.mqtt.client as mqtt

from app.config import MQTT_BROKER, MQTT_PORT

logger = logging.getLogger(__name__)

# 최신 포인트 값 캐시 — { point_id: { value, ts, unit, quality } }
_point_cache: dict[str, dict[str, Any]] = {}

# 최신 디바이스 상태 캐시 — { device_id: { is_active, mode, ts } }
_device_cache: dict[str, dict[str, Any]] = {}

# SSE 브로드캐스트용 이벤트 큐 (최근 100건 유지)
_event_queue: deque[dict[str, Any]] = deque(maxlen=100)

# SSE 구독자 알림용 asyncio.Event
_new_event: asyncio.Event | None = None

# MQTT 클라이언트
_client: mqtt.Client | None = None
_loop: asyncio.AbstractEventLoop | None = None


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


def _on_message(client: mqtt.Client, userdata: Any, msg: mqtt.MQTTMessage) -> None:
    """MQTT 메시지 수신 콜백"""
    try:
        topic = msg.topic
        payload = json.loads(msg.payload.decode("utf-8"))

        if topic.startswith("bees/points/"):
            point_id = topic.replace("bees/points/", "")
            _point_cache[point_id] = {
                "point_id": point_id,
                "value": payload.get("value"),
                "ts": payload.get("ts", time.time()),
                "unit": payload.get("unit", ""),
                "quality": payload.get("quality", "good"),
            }
            # SSE 이벤트 추가
            event = {
                "type": "point",
                "data": _point_cache[point_id],
            }
            _event_queue.append(event)
            _notify_sse()

        elif topic.startswith("bees/devices/"):
            # bees/devices/{device_id}/state
            parts = topic.replace("bees/devices/", "").split("/")
            device_id = parts[0]
            _device_cache[device_id] = {
                "device_id": device_id,
                "is_active": payload.get("is_active", False),
                "mode": payload.get("mode", "unknown"),
                "ts": payload.get("ts", time.time()),
            }
            event = {
                "type": "device",
                "data": _device_cache[device_id],
            }
            _event_queue.append(event)
            _notify_sse()

        elif topic.startswith("bees/alarms/"):
            severity = topic.replace("bees/alarms/", "")
            event = {
                "type": "alarm",
                "data": {
                    "severity": severity,
                    **payload,
                    "ts": payload.get("ts", time.time()),
                },
            }
            _event_queue.append(event)
            _notify_sse()

    except (json.JSONDecodeError, UnicodeDecodeError) as e:
        logger.warning("MQTT 메시지 파싱 실패 (%s): %s", msg.topic, e)


def _notify_sse() -> None:
    """SSE 구독자에게 새 이벤트 알림"""
    global _new_event, _loop
    if _new_event and _loop:
        _loop.call_soon_threadsafe(_new_event.set)


async def connect() -> None:
    """MQTT 클라이언트 연결 (백그라운드 스레드)"""
    global _client, _new_event, _loop
    _loop = asyncio.get_event_loop()
    _new_event = asyncio.Event()

    _client = mqtt.Client(
        mqtt.CallbackAPIVersion.VERSION2,
        client_id="server-a-backend",
    )
    _client.on_connect = _on_connect
    _client.on_message = _on_message

    try:
        _client.connect_async(MQTT_BROKER, MQTT_PORT, keepalive=60)
        _client.loop_start()  # 백그라운드 스레드에서 네트워크 루프 실행
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


async def event_generator():
    """
    SSE 이벤트 제너레이터.
    새 MQTT 메시지가 도착할 때마다 yield.
    """
    global _new_event
    if not _new_event:
        _new_event = asyncio.Event()

    last_index = len(_event_queue)
    while True:
        # 새 이벤트가 올 때까지 대기 (최대 1초)
        try:
            await asyncio.wait_for(_new_event.wait(), timeout=1.0)
            _new_event.clear()
        except asyncio.TimeoutError:
            # heartbeat 전송
            yield {"event": "heartbeat", "data": json.dumps({"ts": time.time()})}
            continue

        # 큐에서 새 이벤트 추출
        current_len = len(_event_queue)
        if current_len > last_index:
            # deque는 maxlen이 있으므로, 최근 이벤트만 전송
            new_events = list(_event_queue)[max(0, last_index):]
            last_index = current_len
            for event in new_events:
                yield {
                    "event": event["type"],
                    "data": json.dumps(event["data"]),
                }
        elif current_len < last_index:
            # deque가 래핑된 경우
            last_index = current_len

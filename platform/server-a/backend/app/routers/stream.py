"""
SSE 스트림 라우터
MQTT로 수신된 센서 데이터를 EventSource 프로토콜로 실시간 중계한다.
"""

import asyncio
import json
import time
import logging

from fastapi import APIRouter, Request, WebSocket, WebSocketDisconnect
from sse_starlette.sse import EventSourceResponse

from app.models import StreamSnapshotResponse
from app.services import mqtt_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/stream", tags=["실시간 스트림"])


@router.get("/points")
async def stream_points(request: Request):
    """
    SSE 스트림: MQTT 센서 데이터 실시간 중계.
    EventSource 프로토콜 사용.
    클라이언트: new EventSource('/api/stream/points')
    """
    async def generate():
        logger.info("SSE 클라이언트 연결")
        try:
            async for event in mqtt_service.event_generator():
                # 클라이언트 연결 끊김 확인
                if await request.is_disconnected():
                    logger.info("SSE 클라이언트 연결 해제")
                    break
                yield event
        except asyncio.CancelledError:
            logger.info("SSE 스트림 취소됨")
        except Exception as e:
            logger.error("SSE 스트림 오류: %s", e)

    return EventSourceResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # nginx 프록시 버퍼링 비활성화
        },
    )


@router.get("/snapshot", response_model=StreamSnapshotResponse)
async def get_stream_snapshot():
    """
    현재 시점의 센서 데이터 스냅샷.
    SSE 연결 없이 최신 상태를 한 번에 가져올 때 사용.
    """
    point_cache = mqtt_service.get_point_cache()
    device_cache = mqtt_service.get_device_cache()

    return {
        "points": point_cache,
        "devices": device_cache,
        "point_count": len(point_cache),
        "device_count": len(device_cache),
        "timestamp": time.time(),
    }


@router.websocket("/ws")
async def websocket_stream(websocket: WebSocket):
    """
    WebSocket 실시간 스트림: MQTT 이벤트를 JSON으로 push.
    SSE 대비 양방향 통신, 낮은 오버헤드.
    """
    await websocket.accept()
    mqtt_service.register_ws_client(websocket)
    logger.info("WebSocket 클라이언트 연결")
    try:
        while True:
            await websocket.receive_text()  # keep-alive
    except WebSocketDisconnect:
        logger.info("WebSocket 클라이언트 연결 해제")
    finally:
        mqtt_service.unregister_ws_client(websocket)

"""
시계열 이력 API 라우터
Server D (Data Historian)를 통해 시계열 데이터를 조회하는 프록시.
"""

import logging
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException, Query

from app.config import SERVER_D_URL
from app.services import mqtt_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/history", tags=["시계열 이력"])


@router.get("/{point_id}")
async def get_point_history(
    point_id: str,
    start: str = Query("-1h", description="시작 시간 (예: -1h, -24h, -7d)"),
    stop: str = Query("now()", description="종료 시간"),
    aggregation: str = Query("mean", description="집계 함수 (mean, min, max, sum)"),
    window: str = Query("1m", description="집계 윈도우 (1m, 5m, 1h)"),
) -> dict[str, Any]:
    """
    포인트 시계열 데이터 조회 (Server D 프록시).
    Server D가 미가동이면 MQTT 캐시의 최신값만 반환.
    """
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{SERVER_D_URL}/data/points/{point_id}/history",
                params={
                    "start": start,
                    "stop": stop,
                    "aggregation": aggregation,
                    "window": window,
                },
            )
            response.raise_for_status()
            return response.json()

    except httpx.ConnectError:
        logger.warning("Server D 연결 실패 — MQTT 캐시 폴백: %s", point_id)
        # Server D 미가동 시 MQTT 캐시의 최신값 반환
        latest = mqtt_service.get_latest_point(point_id)
        return {
            "point_id": point_id,
            "data": [latest] if latest else [],
            "source": "mqtt_cache",
            "message": "Server D 미연결 — MQTT 캐시 최신값만 제공",
        }
    except httpx.HTTPStatusError as e:
        raise HTTPException(
            status_code=e.response.status_code,
            detail=f"Server D 오류: {e.response.text}",
        )
    except Exception as e:
        logger.error("시계열 조회 실패: %s", e)
        raise HTTPException(status_code=500, detail=f"시계열 조회 실패: {str(e)}")

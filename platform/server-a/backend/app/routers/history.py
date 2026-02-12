"""
시계열 이력 API 라우터
InfluxDB 직접 조회 우선 → 실패 시 Server D 프록시 → MQTT 캐시 폴백.
"""

import logging
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException, Query

from app.config import SERVER_D_URL
from app.services import mqtt_service, influxdb_service

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
    포인트 시계열 데이터 조회.
    1순위: InfluxDB 직접 조회
    2순위: Server D 프록시
    3순위: MQTT 캐시 최신값
    """
    # 1순위: InfluxDB 직접 조회
    if influxdb_service.is_connected():
        data = await influxdb_service.query_point_history(
            point_id, start, stop, aggregation, window,
        )
        if data:
            return {
                "point_id": point_id,
                "data": data,
                "source": "influxdb_direct",
            }

    # 2순위: Server D 프록시
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
            result = response.json()
            result["source"] = "server_d_proxy"
            return result

    except httpx.ConnectError:
        logger.warning("Server D 연결 실패 — MQTT 캐시 폴백: %s", point_id)
    except httpx.HTTPStatusError as e:
        logger.warning("Server D 오류 (%s) — MQTT 캐시 폴백: %s", e.response.status_code, point_id)
    except Exception as e:
        logger.warning("Server D 조회 실패 — MQTT 캐시 폴백: %s — %s", point_id, e)

    # 3순위: MQTT 캐시 최신값
    latest = mqtt_service.get_latest_point(point_id)
    return {
        "point_id": point_id,
        "data": [latest] if latest else [],
        "source": "mqtt_cache",
        "message": "InfluxDB/Server D 미연결 — MQTT 캐시 최신값만 제공",
    }

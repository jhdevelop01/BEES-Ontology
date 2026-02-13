"""
알람 API 라우터 (Phase 3)

엔드포인트:
  GET  /api/alarms            — 현재 활성 알람 목록 (MQTT 캐시)
  GET  /api/alarms/history    — Server D 프록시: alarm_history 조회
  POST /api/alarms/{id}/acknowledge — 알람 확인 처리 (Server D 프록시)
"""

import logging
from typing import Any, Optional

import httpx
from fastapi import APIRouter, HTTPException, Query

from app.config import SERVER_D_URL
from app.services import mqtt_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/alarms", tags=["알람"])


@router.get("")
async def get_active_alarms(
    severity: Optional[str] = Query(None, description="심각도 필터 (warning/critical)"),
    equipment: Optional[str] = Query(None, description="장비 ID 필터"),
) -> dict[str, Any]:
    """
    현재 활성 알람 목록 (MQTT 캐시, 최근 100건).
    실시간 메모리 캐시이므로 재시작 시 초기화됨.
    """
    alarms = mqtt_service.get_alarm_cache()

    if severity:
        alarms = [a for a in alarms if a.get("severity") == severity]
    if equipment:
        alarms = [a for a in alarms if a.get("equipment") == equipment]

    return {
        "total": len(alarms),
        "alarms": alarms,
    }


@router.get("/history")
async def get_alarm_history(
    equipment: Optional[str] = Query(None, description="장비 ID 필터"),
    severity: Optional[str] = Query(None, description="심각도 필터"),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
) -> dict[str, Any]:
    """
    알람 이력 조회 — Server D의 /alarm-history 프록시.
    PostgreSQL에 저장된 전체 알람 이력을 페이지네이션으로 조회.
    """
    params: dict[str, Any] = {"limit": limit, "offset": offset}
    if equipment:
        params["equipment"] = equipment
    if severity:
        params["severity"] = severity

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(f"{SERVER_D_URL}/alarm-history", params=params)
            resp.raise_for_status()
            return resp.json()
    except httpx.HTTPStatusError as e:
        logger.error("Server D 알람 이력 조회 실패: %s", e)
        raise HTTPException(status_code=e.response.status_code, detail=str(e))
    except httpx.RequestError as e:
        logger.error("Server D 연결 실패: %s", e)
        raise HTTPException(status_code=503, detail=f"Server D 연결 실패: {e}")


@router.post("/{alarm_id}/acknowledge")
async def acknowledge_alarm(
    alarm_id: int,
    acknowledged_by: int = Query(1, description="확인자 사용자 ID"),
) -> dict[str, Any]:
    """
    알람 확인(acknowledge) 처리.
    Server D의 PostgreSQL alarm_history에 acknowledged_at 업데이트.
    """
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"{SERVER_D_URL}/alarm-history/{alarm_id}/acknowledge",
                params={"acknowledged_by": acknowledged_by},
            )
            resp.raise_for_status()
            return resp.json()
    except httpx.HTTPStatusError as e:
        logger.error("알람 확인 처리 실패: %s", e)
        raise HTTPException(status_code=e.response.status_code, detail=str(e))
    except httpx.RequestError as e:
        logger.error("Server D 연결 실패: %s", e)
        raise HTTPException(status_code=503, detail=f"Server D 연결 실패: {e}")

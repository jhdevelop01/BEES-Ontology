"""
알람 API 라우터 (Phase 3 → Phase 4 확장)

엔드포인트:
  GET  /api/alarms            — 현재 활성 알람 목록 (MQTT 캐시)
  GET  /api/alarms/history    — Server D 프록시: alarm_history 조회
  GET  /api/alarms/stats      — 심각도별 알람 카운트 통계
  POST /api/alarms/{id}/acknowledge — 알람 확인 처리 (Server D 프록시)
  POST /api/alarms/{id}/suppress    — 알람 억제 (지정 기간 동안 숨김)
  GET  /api/alarms/suppressed       — 억제 중인 알람 목록
  DELETE /api/alarms/suppress/{id}  — 알람 억제 해제
"""

import logging
import time
from typing import Any, Optional

import httpx
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from app.config import SERVER_D_URL
from app.services import mqtt_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/alarms", tags=["알람"])


# ── 억제 관리 (인메모리) ──

class SuppressRequest(BaseModel):
    duration_hours: float = Field(1.0, description="억제 기간 (시간)")
    reason: str = Field("", description="억제 사유")


class _SuppressEntry:
    __slots__ = ("alarm_id", "equipment", "severity", "reason", "suppressed_at", "expires_at")

    def __init__(self, alarm_id: int, equipment: str, severity: str, reason: str, duration_hours: float):
        self.alarm_id = alarm_id
        self.equipment = equipment
        self.severity = severity
        self.reason = reason
        self.suppressed_at = time.time()
        self.expires_at = self.suppressed_at + duration_hours * 3600

    @property
    def is_active(self) -> bool:
        return time.time() < self.expires_at

    def to_dict(self) -> dict:
        return {
            "alarm_id": self.alarm_id,
            "equipment": self.equipment,
            "severity": self.severity,
            "reason": self.reason,
            "suppressed_at": self.suppressed_at,
            "expires_at": self.expires_at,
            "remaining_seconds": max(0, self.expires_at - time.time()),
        }


_suppressed: dict[int, _SuppressEntry] = {}


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

    # 억제된 장비 필터링
    suppressed_equips = {s.equipment for s in _suppressed.values() if s.is_active}
    if suppressed_equips:
        alarms = [a for a in alarms if a.get("equipment") not in suppressed_equips]

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


@router.get("/stats")
async def get_alarm_stats() -> dict[str, Any]:
    """
    알람 통계: 심각도별 카운트.
    활성 알람(MQTT 캐시) 기반.
    """
    alarms = mqtt_service.get_alarm_cache()
    suppressed_equips = {s.equipment for s in _suppressed.values() if s.is_active}
    alarms = [a for a in alarms if a.get("equipment") not in suppressed_equips]

    stats: dict[str, int] = {"critical": 0, "warning": 0, "info": 0, "total": 0}
    for a in alarms:
        sev = a.get("severity", "info")
        stats[sev] = stats.get(sev, 0) + 1
        stats["total"] += 1

    return {
        "stats": stats,
        "suppressed_count": sum(1 for s in _suppressed.values() if s.is_active),
    }


@router.post("/{alarm_id}/suppress")
async def suppress_alarm(
    alarm_id: int,
    request: SuppressRequest,
) -> dict[str, Any]:
    """
    알람 억제 — 지정 기간 동안 해당 장비의 알람을 숨김.
    """
    # Server D에서 알람 정보 조회
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(f"{SERVER_D_URL}/alarm-history", params={"limit": 500})
            resp.raise_for_status()
            data = resp.json()
    except Exception as e:
        logger.error("알람 이력 조회 실패: %s", e)
        raise HTTPException(status_code=503, detail=f"Server D 연결 실패: {e}")

    target = None
    for item in data.get("items", []):
        if item.get("id") == alarm_id:
            target = item
            break

    if not target:
        raise HTTPException(status_code=404, detail=f"알람을 찾을 수 없습니다: {alarm_id}")

    entry = _SuppressEntry(
        alarm_id=alarm_id,
        equipment=target.get("equipment_id", ""),
        severity=target.get("severity", "warning"),
        reason=request.reason,
        duration_hours=request.duration_hours,
    )
    _suppressed[alarm_id] = entry

    logger.info("알람 억제: id=%d, 장비=%s, 기간=%.1fh, 사유=%s",
                alarm_id, entry.equipment, request.duration_hours, request.reason)

    return {
        "success": True,
        "message": f"알람 {alarm_id} 억제 완료 ({request.duration_hours}시간)",
        "suppress": entry.to_dict(),
    }


@router.get("/suppressed")
async def get_suppressed_alarms() -> dict[str, Any]:
    """억제 중인 알람 목록 조회."""
    expired = [k for k, v in _suppressed.items() if not v.is_active]
    for k in expired:
        del _suppressed[k]

    return {
        "total": len(_suppressed),
        "items": [v.to_dict() for v in _suppressed.values()],
    }


@router.delete("/suppress/{alarm_id}")
async def unsuppress_alarm(alarm_id: int) -> dict[str, Any]:
    """알람 억제 해제."""
    if alarm_id not in _suppressed:
        raise HTTPException(status_code=404, detail=f"억제 중인 알람이 아닙니다: {alarm_id}")
    del _suppressed[alarm_id]
    return {"success": True, "message": f"알람 {alarm_id} 억제 해제 완료"}

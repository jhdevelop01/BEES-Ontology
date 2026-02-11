"""
BEES Platform — Server D 관리 데이터 API (PostgreSQL)

엔드포인트:
  GET /alarm-history  — 알람 이력 조회
  GET /audit-log      — 감사 로그 조회
"""

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from ..database import get_pg_pool
from ..models import (
    AlarmHistoryItem,
    AlarmHistoryResponse,
    AuditLogItem,
    AuditLogResponse,
)

logger = logging.getLogger("server-d.admin")
router = APIRouter(tags=["관리 데이터"])


# ─────────────────────────────────────────────
# GET /alarm-history — 알람 이력 조회
# ─────────────────────────────────────────────

@router.get("/alarm-history", response_model=AlarmHistoryResponse)
async def get_alarm_history(
    equipment: Optional[str] = Query(None, description="장비 ID 필터 (예: bldg:AHU_5F)"),
    severity: Optional[str] = Query(None, description="심각도 필터 (critical/major/minor/info)"),
    limit: int = Query(50, ge=1, le=500, description="조회 건수"),
    offset: int = Query(0, ge=0, description="시작 위치 (페이지네이션)"),
):
    """
    알람 이력 조회

    - equipment: 특정 장비의 알람만 필터링
    - severity: 심각도 필터 (critical, major, minor, info)
    - limit/offset: 페이지네이션
    """
    pool = get_pg_pool()
    if not pool:
        raise HTTPException(status_code=503, detail="PostgreSQL 미연결")

    try:
        async with pool.acquire() as conn:
            # 동적 WHERE 절 구성
            conditions: list[str] = []
            params: list = []
            param_idx = 1

            if equipment:
                conditions.append(f"equipment_id = ${param_idx}")
                params.append(equipment)
                param_idx += 1

            if severity:
                conditions.append(f"severity = ${param_idx}")
                params.append(severity)
                param_idx += 1

            where_clause = "WHERE " + " AND ".join(conditions) if conditions else ""

            # 총 건수 조회
            count_query = f"SELECT COUNT(*) FROM alarm_history {where_clause}"
            total = await conn.fetchval(count_query, *params)

            # 데이터 조회
            data_query = f"""
                SELECT id, equipment_id, alarm_type, severity, message,
                       threshold_value, actual_value, onset_at, cleared_at,
                       acknowledged_at, acknowledged_by, suppressed, notes
                FROM alarm_history
                {where_clause}
                ORDER BY onset_at DESC
                LIMIT ${param_idx} OFFSET ${param_idx + 1}
            """
            params.extend([limit, offset])
            rows = await conn.fetch(data_query, *params)

            items = [
                AlarmHistoryItem(
                    id=row["id"],
                    equipment_id=row["equipment_id"],
                    alarm_type=row["alarm_type"],
                    severity=row["severity"],
                    message=row["message"],
                    threshold_value=row["threshold_value"],
                    actual_value=row["actual_value"],
                    onset_at=row["onset_at"].isoformat() if row["onset_at"] else "",
                    cleared_at=row["cleared_at"].isoformat() if row["cleared_at"] else None,
                    acknowledged_at=row["acknowledged_at"].isoformat() if row["acknowledged_at"] else None,
                    acknowledged_by=row["acknowledged_by"],
                    suppressed=row["suppressed"],
                    notes=row["notes"],
                )
                for row in rows
            ]

            return AlarmHistoryResponse(total=total, items=items)

    except HTTPException:
        raise
    except Exception as e:
        logger.error("알람 이력 조회 실패: %s", e)
        raise HTTPException(status_code=500, detail=f"알람 이력 조회 실패: {e}")


# ─────────────────────────────────────────────
# GET /audit-log — 감사 로그 조회
# ─────────────────────────────────────────────

@router.get("/audit-log", response_model=AuditLogResponse)
async def get_audit_log(
    action: Optional[str] = Query(None, description="액션 필터 (command/setpoint_change/login 등)"),
    equipment: Optional[str] = Query(None, description="대상 장비 필터"),
    limit: int = Query(50, ge=1, le=500, description="조회 건수"),
    offset: int = Query(0, ge=0, description="시작 위치 (페이지네이션)"),
):
    """
    감사 로그 조회

    - action: 액션 유형 필터 (command, setpoint_change, login, config_change)
    - equipment: 대상 장비 필터
    - limit/offset: 페이지네이션
    """
    pool = get_pg_pool()
    if not pool:
        raise HTTPException(status_code=503, detail="PostgreSQL 미연결")

    try:
        async with pool.acquire() as conn:
            # 동적 WHERE 절 구성
            conditions: list[str] = []
            params: list = []
            param_idx = 1

            if action:
                conditions.append(f"action = ${param_idx}")
                params.append(action)
                param_idx += 1

            if equipment:
                conditions.append(f"target_equipment = ${param_idx}")
                params.append(equipment)
                param_idx += 1

            where_clause = "WHERE " + " AND ".join(conditions) if conditions else ""

            # 총 건수 조회
            count_query = f"SELECT COUNT(*) FROM audit_log {where_clause}"
            total = await conn.fetchval(count_query, *params)

            # 데이터 조회
            data_query = f"""
                SELECT id, user_id, action, target_equipment,
                       old_value, new_value, source, ip_address, created_at
                FROM audit_log
                {where_clause}
                ORDER BY created_at DESC
                LIMIT ${param_idx} OFFSET ${param_idx + 1}
            """
            params.extend([limit, offset])
            rows = await conn.fetch(data_query, *params)

            items = [
                AuditLogItem(
                    id=row["id"],
                    user_id=row["user_id"],
                    action=row["action"],
                    target_equipment=row["target_equipment"],
                    old_value=row["old_value"],
                    new_value=row["new_value"],
                    source=row["source"],
                    ip_address=str(row["ip_address"]) if row["ip_address"] else None,
                    created_at=row["created_at"].isoformat() if row["created_at"] else "",
                )
                for row in rows
            ]

            return AuditLogResponse(total=total, items=items)

    except HTTPException:
        raise
    except Exception as e:
        logger.error("감사 로그 조회 실패: %s", e)
        raise HTTPException(status_code=500, detail=f"감사 로그 조회 실패: {e}")

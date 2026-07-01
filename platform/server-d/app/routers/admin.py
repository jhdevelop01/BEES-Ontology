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
    equipment: Optional[str] = Query(None, description="장비 ID 부분 일치 필터 (예: B3F, Chiller)"),
    severity: Optional[str] = Query(None, description="심각도 필터 (critical/warning)"),
    alarm_type: Optional[str] = Query(None, description="알람 유형 부분 일치 필터 (예: low_temperature, high_power)"),
    limit: int = Query(50, ge=1, le=500, description="조회 건수"),
    offset: int = Query(0, ge=0, description="시작 위치 (페이지네이션)"),
):
    """
    알람 이력 조회

    - equipment: 장비 ID 부분 일치 필터
    - severity: 심각도 필터 (critical, warning)
    - alarm_type: 알람 유형 부분 일치 필터 (low_temperature, high_power)
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
                conditions.append(f"equipment_id ILIKE ${param_idx}")
                params.append(f"%{equipment}%")
                param_idx += 1

            if severity:
                conditions.append(f"severity = ${param_idx}")
                params.append(severity)
                param_idx += 1

            if alarm_type:
                conditions.append(f"alarm_type ILIKE ${param_idx}")
                params.append(f"%{alarm_type}%")
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
# GET /alarm-history/statistics — 알람 통계 분석
# ─────────────────────────────────────────────

@router.get("/alarm-history/statistics")
async def get_alarm_statistics(
    days_back: int = Query(7, ge=1, le=365, description="분석 기간 (일)"),
):
    """
    알람 통계 분석 — 장비별 빈도, 심각도 분포, 추세, 미확인 알람 등 인사이트 제공
    """
    pool = get_pg_pool()
    if not pool:
        raise HTTPException(status_code=503, detail="PostgreSQL 미연결")

    try:
        async with pool.acquire() as conn:
            # 1) 전체 요약
            summary = await conn.fetchrow(f"""
                SELECT
                    COUNT(*) as total,
                    COUNT(CASE WHEN severity = 'critical' THEN 1 END) as critical_count,
                    COUNT(CASE WHEN severity = 'warning' THEN 1 END) as warning_count,
                    COUNT(CASE WHEN acknowledged_at IS NULL THEN 1 END) as unacknowledged,
                    COUNT(CASE WHEN cleared_at IS NULL THEN 1 END) as uncleared
                FROM alarm_history
                WHERE onset_at > NOW() - INTERVAL '{days_back} days'
            """)

            # 2) 장비별 빈도 (Top 10)
            top_equipment = await conn.fetch(f"""
                SELECT equipment_id, alarm_type, severity,
                       COUNT(*) as count,
                       ROUND(AVG(actual_value)::numeric, 1) as avg_value,
                       ROUND(MIN(threshold_value)::numeric, 1) as threshold,
                       ROUND((AVG(actual_value) / NULLIF(MIN(threshold_value), 0) * 100)::numeric, 0) as exceed_pct
                FROM alarm_history
                WHERE onset_at > NOW() - INTERVAL '{days_back} days'
                GROUP BY equipment_id, alarm_type, severity
                ORDER BY count DESC
                LIMIT 10
            """)

            # 3) 일별 추세
            daily_trend = await conn.fetch(f"""
                SELECT DATE(onset_at) as date,
                       COUNT(*) as count,
                       COUNT(CASE WHEN severity = 'critical' THEN 1 END) as critical,
                       COUNT(CASE WHEN severity = 'warning' THEN 1 END) as warning
                FROM alarm_history
                WHERE onset_at > NOW() - INTERVAL '{days_back} days'
                GROUP BY DATE(onset_at)
                ORDER BY date DESC
                LIMIT 30
            """)

            # 4) 최근 1시간 vs 이전 1시간 비교 (추세 판단)
            recent_1h = await conn.fetchval("""
                SELECT COUNT(*) FROM alarm_history
                WHERE onset_at > NOW() - INTERVAL '1 hour'
            """)
            prev_1h = await conn.fetchval("""
                SELECT COUNT(*) FROM alarm_history
                WHERE onset_at > NOW() - INTERVAL '2 hours'
                  AND onset_at <= NOW() - INTERVAL '1 hour'
            """)

            # 추세 판단
            if recent_1h > prev_1h * 1.2:
                trend = "increasing"
                trend_desc = f"최근 1시간({recent_1h}건)이 이전 1시간({prev_1h}건)보다 증가 추세"
            elif recent_1h < prev_1h * 0.8:
                trend = "decreasing"
                trend_desc = f"최근 1시간({recent_1h}건)이 이전 1시간({prev_1h}건)보다 감소 추세"
            else:
                trend = "stable"
                trend_desc = f"최근 1시간({recent_1h}건)과 이전 1시간({prev_1h}건) 유사한 수준"

            return {
                "period_days": days_back,
                "summary": {
                    "total": summary["total"],
                    "critical": summary["critical_count"],
                    "warning": summary["warning_count"],
                    "unacknowledged": summary["unacknowledged"],
                    "uncleared": summary["uncleared"],
                },
                "trend": {
                    "direction": trend,
                    "description": trend_desc,
                    "recent_1h": recent_1h,
                    "previous_1h": prev_1h,
                },
                "top_equipment": [
                    {
                        "equipment_id": row["equipment_id"],
                        "alarm_type": row["alarm_type"],
                        "severity": row["severity"],
                        "count": row["count"],
                        "avg_value": float(row["avg_value"]) if row["avg_value"] else None,
                        "threshold": float(row["threshold"]) if row["threshold"] else None,
                        "exceed_pct": float(row["exceed_pct"]) if row["exceed_pct"] else None,
                    }
                    for row in top_equipment
                ],
                "daily_trend": [
                    {
                        "date": row["date"].isoformat(),
                        "total": row["count"],
                        "critical": row["critical"],
                        "warning": row["warning"],
                    }
                    for row in daily_trend
                ],
            }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("알람 통계 조회 실패: %s", e)
        raise HTTPException(status_code=500, detail=f"알람 통계 조회 실패: {e}")


# ─────────────────────────────────────────────
# POST /alarm-history/{id}/acknowledge — 알람 확인 처리
# ─────────────────────────────────────────────

@router.post("/alarm-history/{alarm_id}/acknowledge")
async def acknowledge_alarm(
    alarm_id: int,
    acknowledged_by: int = Query(1, description="확인자 사용자 ID"),
):
    """
    알람 확인(acknowledge) 처리.
    acknowledged_at을 현재 시각으로, acknowledged_by를 지정 사용자로 업데이트.
    """
    pool = get_pg_pool()
    if not pool:
        raise HTTPException(status_code=503, detail="PostgreSQL 미연결")

    try:
        async with pool.acquire() as conn:
            result = await conn.execute(
                """
                UPDATE alarm_history
                SET acknowledged_at = NOW(), acknowledged_by = $1
                WHERE id = $2 AND acknowledged_at IS NULL
                """,
                acknowledged_by,
                alarm_id,
            )
            # result 형식: "UPDATE N"
            updated = int(result.split()[-1])
            if updated == 0:
                raise HTTPException(
                    status_code=404,
                    detail=f"알람 {alarm_id}을 찾을 수 없거나 이미 확인됨",
                )
            return {
                "success": True,
                "alarm_id": alarm_id,
                "acknowledged_by": acknowledged_by,
            }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("알람 확인 처리 실패: %s", e)
        raise HTTPException(status_code=500, detail=f"알람 확인 처리 실패: {e}")


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

"""
유지보수 관리 API 라우터

엔드포인트:
  GET    /api/maintenance/work-orders              — 작업 주문 목록
  POST   /api/maintenance/work-orders              — 작업 주문 생성
  GET    /api/maintenance/work-orders/{id}          — 작업 주문 상세
  PUT    /api/maintenance/work-orders/{id}          — 작업 주문 수정
  GET    /api/maintenance/equipment/{id}/history    — 장비별 유지보수 이력
  GET    /api/maintenance/calendar                  — 유지보수 캘린더
"""

import logging
from datetime import datetime, date as date_type
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.dependencies import CurrentUser, get_current_user
from app.services import postgres_service

logger = logging.getLogger("server-a.maintenance")
router = APIRouter(prefix="/api/maintenance", tags=["유지보수"])


# ── Pydantic 스키마 ──────────────────────────────────────────────────────

class WorkOrderCreate(BaseModel):
    """작업 주문 생성 요청."""
    equipment_id: int = Field(..., description="장비 메타데이터 ID (equipment_metadata.id)")
    title: str = Field(..., max_length=300, description="작업 제목")
    description: Optional[str] = Field(default=None, description="상세 설명")
    priority: str = Field(default="medium", description="우선순위 (low/medium/high/critical)")
    assigned_to: Optional[int] = Field(default=None, description="담당자 user ID")


class WorkOrderUpdate(BaseModel):
    """작업 주문 수정 요청."""
    status: Optional[str] = Field(default=None, description="상태 (requested/in_progress/completed/cancelled)")
    actual_hours: Optional[float] = None
    parts_used: Optional[dict[str, Any]] = None
    cost: Optional[float] = None
    notes: Optional[str] = None
    assigned_to: Optional[int] = None
    priority: Optional[str] = None


# ── 헬퍼 ─────────────────────────────────────────────────────────────────

def _get_pool():
    """PostgreSQL 풀 가져오기."""
    pool = postgres_service.get_pool()
    if pool is None:
        raise HTTPException(status_code=503, detail="PostgreSQL 미연결 — 유지보수 기능 사용 불가")
    return pool


def _row_to_dict(row: Any) -> dict:
    """asyncpg Record → dict 변환."""
    d = dict(row)
    for k, v in d.items():
        if isinstance(v, datetime):
            d[k] = v.isoformat()
        elif hasattr(v, "__str__") and type(v).__name__ == "Decimal":
            d[k] = float(v)
    return d


# ── API 엔드포인트 ────────────────────────────────────────────────────────

@router.get("/work-orders")
async def list_work_orders(
    status: Optional[str] = Query(None, description="상태 필터"),
    priority: Optional[str] = Query(None, description="우선순위 필터"),
    page: int = Query(1, ge=1, description="페이지 번호"),
    limit: int = Query(20, ge=1, le=100, description="페이지 크기"),
) -> dict[str, Any]:
    """작업 주문 목록 조회 (페이지네이션)."""
    pool = _get_pool()
    offset = (page - 1) * limit

    # 동적 WHERE 절
    conditions = []
    params: list[Any] = []
    param_idx = 1

    if status:
        conditions.append(f"wo.status = ${param_idx}")
        params.append(status)
        param_idx += 1
    if priority:
        conditions.append(f"wo.priority = ${param_idx}")
        params.append(priority)
        param_idx += 1

    where_clause = "WHERE " + " AND ".join(conditions) if conditions else ""

    async with pool.acquire() as conn:
        # 총 건수
        count_query = f"SELECT COUNT(*) FROM work_orders wo {where_clause}"
        total = await conn.fetchval(count_query, *params)

        # 데이터 조회
        data_query = f"""
            SELECT wo.*, em.ontology_id AS equipment_ontology_id
            FROM work_orders wo
            LEFT JOIN equipment_metadata em ON wo.equipment_id = em.id
            {where_clause}
            ORDER BY wo.created_at DESC
            LIMIT ${param_idx} OFFSET ${param_idx + 1}
        """
        params.extend([limit, offset])
        rows = await conn.fetch(data_query, *params)

    pages = (total + limit - 1) // limit if total else 0
    return {
        "items": [_row_to_dict(r) for r in rows],
        "total": total,
        "page": page,
        "pages": pages,
    }


@router.post("/work-orders", status_code=201)
async def create_work_order(
    req: WorkOrderCreate,
    current_user: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    """작업 주문 생성."""
    pool = _get_pool()

    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO work_orders (equipment_id, title, description, priority, assigned_to, requested_by)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
            """,
            req.equipment_id, req.title, req.description,
            req.priority, req.assigned_to, current_user.user_id,
        )

    logger.info("작업 주문 생성: %s (장비=%d, by=%s)", req.title, req.equipment_id, current_user.email)
    return _row_to_dict(row)


@router.get("/work-orders/{work_order_id}")
async def get_work_order(work_order_id: int) -> dict[str, Any]:
    """작업 주문 상세 조회."""
    pool = _get_pool()

    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT wo.*, em.ontology_id AS equipment_ontology_id,
                   u1.name AS assigned_to_name, u2.name AS requested_by_name
            FROM work_orders wo
            LEFT JOIN equipment_metadata em ON wo.equipment_id = em.id
            LEFT JOIN users u1 ON wo.assigned_to = u1.id
            LEFT JOIN users u2 ON wo.requested_by = u2.id
            WHERE wo.id = $1
            """,
            work_order_id,
        )

    if row is None:
        raise HTTPException(status_code=404, detail=f"작업 주문 {work_order_id} 없음")

    return _row_to_dict(row)


@router.put("/work-orders/{work_order_id}")
async def update_work_order(
    work_order_id: int,
    req: WorkOrderUpdate,
    current_user: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    """작업 주문 수정."""
    pool = _get_pool()

    async with pool.acquire() as conn:
        existing = await conn.fetchrow("SELECT * FROM work_orders WHERE id = $1", work_order_id)
        if existing is None:
            raise HTTPException(status_code=404, detail=f"작업 주문 {work_order_id} 없음")

        updates = {}
        if req.status is not None:
            updates["status"] = req.status
            if req.status == "completed":
                updates["completed_at"] = datetime.utcnow()
        if req.actual_hours is not None:
            updates["actual_hours"] = req.actual_hours
        if req.parts_used is not None:
            import json
            updates["parts_used"] = json.dumps(req.parts_used, ensure_ascii=False)
        if req.cost is not None:
            updates["cost"] = req.cost
        if req.notes is not None:
            updates["notes"] = req.notes
        if req.assigned_to is not None:
            updates["assigned_to"] = req.assigned_to
        if req.priority is not None:
            updates["priority"] = req.priority

        if not updates:
            return _row_to_dict(existing)

        set_clauses = []
        params = []
        for i, (col, val) in enumerate(updates.items(), start=1):
            if col == "parts_used":
                set_clauses.append(f"{col} = ${i}::jsonb")
            else:
                set_clauses.append(f"{col} = ${i}")
            params.append(val)
        params.append(work_order_id)

        query = f"UPDATE work_orders SET {', '.join(set_clauses)} WHERE id = ${len(params)} RETURNING *"
        row = await conn.fetchrow(query, *params)

    logger.info("작업 주문 수정: ID=%d (by=%s)", work_order_id, current_user.email)
    return _row_to_dict(row)


@router.get("/equipment/{equipment_id}/history")
async def get_equipment_maintenance_history(
    equipment_id: int,
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    """장비별 유지보수 이력 조회."""
    pool = _get_pool()

    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT wo.*, u.name AS assigned_to_name
            FROM work_orders wo
            LEFT JOIN users u ON wo.assigned_to = u.id
            WHERE wo.equipment_id = $1
            ORDER BY wo.created_at DESC
            LIMIT $2
            """,
            equipment_id, limit,
        )

    return {
        "equipment_id": equipment_id,
        "total": len(rows),
        "items": [_row_to_dict(r) for r in rows],
    }


@router.get("/calendar")
async def get_maintenance_calendar(
    month: str = Query(..., description="대상 월 (YYYY-MM 형식, 예: 2026-02)"),
) -> dict[str, Any]:
    """
    유지보수 캘린더 — 해당 월의 정비 일정과 작업 주문.
    """
    pool = _get_pool()

    try:
        year, mon = month.split("-")
        month_start = date_type(int(year), int(mon), 1)
        # 다음 달 1일
        next_mon = int(mon) + 1
        next_year = int(year)
        if next_mon > 12:
            next_mon = 1
            next_year += 1
        month_end = date_type(next_year, next_mon, 1)
    except ValueError:
        raise HTTPException(status_code=400, detail="월 형식은 YYYY-MM이어야 합니다")

    # timestamptz 비교용 datetime 변환
    month_start_ts = datetime(month_start.year, month_start.month, month_start.day)
    month_end_ts = datetime(month_end.year, month_end.month, month_end.day)

    events = []

    async with pool.acquire() as conn:
        # 예정된 정비 (equipment_metadata.next_maintenance_date)
        scheduled = await conn.fetch(
            """
            SELECT ontology_id, next_maintenance_date
            FROM equipment_metadata
            WHERE next_maintenance_date >= $1 AND next_maintenance_date < $2
            """,
            month_start, month_end,
        )
        for row in scheduled:
            events.append({
                "date": row["next_maintenance_date"].isoformat(),
                "type": "scheduled",
                "equipment": row["ontology_id"],
                "title": f"{row['ontology_id']} 정기 점검",
            })

        # 완료/진행 중 작업 주문
        work_orders = await conn.fetch(
            """
            SELECT wo.id, wo.title, wo.status, wo.created_at, wo.completed_at,
                   em.ontology_id
            FROM work_orders wo
            LEFT JOIN equipment_metadata em ON wo.equipment_id = em.id
            WHERE wo.created_at >= $1 AND wo.created_at < $2
            ORDER BY wo.created_at
            """,
            month_start_ts, month_end_ts,
        )
        for row in work_orders:
            event_type = "completed" if row["status"] == "completed" else "in_progress"
            date = row["completed_at"] or row["created_at"]
            events.append({
                "date": date.isoformat() if date else month_start.isoformat(),
                "type": event_type,
                "equipment": row["ontology_id"],
                "title": row["title"],
                "work_order_id": row["id"],
            })

    # 날짜순 정렬
    events.sort(key=lambda e: e["date"])

    return {
        "month": month,
        "total": len(events),
        "events": events,
    }

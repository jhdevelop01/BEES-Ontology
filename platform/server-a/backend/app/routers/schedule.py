"""
스케줄 관리 CRUD API.
PostgreSQL schedules 테이블을 사용하여 장비 스케줄을 관리한다.
"""

import logging
from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services import postgres_service

logger = logging.getLogger("server-a.schedule")
router = APIRouter(prefix="/api/schedules", tags=["스케줄"])


# ── Pydantic 스키마 ──────────────────────────────────────────────────────

class ScheduleCreate(BaseModel):
    """스케줄 생성 요청."""
    name: str = Field(..., description="스케줄명", max_length=200)
    equipment_ids: list[str] = Field(..., description="대상 장비 ID 목록 (예: ['bldg:AHU_5F'])")
    schedule_type: Optional[str] = Field(default="cron", description="스케줄 유형 (cron/interval)")
    schedule_data: dict[str, Any] = Field(
        ...,
        description="스케줄 데이터 (cron_expression, action, params 등)",
        examples=[{
            "cron_expression": "0 8 * * 1-5",
            "action": "ON",
            "params": {},
        }],
    )
    is_active: bool = Field(default=True, description="활성 여부")
    created_by: Optional[int] = Field(default=None, description="생성자 user ID")


class ScheduleUpdate(BaseModel):
    """스케줄 수정 요청."""
    name: Optional[str] = Field(default=None, max_length=200)
    equipment_ids: Optional[list[str]] = None
    schedule_type: Optional[str] = None
    schedule_data: Optional[dict[str, Any]] = None
    is_active: Optional[bool] = None


class ScheduleResponse(BaseModel):
    """스케줄 응답."""
    id: int
    name: str
    equipment_ids: list[str]
    schedule_type: Optional[str]
    schedule_data: dict[str, Any]
    is_active: bool
    created_by: Optional[int]
    created_at: str


# ── 헬퍼 ─────────────────────────────────────────────────────────────────

def _row_to_dict(row: Any) -> dict:
    """asyncpg Record → dict 변환."""
    d = dict(row)
    for k, v in d.items():
        if isinstance(v, datetime):
            d[k] = v.isoformat()
    return d


def _get_pool():
    """PostgreSQL 풀 가져오기. 미연결 시 503."""
    pool = postgres_service.get_pool()
    if pool is None:
        raise HTTPException(status_code=503, detail="PostgreSQL 미연결 — 스케줄 기능 사용 불가")
    return pool


# ── API 엔드포인트 ────────────────────────────────────────────────────────

@router.get("", response_model=list[ScheduleResponse])
async def list_schedules(active_only: bool = False):
    """전체 스케줄 목록 조회."""
    pool = _get_pool()
    query = "SELECT * FROM schedules"
    if active_only:
        query += " WHERE is_active = true"
    query += " ORDER BY created_at DESC"

    async with pool.acquire() as conn:
        rows = await conn.fetch(query)

    return [_row_to_dict(r) for r in rows]


@router.get("/{schedule_id}", response_model=ScheduleResponse)
async def get_schedule(schedule_id: int):
    """특정 스케줄 상세 조회."""
    pool = _get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow("SELECT * FROM schedules WHERE id = $1", schedule_id)

    if row is None:
        raise HTTPException(status_code=404, detail=f"스케줄 {schedule_id} 없음")

    return _row_to_dict(row)


@router.post("", response_model=ScheduleResponse, status_code=201)
async def create_schedule(req: ScheduleCreate):
    """스케줄 생성."""
    pool = _get_pool()

    import json
    schedule_data_json = json.dumps(req.schedule_data, ensure_ascii=False)

    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO schedules (name, equipment_ids, schedule_type, schedule_data, is_active, created_by)
            VALUES ($1, $2, $3, $4::jsonb, $5, $6)
            RETURNING *
            """,
            req.name,
            req.equipment_ids,
            req.schedule_type,
            schedule_data_json,
            req.is_active,
            req.created_by,
        )

    logger.info("스케줄 생성: %s (장비 %d개)", req.name, len(req.equipment_ids))
    return _row_to_dict(row)


@router.put("/{schedule_id}", response_model=ScheduleResponse)
async def update_schedule(schedule_id: int, req: ScheduleUpdate):
    """스케줄 수정."""
    pool = _get_pool()

    # 기존 데이터 확인
    async with pool.acquire() as conn:
        existing = await conn.fetchrow("SELECT * FROM schedules WHERE id = $1", schedule_id)

    if existing is None:
        raise HTTPException(status_code=404, detail=f"스케줄 {schedule_id} 없음")

    # 변경할 필드만 업데이트
    updates = {}
    if req.name is not None:
        updates["name"] = req.name
    if req.equipment_ids is not None:
        updates["equipment_ids"] = req.equipment_ids
    if req.schedule_type is not None:
        updates["schedule_type"] = req.schedule_type
    if req.schedule_data is not None:
        import json
        updates["schedule_data"] = json.dumps(req.schedule_data, ensure_ascii=False)
    if req.is_active is not None:
        updates["is_active"] = req.is_active

    if not updates:
        return _row_to_dict(existing)

    # 동적 SET 절 구성
    set_clauses = []
    params = []
    for i, (col, val) in enumerate(updates.items(), start=1):
        if col == "schedule_data":
            set_clauses.append(f"{col} = ${i}::jsonb")
        else:
            set_clauses.append(f"{col} = ${i}")
        params.append(val)
    params.append(schedule_id)

    query = f"UPDATE schedules SET {', '.join(set_clauses)} WHERE id = ${len(params)} RETURNING *"

    async with pool.acquire() as conn:
        row = await conn.fetchrow(query, *params)

    logger.info("스케줄 수정: ID=%d", schedule_id)
    return _row_to_dict(row)


@router.delete("/{schedule_id}")
async def delete_schedule(schedule_id: int):
    """스케줄 삭제."""
    pool = _get_pool()

    async with pool.acquire() as conn:
        result = await conn.execute("DELETE FROM schedules WHERE id = $1", schedule_id)

    if result == "DELETE 0":
        raise HTTPException(status_code=404, detail=f"스케줄 {schedule_id} 없음")

    logger.info("스케줄 삭제: ID=%d", schedule_id)
    return {"message": f"스케줄 {schedule_id} 삭제 완료"}

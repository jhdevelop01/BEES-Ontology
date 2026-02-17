"""
사용자 관리 API 라우터

엔드포인트:
  GET    /api/users            — 사용자 목록 (Admin only)
  POST   /api/users            — 사용자 생성 (Admin only)
  GET    /api/users/{id}       — 사용자 상세
  PUT    /api/users/{id}       — 사용자 수정 (Admin only)
  DELETE /api/users/{id}       — 사용자 비활성화 (Admin only)
  GET    /api/users/{id}/access-log — 접근 로그
"""

import logging
from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.dependencies import CurrentUser, get_current_user, require_role
from app.services import postgres_service
from app.services.auth_service import hash_password

logger = logging.getLogger("server-a.users")
router = APIRouter(prefix="/api/users", tags=["사용자 관리"])


# ── Pydantic 스키마 ──────────────────────────────────────────────────────

class UserCreate(BaseModel):
    """사용자 생성 요청."""
    email: str = Field(..., description="이메일")
    password: str = Field(..., min_length=6, description="비밀번호 (6자 이상)")
    name: str = Field(..., description="이름")
    role: str = Field(default="viewer", description="역할 (viewer/operator/admin)")
    department: Optional[str] = Field(default=None, description="부서")


class UserUpdate(BaseModel):
    """사용자 수정 요청."""
    name: Optional[str] = None
    role: Optional[str] = None
    department: Optional[str] = None
    is_active: Optional[bool] = None


# ── 헬퍼 ─────────────────────────────────────────────────────────────────

def _get_pool():
    pool = postgres_service.get_pool()
    if pool is None:
        raise HTTPException(status_code=503, detail="PostgreSQL 미연결")
    return pool


def _row_to_dict(row: Any) -> dict:
    d = dict(row)
    for k, v in d.items():
        if isinstance(v, datetime):
            d[k] = v.isoformat()
    # 비밀번호 해시 제거
    d.pop("password_hash", None)
    return d


# ── API 엔드포인트 ────────────────────────────────────────────────────────

@router.get("")
async def list_users(
    current_user: CurrentUser = Depends(require_role("admin")),
) -> list[dict[str, Any]]:
    """전체 사용자 목록 조회 (Admin only)."""
    pool = _get_pool()

    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT id, email, name, role, department, is_active, created_at, last_login FROM users ORDER BY id"
        )

    return [_row_to_dict(r) for r in rows]


@router.post("", status_code=201)
async def create_user(
    req: UserCreate,
    current_user: CurrentUser = Depends(require_role("admin")),
) -> dict[str, Any]:
    """사용자 생성 (Admin only)."""
    pool = _get_pool()

    async with pool.acquire() as conn:
        # 이메일 중복 확인
        existing = await conn.fetchrow("SELECT id FROM users WHERE email = $1", req.email)
        if existing:
            raise HTTPException(status_code=409, detail=f"이미 등록된 이메일: {req.email}")

        hashed = hash_password(req.password)
        row = await conn.fetchrow(
            """
            INSERT INTO users (email, name, role, department, password_hash)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, email, name, role, department, is_active, created_at, last_login
            """,
            req.email, req.name, req.role, req.department, hashed,
        )

    logger.info("사용자 생성: %s (role=%s, by=%s)", req.email, req.role, current_user.email)
    return _row_to_dict(row)


@router.get("/{user_id}")
async def get_user(
    user_id: int,
    current_user: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    """사용자 상세 조회."""
    pool = _get_pool()

    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT id, email, name, role, department, is_active, created_at, last_login FROM users WHERE id = $1",
            user_id,
        )

    if row is None:
        raise HTTPException(status_code=404, detail=f"사용자 {user_id} 없음")

    return _row_to_dict(row)


@router.put("/{user_id}")
async def update_user(
    user_id: int,
    req: UserUpdate,
    current_user: CurrentUser = Depends(require_role("admin")),
) -> dict[str, Any]:
    """사용자 수정 (Admin only)."""
    pool = _get_pool()

    async with pool.acquire() as conn:
        existing = await conn.fetchrow("SELECT * FROM users WHERE id = $1", user_id)
        if existing is None:
            raise HTTPException(status_code=404, detail=f"사용자 {user_id} 없음")

        updates = {}
        if req.name is not None:
            updates["name"] = req.name
        if req.role is not None:
            updates["role"] = req.role
        if req.department is not None:
            updates["department"] = req.department
        if req.is_active is not None:
            updates["is_active"] = req.is_active

        if not updates:
            return _row_to_dict(existing)

        set_clauses = []
        params = []
        for i, (col, val) in enumerate(updates.items(), start=1):
            set_clauses.append(f"{col} = ${i}")
            params.append(val)
        params.append(user_id)

        query = f"""
            UPDATE users SET {', '.join(set_clauses)}
            WHERE id = ${len(params)}
            RETURNING id, email, name, role, department, is_active, created_at, last_login
        """
        row = await conn.fetchrow(query, *params)

    logger.info("사용자 수정: ID=%d (by=%s)", user_id, current_user.email)
    return _row_to_dict(row)


@router.delete("/{user_id}")
async def delete_user(
    user_id: int,
    current_user: CurrentUser = Depends(require_role("admin")),
) -> dict[str, Any]:
    """사용자 비활성화 (Soft delete, Admin only)."""
    pool = _get_pool()

    if user_id == current_user.user_id:
        raise HTTPException(status_code=400, detail="자기 자신은 비활성화할 수 없습니다")

    async with pool.acquire() as conn:
        result = await conn.execute(
            "UPDATE users SET is_active = false WHERE id = $1 AND is_active = true",
            user_id,
        )

    if result == "UPDATE 0":
        raise HTTPException(status_code=404, detail=f"사용자 {user_id} 없음 또는 이미 비활성")

    logger.info("사용자 비활성화: ID=%d (by=%s)", user_id, current_user.email)
    return {"message": f"사용자 {user_id} 비활성화 완료"}


@router.get("/{user_id}/access-log")
async def get_user_access_log(
    user_id: int,
    limit: int = Query(50, ge=1, le=200),
    current_user: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    """사용자 접근 로그 조회."""
    pool = _get_pool()

    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT id, action, target_equipment, source, ip_address::text, created_at
            FROM audit_log
            WHERE user_id = $1
            ORDER BY created_at DESC
            LIMIT $2
            """,
            user_id, limit,
        )

    return {
        "user_id": user_id,
        "total": len(rows),
        "items": [_row_to_dict(r) for r in rows],
    }

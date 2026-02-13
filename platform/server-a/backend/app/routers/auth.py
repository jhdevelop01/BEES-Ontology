"""
인증 API 라우터.
JWT 로그인, 사용자 등록, 프로필 조회.
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field

from app.dependencies import CurrentUser, get_current_user, require_role
from app.services import postgres_service
from app.services.auth_service import create_access_token, hash_password, verify_password

logger = logging.getLogger("server-a.auth")
router = APIRouter(prefix="/api/auth", tags=["인증"])


# ── Pydantic 스키마 ──────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: str = Field(..., description="이메일")
    password: str = Field(..., description="비밀번호")


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


class RegisterRequest(BaseModel):
    email: str = Field(..., description="이메일")
    password: str = Field(..., min_length=6, description="비밀번호 (6자 이상)")
    name: str = Field(..., description="이름")
    role: str = Field(default="viewer", description="역할 (viewer/operator/admin)")
    department: Optional[str] = Field(default=None, description="부서")


class UserProfile(BaseModel):
    id: int
    email: str
    name: str
    role: str
    department: Optional[str]
    is_active: bool


# ── 헬퍼 ─────────────────────────────────────────────────────────────────

def _get_pool():
    pool = postgres_service.get_pool()
    if pool is None:
        raise HTTPException(status_code=503, detail="PostgreSQL 미연결 — 인증 기능 사용 불가")
    return pool


# ── API 엔드포인트 ────────────────────────────────────────────────────────

@router.post("/login", response_model=LoginResponse)
async def login(req: LoginRequest):
    """이메일 + 비밀번호 → JWT 토큰 발급."""
    pool = _get_pool()

    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT id, email, name, role, department, is_active, password_hash FROM users WHERE email = $1",
            req.email,
        )

    if row is None:
        raise HTTPException(status_code=401, detail="이메일 또는 비밀번호가 올바르지 않습니다")

    if not row["is_active"]:
        raise HTTPException(status_code=403, detail="비활성화된 계정입니다")

    if not row["password_hash"] or not verify_password(req.password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="이메일 또는 비밀번호가 올바르지 않습니다")

    token = create_access_token(
        email=row["email"],
        role=row["role"],
        user_id=row["id"],
    )

    # last_login 갱신
    async with pool.acquire() as conn:
        await conn.execute("UPDATE users SET last_login = NOW() WHERE id = $1", row["id"])

    logger.info("로그인 성공: %s (role=%s)", req.email, row["role"])

    return LoginResponse(
        access_token=token,
        user={
            "id": row["id"],
            "email": row["email"],
            "name": row["name"],
            "role": row["role"],
            "department": row["department"],
        },
    )


@router.post("/register", response_model=UserProfile, status_code=201)
async def register(
    req: RegisterRequest,
    current_user: CurrentUser = Depends(require_role("admin")),
):
    """신규 사용자 등록 (admin 권한 필요)."""
    pool = _get_pool()

    # 이메일 중복 확인
    async with pool.acquire() as conn:
        existing = await conn.fetchrow("SELECT id FROM users WHERE email = $1", req.email)
        if existing:
            raise HTTPException(status_code=409, detail=f"이미 등록된 이메일: {req.email}")

        hashed = hash_password(req.password)
        row = await conn.fetchrow(
            """
            INSERT INTO users (email, name, role, department, password_hash)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, email, name, role, department, is_active
            """,
            req.email, req.name, req.role, req.department, hashed,
        )

    logger.info("사용자 등록: %s (role=%s, by=%s)", req.email, req.role, current_user.email)

    return UserProfile(
        id=row["id"],
        email=row["email"],
        name=row["name"],
        role=row["role"],
        department=row["department"],
        is_active=row["is_active"],
    )


@router.get("/me", response_model=UserProfile)
async def get_me(current_user: CurrentUser = Depends(get_current_user)):
    """현재 로그인 사용자 정보 조회."""
    pool = _get_pool()

    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT id, email, name, role, department, is_active FROM users WHERE id = $1",
            current_user.user_id,
        )

    if row is None:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다")

    return UserProfile(
        id=row["id"],
        email=row["email"],
        name=row["name"],
        role=row["role"],
        department=row["department"],
        is_active=row["is_active"],
    )


@router.post("/logout")
async def logout():
    """로그아웃 안내 (JWT는 서버 측 세션 없음)."""
    return {"message": "프론트엔드에서 토큰을 삭제하세요. 서버 측 세션은 없습니다."}

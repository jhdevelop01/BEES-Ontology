"""
FastAPI 의존성 — 인증/권한 검사.
"""

from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.services.auth_service import decode_token

security = HTTPBearer(auto_error=False)


class CurrentUser:
    """인증된 사용자 정보."""
    def __init__(self, user_id: int, email: str, role: str):
        self.user_id = user_id
        self.email = email
        self.role = role


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> CurrentUser:
    """Authorization Bearer 토큰에서 사용자 정보 추출."""
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="인증 토큰이 필요합니다",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_token(credentials.credentials)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="유효하지 않거나 만료된 토큰입니다",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return CurrentUser(
        user_id=payload.get("user_id", 0),
        email=payload.get("sub", ""),
        role=payload.get("role", "viewer"),
    )


def require_role(*roles: str):
    """역할 기반 접근 제어. 지정된 역할 중 하나를 가진 사용자만 접근 가능."""
    async def _check(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"접근 권한 부족. 필요 역할: {', '.join(roles)} (현재: {user.role})",
            )
        return user
    return _check

"""
JWT 인증 서비스.
토큰 생성/검증, 비밀번호 해싱을 담당한다.
"""

import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
from jose import JWTError, jwt

logger = logging.getLogger("server-a.auth")

# 설정
SECRET_KEY = os.getenv("JWT_SECRET", "bees-dev-secret-key-change-in-production")
ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = 24


def hash_password(password: str) -> str:
    """비밀번호 해싱 (bcrypt)."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    """비밀번호 검증 (bcrypt)."""
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(
    email: str,
    role: str,
    user_id: int,
    expires_delta: Optional[timedelta] = None,
) -> str:
    """JWT 액세스 토큰 생성."""
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(hours=TOKEN_EXPIRE_HOURS))
    payload = {
        "sub": email,
        "role": role,
        "user_id": user_id,
        "exp": expire,
    }
    token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
    logger.info("JWT 토큰 생성: %s (role=%s)", email, role)
    return token


def decode_token(token: str) -> Optional[dict]:
    """JWT 토큰 디코딩. 실패 시 None."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError as e:
        logger.warning("JWT 토큰 검증 실패: %s", e)
        return None

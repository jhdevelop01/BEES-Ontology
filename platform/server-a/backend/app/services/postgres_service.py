"""
Server A PostgreSQL 서비스.
asyncpg 커넥션 풀을 관리하며, 스케줄/감사 로그 등에서 사용.
"""

import logging
from typing import Optional

import asyncpg

from app.config import DATABASE_URL

logger = logging.getLogger("server-a.postgres")

_pool: Optional[asyncpg.Pool] = None


async def connect() -> None:
    """PostgreSQL 커넥션 풀 초기화."""
    global _pool
    try:
        _pool = await asyncpg.create_pool(
            dsn=DATABASE_URL,
            min_size=1,
            max_size=5,
            command_timeout=10,
        )
        logger.info("PostgreSQL 커넥션 풀 생성 완료")
    except Exception as e:
        logger.error("PostgreSQL 연결 실패: %s (스케줄 기능 비활성)", e)


async def disconnect() -> None:
    """PostgreSQL 커넥션 풀 종료."""
    global _pool
    if _pool:
        await _pool.close()
        _pool = None
        logger.info("PostgreSQL 커넥션 풀 종료")


def get_pool() -> Optional[asyncpg.Pool]:
    """현재 커넥션 풀 반환."""
    return _pool

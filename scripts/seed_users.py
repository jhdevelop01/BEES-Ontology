#!/usr/bin/env python3
"""
PostgreSQL 초기 사용자 시드 스크립트.
users 테이블에 기본 계정을 생성한다.

사용법:
  python3 scripts/seed_users.py

필요 패키지: asyncpg, passlib[bcrypt]
"""

import asyncio
import os
import sys

import asyncpg

# bcrypt 호환성 문제 우회: passlib 대신 직접 bcrypt 사용
try:
    import bcrypt

    def hash_password(password: str) -> str:
        return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
except ImportError:
    print("ERROR: bcrypt 패키지가 필요합니다: pip install bcrypt")
    sys.exit(1)


DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://bees:bees2024@localhost:5434/bees_platform",
)

SEED_USERS = [
    {
        "email": "admin@bees.dev",
        "name": "시스템 관리자",
        "role": "admin",
        "department": "FM팀",
        "password": "admin123",
    },
    {
        "email": "operator@bees.dev",
        "name": "운영 담당자",
        "role": "operator",
        "department": "FM팀",
        "password": "operator123",
    },
    {
        "email": "viewer@bees.dev",
        "name": "일반 사용자",
        "role": "viewer",
        "department": "FM팀",
        "password": "viewer123",
    },
]


async def seed():
    """시드 사용자 생성."""
    print(f"PostgreSQL 연결: {DATABASE_URL}")
    conn = await asyncpg.connect(DATABASE_URL)

    try:
        # password_hash 컬럼 존재 확인 (없으면 추가)
        col_exists = await conn.fetchval("""
            SELECT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'users' AND column_name = 'password_hash'
            )
        """)
        if not col_exists:
            await conn.execute("ALTER TABLE users ADD COLUMN password_hash VARCHAR(255)")
            print("password_hash 컬럼 추가 완료")

        created = 0
        for user in SEED_USERS:
            existing = await conn.fetchrow(
                "SELECT id FROM users WHERE email = $1", user["email"]
            )
            if existing:
                # 비밀번호 업데이트만
                hashed = hash_password(user["password"])
                await conn.execute(
                    "UPDATE users SET password_hash = $1 WHERE email = $2",
                    hashed, user["email"],
                )
                print(f"  기존 사용자 비밀번호 갱신: {user['email']}")
            else:
                hashed = hash_password(user["password"])
                await conn.execute(
                    """
                    INSERT INTO users (email, name, role, department, password_hash)
                    VALUES ($1, $2, $3, $4, $5)
                    """,
                    user["email"], user["name"], user["role"],
                    user["department"], hashed,
                )
                created += 1
                print(f"  사용자 생성: {user['email']} (role={user['role']})")

        print(f"\n시드 완료: {created}개 신규 생성")
        print("테스트 계정:")
        for u in SEED_USERS:
            print(f"  {u['email']} / {u['password']} (role: {u['role']})")

    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(seed())

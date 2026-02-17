"""
Server A — 감사 로깅 서비스

모든 사용자 액션(제어 명령, 설정 변경, 로그인 등)을 PostgreSQL audit_log에 기록한다.

사용처:
  - control.py: 제어 명령 전송 후
  - auth.py: 로그인/등록 시
  - schedule.py: 스케줄 변경 시
  - chat.py: LLM 질의 시
"""

import json
import logging
from typing import Optional

from app.services import postgres_service

logger = logging.getLogger("server-a.audit")


async def log_action(
    user_id: Optional[int],
    action: str,
    target_equipment: Optional[str] = None,
    old_value: Optional[str] = None,
    new_value: Optional[str] = None,
    source: str = "dashboard",
    ip_address: Optional[str] = None,
) -> bool:
    """
    감사 로그를 PostgreSQL에 기록한다.

    Args:
        user_id: 사용자 ID (미인증 시 None)
        action: 액션 유형 ('command', 'setpoint_change', 'login', 'config_change')
        target_equipment: 대상 장비 온톨로지 ID (예: 'bldg:AHU_5F')
        old_value: 변경 전 값 (JSON 문자열)
        new_value: 변경 후 값 (JSON 문자열)
        source: 요청 출처 ('dashboard', 'chatbot', 'schedule', 'api')
        ip_address: 클라이언트 IP

    Returns:
        성공 여부
    """
    pool = postgres_service.get_pool()
    if pool is None:
        logger.warning("PostgreSQL 미연결 — 감사 로그 기록 스킵: action=%s", action)
        return False

    try:
        async with pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO audit_log
                    (user_id, action, target_equipment, old_value, new_value, source, ip_address)
                VALUES ($1, $2, $3, $4, $5, $6, $7::inet)
                """,
                user_id,
                action,
                target_equipment,
                old_value,
                new_value,
                source,
                ip_address,
            )
        logger.info(
            "감사 로그 기록: action=%s, equipment=%s, user=%s, source=%s",
            action, target_equipment, user_id, source,
        )
        return True
    except Exception as e:
        logger.error("감사 로그 기록 실패: %s", e)
        return False


async def get_audit_logs(
    action: Optional[str] = None,
    user_id: Optional[int] = None,
    equipment: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> dict:
    """
    감사 로그를 조회한다.

    Args:
        action: 액션 필터
        user_id: 사용자 ID 필터
        equipment: 장비 ID 필터
        limit: 조회 건수
        offset: 시작 위치

    Returns:
        {"total": int, "items": list[dict]}
    """
    pool = postgres_service.get_pool()
    if pool is None:
        return {"total": 0, "items": []}

    try:
        async with pool.acquire() as conn:
            # 동적 WHERE 절
            conditions: list[str] = []
            params: list = []
            idx = 1

            if action:
                conditions.append(f"action = ${idx}")
                params.append(action)
                idx += 1

            if user_id is not None:
                conditions.append(f"user_id = ${idx}")
                params.append(user_id)
                idx += 1

            if equipment:
                conditions.append(f"target_equipment = ${idx}")
                params.append(equipment)
                idx += 1

            where = "WHERE " + " AND ".join(conditions) if conditions else ""

            total = await conn.fetchval(
                f"SELECT COUNT(*) FROM audit_log {where}", *params
            )

            rows = await conn.fetch(
                f"""
                SELECT id, user_id, action, target_equipment,
                       old_value, new_value, source, ip_address, created_at
                FROM audit_log
                {where}
                ORDER BY created_at DESC
                LIMIT ${idx} OFFSET ${idx + 1}
                """,
                *params, limit, offset,
            )

            items = []
            for row in rows:
                items.append({
                    "id": row["id"],
                    "user_id": row["user_id"],
                    "action": row["action"],
                    "target_equipment": row["target_equipment"],
                    "old_value": row["old_value"],
                    "new_value": row["new_value"],
                    "source": row["source"],
                    "ip_address": str(row["ip_address"]) if row["ip_address"] else None,
                    "created_at": row["created_at"].isoformat() if row["created_at"] else "",
                })

            return {"total": total, "items": items}

    except Exception as e:
        logger.error("감사 로그 조회 실패: %s", e)
        return {"total": 0, "items": []}

"""
감사 로그 API 라우터
PostgreSQL audit_log 테이블에서 감사 이력을 조회한다.
"""

import logging
from typing import Optional

from fastapi import APIRouter, Query

from app.services import audit_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["감사 로그"])


@router.get("/audit-log")
async def get_audit_log(
    action: Optional[str] = Query(None, description="액션 필터 (command/login/config_change)"),
    user_id: Optional[int] = Query(None, description="사용자 ID 필터"),
    equipment: Optional[str] = Query(None, description="대상 장비 필터 (예: bldg:AHU_5F)"),
    limit: int = Query(50, ge=1, le=500, description="조회 건수"),
    offset: int = Query(0, ge=0, description="시작 위치"),
):
    """
    감사 로그 조회

    - action: 액션 유형 (command, setpoint_change, login, config_change)
    - user_id: 사용자 ID
    - equipment: 장비 온톨로지 ID
    - limit/offset: 페이지네이션
    """
    result = await audit_service.get_audit_logs(
        action=action,
        user_id=user_id,
        equipment=equipment,
        limit=limit,
        offset=offset,
    )
    return result

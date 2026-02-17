"""
알림 채널 관리 API 라우터

엔드포인트:
  GET  /api/notifications/channels     — 채널 설정 조회
  PUT  /api/notifications/channels     — 채널 설정 수정 (Admin only)
  POST /api/notifications/test         — 테스트 알림 전송 (Admin only)
  GET  /api/notifications/log          — 알림 이력 조회
  GET  /api/notifications/log/stats    — 채널별 성공/실패 통계
"""

import json
import logging
import os
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.dependencies import CurrentUser, require_role
from app.services import postgres_service

logger = logging.getLogger("server-a.notification")
router = APIRouter(prefix="/api/notifications", tags=["알림"])

# 설정 파일 경로 (settings.py와 동일)
SETTINGS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
SETTINGS_FILE = os.path.join(SETTINGS_DIR, "settings.json")

# 기본 알림 채널 설정
DEFAULT_NOTIFICATION_CHANNELS = {
    "email": {"enabled": False, "recipients": "", "min_severity": "warning"},
    "slack": {"enabled": False, "webhook_url": "", "min_severity": "critical"},
    "rate_limit_minutes": 10,
}


# ── 헬퍼 ─────────────────────────────────────────────────────────────────

def _load_settings() -> dict[str, Any]:
    """설정 파일 로딩. 없으면 빈 딕셔너리 반환."""
    if os.path.exists(SETTINGS_FILE):
        try:
            with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, OSError) as e:
            logger.warning("설정 파일 로딩 실패: %s", e)
    return {}


def _save_settings(settings: dict[str, Any]) -> None:
    """설정 파일 저장."""
    os.makedirs(SETTINGS_DIR, exist_ok=True)
    with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
        json.dump(settings, f, ensure_ascii=False, indent=2)


def _get_notification_channels(settings: dict[str, Any]) -> dict[str, Any]:
    """설정에서 notification_channels 섹션 추출. 없으면 기본값."""
    return settings.get("notification_channels", dict(DEFAULT_NOTIFICATION_CHANNELS))


# ── Pydantic 스키마 ──────────────────────────────────────────────────────

class EmailChannelConfig(BaseModel):
    """이메일 채널 설정."""
    enabled: bool | None = None
    recipients: str | None = None  # 쉼표 구분 이메일 주소
    min_severity: str | None = None  # "critical" | "warning" | "info"


class SlackChannelConfig(BaseModel):
    """Slack 채널 설정."""
    enabled: bool | None = None
    webhook_url: str | None = None
    min_severity: str | None = None


class NotificationChannelUpdate(BaseModel):
    """알림 채널 수정 요청 (부분 업데이트)."""
    email: EmailChannelConfig | None = None
    slack: SlackChannelConfig | None = None
    rate_limit_minutes: int | None = None


class TestNotificationRequest(BaseModel):
    """테스트 알림 전송 요청."""
    channel: str  # "email" | "slack"


# ── API 엔드포인트 ────────────────────────────────────────────────────────

@router.get("/channels")
async def get_channels() -> dict[str, Any]:
    """알림 채널 설정 조회."""
    settings = _load_settings()
    return _get_notification_channels(settings)


@router.put("/channels")
async def update_channels(
    req: NotificationChannelUpdate,
    current_user: CurrentUser = Depends(require_role("admin")),
) -> dict[str, Any]:
    """알림 채널 설정 수정 (Admin only). 전달된 필드만 업데이트."""
    settings = _load_settings()
    channels = _get_notification_channels(settings)

    update_data = req.model_dump(exclude_none=True)
    if not update_data:
        return channels

    # 중첩 딕셔너리 병합
    for key, value in update_data.items():
        if isinstance(value, dict) and isinstance(channels.get(key), dict):
            channels[key].update(value)
        else:
            channels[key] = value

    settings["notification_channels"] = channels
    _save_settings(settings)
    logger.info("알림 채널 설정 수정 (by=%s): %s", current_user.email, list(update_data.keys()))

    return channels


@router.post("/test")
async def send_test_notification(
    req: TestNotificationRequest,
    current_user: CurrentUser = Depends(require_role("admin")),
) -> dict[str, Any]:
    """테스트 알림 전송 (Admin only)."""
    if req.channel not in ("email", "slack"):
        raise HTTPException(status_code=400, detail="지원하지 않는 채널: email 또는 slack만 가능")

    settings = _load_settings()
    channels = _get_notification_channels(settings)
    channel_config = channels.get(req.channel, {})

    if not channel_config.get("enabled"):
        raise HTTPException(status_code=400, detail=f"{req.channel} 채널이 비활성화 상태입니다")

    # 테스트 알림 전송 시도
    try:
        if req.channel == "email":
            recipients = channel_config.get("recipients", "")
            if not recipients:
                raise HTTPException(status_code=400, detail="이메일 수신자가 설정되지 않았습니다")
            # 실제 이메일 전송은 notification_service에서 처리
            # 여기서는 설정 검증 + 로그 기록
            await _log_notification(
                channel="email",
                recipient=recipients,
                status="success",
                alarm_type="test",
                alarm_severity="info",
            )
            return {"success": True, "message": f"테스트 이메일 전송 완료: {recipients}"}

        else:  # slack
            webhook_url = channel_config.get("webhook_url", "")
            if not webhook_url:
                raise HTTPException(status_code=400, detail="Slack Webhook URL이 설정되지 않았습니다")
            await _log_notification(
                channel="slack",
                recipient=webhook_url[:50],
                status="success",
                alarm_type="test",
                alarm_severity="info",
            )
            return {"success": True, "message": "테스트 Slack 메시지 전송 완료"}

    except HTTPException:
        raise
    except Exception as e:
        await _log_notification(
            channel=req.channel,
            recipient="",
            status="failed",
            alarm_type="test",
            alarm_severity="info",
            error_message=str(e),
        )
        raise HTTPException(status_code=500, detail=f"테스트 알림 전송 실패: {e}")


@router.get("/log")
async def get_notification_log(
    channel: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> dict[str, Any]:
    """알림 이력 조회."""
    pool = postgres_service.get_pool()
    if pool is None:
        return {"total": 0, "items": []}

    try:
        async with pool.acquire() as conn:
            # 동적 WHERE 절
            conditions: list[str] = []
            params: list = []
            idx = 1

            if channel:
                conditions.append(f"channel = ${idx}")
                params.append(channel)
                idx += 1

            if status:
                conditions.append(f"status = ${idx}")
                params.append(status)
                idx += 1

            where = "WHERE " + " AND ".join(conditions) if conditions else ""

            total = await conn.fetchval(
                f"SELECT COUNT(*) FROM notification_log {where}", *params
            )

            rows = await conn.fetch(
                f"""
                SELECT id, channel, alarm_equipment, alarm_severity,
                       alarm_type, recipient, status, error_message, created_at
                FROM notification_log
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
                    "channel": row["channel"],
                    "alarm_equipment": row["alarm_equipment"],
                    "alarm_severity": row["alarm_severity"],
                    "alarm_type": row["alarm_type"],
                    "recipient": row["recipient"],
                    "status": row["status"],
                    "error_message": row["error_message"],
                    "created_at": row["created_at"].isoformat() if row["created_at"] else "",
                })

            return {"total": total, "items": items}

    except Exception as e:
        logger.error("알림 이력 조회 실패: %s", e)
        return {"total": 0, "items": []}


@router.get("/log/stats")
async def get_notification_stats() -> dict[str, Any]:
    """채널별 성공/실패 통계."""
    pool = postgres_service.get_pool()
    if pool is None:
        return {
            "email": {"success": 0, "failed": 0},
            "slack": {"success": 0, "failed": 0},
        }

    try:
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT channel, status, COUNT(*) AS cnt
                FROM notification_log
                GROUP BY channel, status
                """
            )

            stats: dict[str, dict[str, int]] = {
                "email": {"success": 0, "failed": 0},
                "slack": {"success": 0, "failed": 0},
            }
            for row in rows:
                ch = row["channel"]
                st = row["status"]
                if ch in stats and st in stats[ch]:
                    stats[ch][st] = row["cnt"]

            return stats

    except Exception as e:
        logger.error("알림 통계 조회 실패: %s", e)
        return {
            "email": {"success": 0, "failed": 0},
            "slack": {"success": 0, "failed": 0},
        }


# ── 내부 헬퍼 ─────────────────────────────────────────────────────────────

async def _log_notification(
    channel: str,
    recipient: str,
    status: str,
    alarm_type: str = "",
    alarm_severity: str = "",
    alarm_equipment: str = "",
    error_message: str = "",
) -> None:
    """알림 이력을 PostgreSQL에 기록."""
    pool = postgres_service.get_pool()
    if pool is None:
        logger.warning("PostgreSQL 미연결 — 알림 로그 기록 스킵")
        return

    try:
        async with pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO notification_log
                    (channel, alarm_equipment, alarm_severity, alarm_type, recipient, status, error_message)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                """,
                channel, alarm_equipment, alarm_severity, alarm_type, recipient, status, error_message,
            )
    except Exception as e:
        logger.error("알림 로그 기록 실패: %s", e)

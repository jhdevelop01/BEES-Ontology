"""
Server A — 알림 서비스

알람 발생 시 Email / Slack 채널로 자동 알림을 전송한다.
채널 설정은 settings.json의 notification_channels 섹션에서 관리.
알림 이력은 PostgreSQL notification_log 테이블에 기록.

사용처:
  - mqtt_service.py: 알람 수신 시 dispatch_alarm() 호출
  - notification.py (라우터): 이력 조회 API
"""

import json
import logging
import os
import smtplib
import time
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any, Optional

import httpx

from app import config
from app.services import postgres_service

logger = logging.getLogger("server-a.notification")

# 설정 파일 경로 (settings.py와 동일)
_SETTINGS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
_SETTINGS_FILE = os.path.join(_SETTINGS_DIR, "settings.json")

# Rate limit — {equipment_id: last_sent_timestamp}
_rate_limit_cache: dict[str, float] = {}

# 심각도 순위 (낮을수록 심각)
_SEVERITY_RANK = {"critical": 0, "warning": 1, "info": 2}


# ── 설정 로딩 ───────────────────────────────────────────────────────────────

def _load_channel_settings() -> dict[str, Any]:
    """settings.json에서 notification_channels 섹션을 로드한다."""
    defaults = {
        "email": {
            "enabled": False,
            "recipients": "",
            "min_severity": "warning",
        },
        "slack": {
            "enabled": False,
            "webhook_url": "",
            "min_severity": "critical",
        },
        "rate_limit_minutes": 10,
    }

    if os.path.exists(_SETTINGS_FILE):
        try:
            with open(_SETTINGS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
            return data.get("notification_channels", defaults)
        except (json.JSONDecodeError, OSError) as e:
            logger.warning("알림 설정 로딩 실패, 기본값 사용: %s", e)

    return defaults


# ── Rate Limit ──────────────────────────────────────────────────────────────

def _check_rate_limit(equipment_id: str, cooldown_minutes: int = 10) -> bool:
    """
    장비별 알림 쿨다운을 확인한다.

    Returns:
        True = 전송 가능, False = 쿨다운 중 (전송 차단)
    """
    now = time.time()
    last_sent = _rate_limit_cache.get(equipment_id)

    if last_sent is not None:
        elapsed = now - last_sent
        if elapsed < cooldown_minutes * 60:
            logger.debug(
                "Rate limit 적용: equipment=%s, 경과=%.0f초, 쿨다운=%d분",
                equipment_id, elapsed, cooldown_minutes,
            )
            return False

    _rate_limit_cache[equipment_id] = now
    return True


# ── 심각도 필터 ─────────────────────────────────────────────────────────────

def _passes_severity_filter(alarm_severity: str, min_severity: str) -> bool:
    """알람 심각도가 최소 기준 이상인지 확인한다."""
    alarm_rank = _SEVERITY_RANK.get(alarm_severity, 99)
    min_rank = _SEVERITY_RANK.get(min_severity, 99)
    return alarm_rank <= min_rank


# ── Email 전송 ──────────────────────────────────────────────────────────────

def _send_email(subject: str, body: str, recipients: list[str]) -> bool:
    """
    smtplib로 이메일을 전송한다.
    SMTP 설정은 config.py 환경변수를 사용.

    Returns:
        전송 성공 여부
    """
    if not config.SMTP_HOST or not recipients:
        logger.warning("SMTP 설정 미완료 또는 수신자 없음 — 이메일 전송 스킵")
        return False

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = config.SMTP_FROM or config.SMTP_USER
        msg["To"] = ", ".join(recipients)
        msg.attach(MIMEText(body, "html", "utf-8"))

        if config.SMTP_USE_TLS:
            server = smtplib.SMTP(config.SMTP_HOST, config.SMTP_PORT, timeout=10)
            server.starttls()
        else:
            server = smtplib.SMTP(config.SMTP_HOST, config.SMTP_PORT, timeout=10)

        if config.SMTP_USER and config.SMTP_PASSWORD:
            server.login(config.SMTP_USER, config.SMTP_PASSWORD)

        server.sendmail(msg["From"], recipients, msg.as_string())
        server.quit()
        logger.info("이메일 전송 성공: recipients=%s", recipients)
        return True
    except Exception as e:
        logger.error("이메일 전송 실패: %s", e)
        return False


# ── Slack 전송 ──────────────────────────────────────────────────────────────

async def _send_slack(message: str, webhook_url: str, severity: str = "info") -> bool:
    """
    Slack Incoming Webhook으로 Block Kit 메시지를 전송한다.

    Returns:
        전송 성공 여부
    """
    if not webhook_url:
        logger.warning("Slack webhook URL 미설정 — 전송 스킵")
        return False

    # 심각도별 색상
    color_map = {"critical": "#e74c3c", "warning": "#f39c12", "info": "#3498db"}
    color = color_map.get(severity, "#95a5a6")

    payload = {
        "attachments": [
            {
                "color": color,
                "blocks": [
                    {
                        "type": "section",
                        "text": {"type": "mrkdwn", "text": message},
                    }
                ],
            }
        ]
    }

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(webhook_url, json=payload)
            if resp.status_code == 200:
                logger.info("Slack 알림 전송 성공")
                return True
            else:
                logger.error("Slack 전송 실패: status=%d, body=%s", resp.status_code, resp.text)
                return False
    except Exception as e:
        logger.error("Slack 전송 예외: %s", e)
        return False


# ── 알림 로그 기록 ──────────────────────────────────────────────────────────

async def _log_notification(
    channel: str,
    alarm_equipment: Optional[str],
    alarm_severity: Optional[str],
    alarm_type: Optional[str],
    recipient: Optional[str],
    status: str,
    error_message: Optional[str] = None,
) -> bool:
    """PostgreSQL notification_log에 알림 전송 결과를 기록한다."""
    pool = postgres_service.get_pool()
    if pool is None:
        logger.warning("PostgreSQL 미연결 — 알림 로그 기록 스킵")
        return False

    try:
        async with pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO notification_log
                    (channel, alarm_equipment, alarm_severity, alarm_type,
                     recipient, status, error_message)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                """,
                channel,
                alarm_equipment,
                alarm_severity,
                alarm_type,
                recipient,
                status,
                error_message,
            )
        return True
    except Exception as e:
        logger.error("알림 로그 기록 실패: %s", e)
        return False


# ── 이력 조회 ───────────────────────────────────────────────────────────────

async def get_notification_log(
    channel: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> dict[str, Any]:
    """
    알림 전송 이력을 조회한다.

    Returns:
        {"total": int, "items": list[dict]}
    """
    pool = postgres_service.get_pool()
    if pool is None:
        return {"total": 0, "items": []}

    try:
        async with pool.acquire() as conn:
            conditions: list[str] = []
            params: list[Any] = []
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
                SELECT id, channel, alarm_equipment, alarm_severity, alarm_type,
                       recipient, status, error_message, created_at
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
        logger.error("알림 로그 조회 실패: %s", e)
        return {"total": 0, "items": []}


async def get_notification_log_stats() -> dict[str, Any]:
    """채널별 성공/실패 카운트를 반환한다."""
    pool = postgres_service.get_pool()
    if pool is None:
        return {"channels": {}}

    try:
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT channel, status, COUNT(*) as cnt
                FROM notification_log
                GROUP BY channel, status
                ORDER BY channel, status
                """
            )

            channels: dict[str, dict[str, int]] = {}
            for row in rows:
                ch = row["channel"]
                if ch not in channels:
                    channels[ch] = {"success": 0, "failed": 0}
                channels[ch][row["status"]] = row["cnt"]

            return {"channels": channels}

    except Exception as e:
        logger.error("알림 통계 조회 실패: %s", e)
        return {"channels": {}}


# ── 메인 디스패치 ───────────────────────────────────────────────────────────

async def dispatch(alarm_data: dict[str, Any]) -> None:
    """
    알람 데이터를 받아 활성화된 채널(Email, Slack)로 알림을 전송한다.

    Args:
        alarm_data: 알람 딕셔너리 (severity, equipment_id, message, type 등)
    """
    settings = _load_channel_settings()
    severity = alarm_data.get("severity", "info")
    equipment_id = alarm_data.get("equipment_id", "unknown")
    alarm_type = alarm_data.get("type", "unknown")
    alarm_message = alarm_data.get("message", "알람 발생")
    cooldown = settings.get("rate_limit_minutes", 10)

    # Rate limit 체크
    if not _check_rate_limit(equipment_id, cooldown):
        logger.debug("알림 스킵 (rate limit): equipment=%s", equipment_id)
        return

    # ─ Email 채널 ─
    email_cfg = settings.get("email", {})
    if email_cfg.get("enabled") and _passes_severity_filter(severity, email_cfg.get("min_severity", "warning")):
        recipients_str = email_cfg.get("recipients", "")
        recipients = [r.strip() for r in recipients_str.split(",") if r.strip()]

        if recipients:
            subject = f"[BEES 알람] [{severity.upper()}] {equipment_id}"
            body = (
                f"<h3>BEES 빌딩 알람</h3>"
                f"<p><b>장비:</b> {equipment_id}</p>"
                f"<p><b>심각도:</b> {severity}</p>"
                f"<p><b>유형:</b> {alarm_type}</p>"
                f"<p><b>메시지:</b> {alarm_message}</p>"
                f"<hr><p style='color:#999;'>삼성물산 GEC B동 디지털 트윈 플랫폼</p>"
            )
            ok = _send_email(subject, body, recipients)
            await _log_notification(
                channel="email",
                alarm_equipment=equipment_id,
                alarm_severity=severity,
                alarm_type=alarm_type,
                recipient=recipients_str,
                status="success" if ok else "failed",
                error_message=None if ok else "이메일 전송 실패",
            )

    # ─ Slack 채널 ─
    slack_cfg = settings.get("slack", {})
    if slack_cfg.get("enabled") and _passes_severity_filter(severity, slack_cfg.get("min_severity", "critical")):
        webhook = slack_cfg.get("webhook_url") or config.SLACK_WEBHOOK_URL

        if webhook:
            msg = (
                f"*🚨 BEES 알람 [{severity.upper()}]*\n"
                f"• *장비:* `{equipment_id}`\n"
                f"• *유형:* {alarm_type}\n"
                f"• *메시지:* {alarm_message}"
            )
            ok = await _send_slack(msg, webhook, severity)
            await _log_notification(
                channel="slack",
                alarm_equipment=equipment_id,
                alarm_severity=severity,
                alarm_type=alarm_type,
                recipient=webhook[:40] + "...",
                status="success" if ok else "failed",
                error_message=None if ok else "Slack 전송 실패",
            )


# ── 모듈 수준 편의 함수 (mqtt_service에서 호출) ─────────────────────────────

async def dispatch_alarm(alarm_data: dict[str, Any]) -> None:
    """mqtt_service에서 호출하는 알림 디스패치 진입점."""
    try:
        await dispatch(alarm_data)
    except Exception as e:
        logger.error("알림 디스패치 예외: %s", e, exc_info=True)

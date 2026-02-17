"""
시스템 설정 API 라우터

엔드포인트:
  GET /api/settings    — 전체 설정 조회
  PUT /api/settings    — 설정 수정 (Admin only)
"""

import json
import logging
import os
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.dependencies import CurrentUser, require_role

logger = logging.getLogger("server-a.settings")
router = APIRouter(prefix="/api/settings", tags=["설정"])

# 설정 파일 경로
SETTINGS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
SETTINGS_FILE = os.path.join(SETTINGS_DIR, "settings.json")

# 기본 설정값
DEFAULT_SETTINGS = {
    "building_name": "삼성물산 GEC B동",
    "timezone": "Asia/Seoul",
    "units": {
        "temperature": "°C",
        "pressure": "Pa",
        "flow": "m³/h",
        "power": "kW",
        "energy": "kWh",
    },
    "dashboard_refresh": 5,
    "energy_rate": 120.0,
    "floor_area": 60000,
    "alarm_config": {
        "temperature_high": 28.0,
        "temperature_low": 18.0,
        "humidity_high": 70.0,
        "humidity_low": 30.0,
        "co2_high": 1000.0,
    },
}


# ── 헬퍼 ─────────────────────────────────────────────────────────────────

def _load_settings() -> dict[str, Any]:
    """설정 파일 로딩. 없으면 기본값 반환."""
    if os.path.exists(SETTINGS_FILE):
        try:
            with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, OSError) as e:
            logger.warning("설정 파일 로딩 실패, 기본값 사용: %s", e)

    return dict(DEFAULT_SETTINGS)


def _save_settings(settings: dict[str, Any]) -> None:
    """설정 파일 저장."""
    os.makedirs(SETTINGS_DIR, exist_ok=True)
    with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
        json.dump(settings, f, ensure_ascii=False, indent=2)
    logger.info("설정 파일 저장 완료")


# ── Pydantic 스키마 ──────────────────────────────────────────────────────

class SettingsUpdate(BaseModel):
    """설정 수정 요청 (부분 업데이트)."""
    building_name: str | None = None
    timezone: str | None = None
    units: dict[str, str] | None = None
    dashboard_refresh: int | None = None
    energy_rate: float | None = None
    floor_area: float | None = None
    alarm_config: dict[str, float] | None = None


# ── API 엔드포인트 ────────────────────────────────────────────────────────

@router.get("")
async def get_settings() -> dict[str, Any]:
    """전체 설정 조회."""
    return _load_settings()


@router.put("")
async def update_settings(
    req: SettingsUpdate,
    current_user: CurrentUser = Depends(require_role("admin")),
) -> dict[str, Any]:
    """설정 수정 (Admin only). 전달된 필드만 업데이트."""
    current = _load_settings()

    update_data = req.model_dump(exclude_none=True)
    if not update_data:
        return current

    # 중첩 딕셔너리 병합
    for key, value in update_data.items():
        if isinstance(value, dict) and isinstance(current.get(key), dict):
            current[key].update(value)
        else:
            current[key] = value

    _save_settings(current)
    logger.info("설정 수정 완료 (by=%s): %s", current_user.email, list(update_data.keys()))

    return current

"""
에너지 분석 API 라우터

엔드포인트:
  GET /api/energy/realtime    — 현재 전력 소비 (시스템별 분류)
  GET /api/energy/profile     — 시간대별 에너지 프로파일
  GET /api/energy/breakdown   — 시스템별/층별 에너지 비율
  GET /api/energy/comparison  — 기간 비교
  GET /api/energy/eui         — EUI 지표
"""

import logging
import re
import time
from typing import Any

from fastapi import APIRouter, Query

from app.services import mqtt_service, influxdb_service
from app.services.energy_service import (
    get_realtime_energy,
    get_energy_profile,
    calculate_eui,
    POWER_POINT_PATTERNS,
    _get_base_kw,
    _classify_system,
    _extract_equipment_id,
    _ensure_floor_cache,
    _equipment_floor_cache,
    FLOOR_AREA_M2,
)

logger = logging.getLogger("server-a.energy")
router = APIRouter(prefix="/api/energy", tags=["에너지"])


@router.get("/realtime")
async def energy_realtime() -> dict[str, Any]:
    """
    현재 전력 소비 현황.
    MQTT 캐시에서 전력 추정 후 시스템별 분류.
    """
    return get_realtime_energy()


@router.get("/profile")
async def energy_profile(
    period: str = Query("24h", description="기간 (24h, 7d, 30d)"),
) -> dict[str, Any]:
    """
    시간대별 에너지 프로파일.
    InfluxDB에서 전력 데이터를 시간/일 단위로 집계.
    """
    return await get_energy_profile(period)


@router.get("/breakdown")
async def energy_breakdown() -> dict[str, Any]:
    """
    에너지 소비 비율 (시스템별/층별).
    MQTT 캐시 기반으로 현재 전력 분포 분석.
    """
    realtime = get_realtime_energy()
    breakdown = realtime.get("breakdown", {})

    by_system = [
        {"system": k, "kw": v}
        for k, v in sorted(breakdown.items(), key=lambda x: -x[1])
        if v > 0
    ]

    # 장비→층 매핑 캐시 로드
    await _ensure_floor_cache()

    # 층별 분석: MQTT 캐시에서 층 정보 추출 (Neo4j 매핑 폴백)
    point_cache = mqtt_service.get_point_cache()
    by_floor: dict[str, float] = {}
    for pid, data in point_cache.items():
        # Speed/kW 포인트만 사용
        if not any(pattern in pid for pattern, _ in POWER_POINT_PATTERNS[:3]):
            continue
        value = data.get("value")
        if not isinstance(value, (int, float)) or value <= 0:
            continue
        floor = _extract_floor(pid, _equipment_floor_cache)
        if floor:
            base_kw = _get_base_kw(pid)
            kw = (value / 100.0) * base_kw
            by_floor[floor] = by_floor.get(floor, 0.0) + kw

    return {
        "by_system": by_system,
        "by_floor": [
            {"floor": k, "kw": round(v, 2)}
            for k, v in sorted(by_floor.items())
        ],
        "timestamp": time.time(),
    }


@router.get("/comparison")
async def energy_comparison(
    period: str = Query("week", description="비교 기간 (week, month)"),
) -> dict[str, Any]:
    """
    현재 vs 이전 기간 에너지 비교.
    """
    period_map = {"week": ("7d", "14d"), "month": ("30d", "60d")}
    current_range, prev_range = period_map.get(period, ("7d", "14d"))

    # 전력 관련 포인트 수집
    point_cache = mqtt_service.get_point_cache()
    power_points = [
        pid for pid in point_cache
        if any(pattern in pid for pattern, _ in POWER_POINT_PATTERNS[:3])
    ]

    current_total = 0.0
    previous_total = 0.0

    if influxdb_service.is_connected():
        for pid in power_points[:20]:
            base_kw = _get_base_kw(pid)
            # 현재 기간
            cur_data = await influxdb_service.query_point_history(
                pid, f"-{current_range}", "now()", "sum", current_range,
            )
            for d in cur_data:
                if d.get("value") is not None:
                    current_total += (d["value"] / 100.0) * base_kw

            # 이전 기간
            prev_data = await influxdb_service.query_point_history(
                pid, f"-{prev_range}", f"-{current_range}", "sum", current_range,
            )
            for d in prev_data:
                if d.get("value") is not None:
                    previous_total += (d["value"] / 100.0) * base_kw

    change_pct = 0.0
    if previous_total > 0:
        change_pct = round((current_total - previous_total) / previous_total * 100, 1)

    return {
        "period": period,
        "current": {"total_kwh": round(current_total, 1)},
        "previous": {"total_kwh": round(previous_total, 1)},
        "change_pct": change_pct,
    }


@router.get("/eui")
async def energy_eui() -> dict[str, Any]:
    """
    EUI (Energy Use Intensity) 지표.
    연간 에너지 사용량(kWh) / 연면적(m²).
    """
    return calculate_eui()


# ── 내부 헬퍼 ─────────────────────────────────────────────────────────────

def _extract_floor(point_id: str, equip_floor_map: dict[str, str] | None = None) -> str | None:
    """포인트 ID에서 층 정보 추출 (예: AHU_5F_SAT → 5F).

    1차: 정규식으로 직접 추출
    2차: Neo4j 장비→층 매핑에서 찾기
    """
    match = re.search(r'(\d+F|B\d+F|RF)', point_id, re.IGNORECASE)
    if match:
        return match.group(1).upper()

    if equip_floor_map:
        local = point_id.replace("bldg:", "")
        equip_id = _extract_equipment_id(local)
        floor_key = equip_floor_map.get(equip_id)
        if floor_key:
            # B_5F → 5F, B_B1F → B1F
            return floor_key.replace("B_", "", 1)

    return None

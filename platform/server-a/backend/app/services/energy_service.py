"""
에너지 분석 서비스
에너지 데이터 분류, 집계, 비교 로직을 담당한다.

전력 추정 방식:
1. _kW 접미사 포인트 → 직접 kW 값 (에뮬레이터 정규화 0~100 → 스케일링)
2. Fan_Speed, _Speed 포인트 → 속도(%) 기반 부모 장비 전력 추정
3. Run_Status 포인트 → 장비 ON(1)/OFF(0) 기반 기본 전력 추정
"""

import logging
import time
from typing import Any

from app.services import mqtt_service, influxdb_service

logger = logging.getLogger("server-a.energy")

# 건물 연면적 (m²) — GEC B동
FLOOR_AREA_M2 = 60_000.0

# 에너지 벤치마크 (kWh/m²/yr)
BENCHMARK_EUI = 384.0

# 장비 타입별 기본 전력 용량 (kW) — 에뮬레이터 정규화 값 스케일링용
EQUIPMENT_BASE_KW: dict[str, float] = {
    "Chiller": 500.0,
    "AHU": 45.0,
    "Cooling_Tower": 30.0,
    "Boiler": 200.0,
    "MAU": 30.0,
    "PAC": 20.0,
    "Pump": 15.0,
    "Fan": 15.0,
    "VFD": 10.0,
    "Lighting": 8.0,
    "FCU": 5.0,
    "VAV": 3.0,
    "Transformer": 100.0,
}

# 시스템 분류 키워드
SYSTEM_KEYWORDS = {
    "hvac": ["AHU", "Chiller", "Boiler", "Pump", "Fan", "Cooling_Tower", "Heat_Exchanger", "VAV", "FCU", "MAU", "PAC", "UFAD", "DOAS"],
    "lighting": ["Lighting", "Luminaire", "Light"],
    "electrical": ["Electrical", "Transformer", "Panel", "Meter", "Power", "Elevator"],
}

# 전력 추정에 사용할 포인트 패턴 (우선순위 순)
POWER_POINT_PATTERNS = [
    ("_kW", "direct_kw"),          # 직접 kW 측정
    ("_SA_Fan_Speed", "speed"),    # AHU Supply Air Fan 속도
    ("Fan_Speed", "speed"),        # 일반 Fan 속도
    ("_Speed", "speed"),           # Pump 등 속도
    ("_Run_Status", "status"),     # 운전 상태 (1/0)
    ("Flame_Status", "status"),    # 보일러 화염 상태
]


def _get_base_kw(point_id: str) -> float:
    """포인트 ID에서 부모 장비 타입을 추정하여 기본 전력 용량(kW) 반환."""
    pid_upper = point_id.upper()
    for equip_type, base_kw in EQUIPMENT_BASE_KW.items():
        if equip_type.upper() in pid_upper:
            return base_kw
    return 10.0


def _classify_system(point_id: str) -> str:
    """포인트 ID를 기반으로 시스템 유형 분류."""
    pid_upper = point_id.upper()
    for system_type, keywords in SYSTEM_KEYWORDS.items():
        for kw in keywords:
            if kw.upper() in pid_upper:
                return system_type
    return "other"


def _extract_equipment_id(point_id: str) -> str:
    """포인트 ID에서 부모 장비 ID 추정.
    예: bldg:AHU_5_SA_Fan_Speed → AHU_5
        bldg:Chiller_1_kW → Chiller_1
        bldg:CHW_Pump_1_Speed → CHW_Pump_1
    """
    local = point_id.replace("bldg:", "")
    # 마지막 _접미사 제거하여 장비 ID 추출
    for pattern, _ in POWER_POINT_PATTERNS:
        suffix = pattern.lstrip("_")
        if local.endswith(suffix):
            return local[: -(len(suffix) + 1)]  # +1 for underscore
    return local


def get_realtime_energy() -> dict[str, Any]:
    """
    현재 전력 소비 (MQTT 캐시 기반).

    전력 추정 전략:
    1. _kW 포인트: 정규화 값(0~100) → (value/100) * base_kw
    2. _Speed 포인트: 속도(%) → (speed/100) * base_kw
    3. _Run_Status 포인트: ON=1 → base_kw * 0.7 (평균 부하율)
    동일 장비에 대해 가장 높은 우선순위 포인트만 사용 (중복 방지).
    """
    point_cache = mqtt_service.get_point_cache()

    # 장비별 가장 좋은 전력 추정 포인트 선택
    equipment_power: dict[str, dict[str, Any]] = {}
    priority_map = {"direct_kw": 0, "speed": 1, "status": 2}

    for pid, data in point_cache.items():
        value = data.get("value")
        if not isinstance(value, (int, float)):
            continue

        # 이 포인트가 전력 추정에 사용할 수 있는지 확인
        matched_type = None
        for pattern, ptype in POWER_POINT_PATTERNS:
            if pattern in pid:
                matched_type = ptype
                break

        if matched_type is None:
            continue

        equip_id = _extract_equipment_id(pid)
        existing = equipment_power.get(equip_id)
        if existing and priority_map.get(existing["type"], 99) <= priority_map.get(matched_type, 99):
            continue  # 기존 포인트가 더 높은 우선순위

        # kW 추정 계산
        base_kw = _get_base_kw(pid)
        if matched_type == "direct_kw":
            kw = (value / 100.0) * base_kw if value > 0 else 0.0
        elif matched_type == "speed":
            kw = (value / 100.0) * base_kw if value > 0 else 0.0
        elif matched_type == "status":
            kw = base_kw * 0.7 if value > 0 else 0.0
        else:
            kw = 0.0

        equipment_power[equip_id] = {
            "type": matched_type,
            "kw": kw,
            "system": _classify_system(pid),
            "point_id": pid,
            "ts": data.get("ts"),
        }

    # 합산
    total_kw = 0.0
    breakdown: dict[str, float] = {"hvac": 0.0, "lighting": 0.0, "electrical": 0.0, "other": 0.0}
    last_ts = None

    for equip_id, info in equipment_power.items():
        kw = info["kw"]
        total_kw += kw
        system = info["system"]
        breakdown[system] = breakdown.get(system, 0.0) + kw
        if info.get("ts"):
            last_ts = info["ts"]

    return {
        "total_kw": round(total_kw, 2),
        "breakdown": {k: round(v, 2) for k, v in breakdown.items()},
        "active_equipment": len([e for e in equipment_power.values() if e["kw"] > 0]),
        "monitored_equipment": len(equipment_power),
        "timestamp": last_ts or time.time(),
    }


async def get_energy_profile(period: str = "24h") -> dict[str, Any]:
    """
    시간대별 에너지 프로파일.
    InfluxDB에서 전력 관련 포인트 데이터 집계 + kW 스케일링.
    """
    window_map = {"24h": "1h", "7d": "6h", "30d": "1d"}
    window = window_map.get(period, "1h")

    if not influxdb_service.is_connected():
        return {"period": period, "data": [], "message": "InfluxDB 미연결"}

    try:
        # MQTT 캐시에서 kW 및 Speed 포인트 수집
        point_cache = mqtt_service.get_point_cache()
        power_points = [
            pid for pid in point_cache
            if any(pattern in pid for pattern, _ in POWER_POINT_PATTERNS[:3])
        ]

        data_points = []
        for pid in power_points[:20]:
            history = await influxdb_service.query_point_history(
                pid, f"-{period}", "now()", "mean", window,
            )
            base_kw = _get_base_kw(pid)
            for rec in history:
                if rec.get("value") is not None:
                    rec["value"] = round((rec["value"] / 100.0) * base_kw, 2)
                rec["system"] = _classify_system(pid)
            data_points.extend(history)

        return {
            "period": period,
            "window": window,
            "data": data_points,
            "power_point_count": len(power_points),
        }
    except Exception as e:
        logger.warning("에너지 프로파일 조회 실패: %s", e)
        return {"period": period, "data": [], "error": str(e)}


def calculate_eui(total_kwh_annual: float | None = None) -> dict[str, Any]:
    """
    EUI (Energy Use Intensity) 계산.
    EUI = 연간 에너지 사용량(kWh) / 연면적(m²)
    """
    # 실시간 데이터에서 연간 추정 (현재 전력 × 8760시간)
    if total_kwh_annual is None:
        realtime = get_realtime_energy()
        total_kw = realtime.get("total_kw", 0.0)
        total_kwh_annual = total_kw * 8760  # 연간 추정

    eui = total_kwh_annual / FLOOR_AREA_M2 if FLOOR_AREA_M2 > 0 else 0.0
    eui = round(eui, 1)

    # 등급 판정
    if eui <= BENCHMARK_EUI * 0.7:
        rating = "good"
    elif eui <= BENCHMARK_EUI:
        rating = "average"
    else:
        rating = "poor"

    return {
        "eui": eui,
        "total_kwh_annual": round(total_kwh_annual, 0),
        "floor_area_m2": FLOOR_AREA_M2,
        "benchmark": BENCHMARK_EUI,
        "rating": rating,
        "unit": "kWh/m²/yr",
    }

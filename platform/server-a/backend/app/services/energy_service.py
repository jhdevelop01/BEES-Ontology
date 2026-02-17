"""
에너지 분석 서비스
에너지 데이터 분류, 집계, 비교 로직을 담당한다.
"""

import logging
from typing import Any

from app.services import neo4j_service, mqtt_service, influxdb_service
from app.config import INFLUXDB_BUCKET, INFLUXDB_ORG

logger = logging.getLogger("server-a.energy")

# 건물 연면적 (m²) — GEC B동
FLOOR_AREA_M2 = 60_000.0

# 에너지 벤치마크 (kWh/m²/yr)
BENCHMARK_EUI = 384.0

# 시스템 분류 키워드
SYSTEM_KEYWORDS = {
    "hvac": ["AHU", "Chiller", "Boiler", "Pump", "Fan", "Cooling_Tower", "Heat_Exchanger", "VAV", "FCU", "MAU", "PAC"],
    "lighting": ["Lighting", "Luminaire", "Light"],
    "electrical": ["Electrical", "Transformer", "Panel", "Meter", "Power"],
}


def classify_system(point_id: str, labels: list[str] | None = None) -> str:
    """포인트 ID와 라벨을 기반으로 시스템 유형 분류."""
    text = point_id.upper()
    if labels:
        text += " " + " ".join(labels).upper()

    for system_type, keywords in SYSTEM_KEYWORDS.items():
        for kw in keywords:
            if kw.upper() in text:
                return system_type
    return "other"


def get_realtime_energy() -> dict[str, Any]:
    """
    현재 전력 소비 (MQTT 캐시 기반).
    Electrical_Power_Sensor 값 합산, 시스템별 분류.
    """
    point_cache = mqtt_service.get_point_cache()

    total_kw = 0.0
    breakdown: dict[str, float] = {"hvac": 0.0, "lighting": 0.0, "electrical": 0.0, "other": 0.0}

    for pid, data in point_cache.items():
        # 전력 관련 센서만 필터링
        if not any(kw in pid.lower() for kw in ["power", "kw", "watt", "energy"]):
            continue

        value = data.get("value")
        if not isinstance(value, (int, float)):
            continue

        total_kw += value
        system = classify_system(pid)
        breakdown[system] = breakdown.get(system, 0.0) + value

    import time
    return {
        "total_kw": round(total_kw, 2),
        "breakdown": {k: round(v, 2) for k, v in breakdown.items()},
        "timestamp": data.get("ts", time.time()) if point_cache else None,
    }


async def get_energy_profile(period: str = "24h") -> dict[str, Any]:
    """
    시간대별 에너지 프로파일.
    InfluxDB에서 전력 데이터 집계.
    """
    window_map = {"24h": "1h", "7d": "6h", "30d": "1d"}
    window = window_map.get(period, "1h")

    if not influxdb_service.is_connected():
        return {"period": period, "data": [], "message": "InfluxDB 미연결"}

    try:
        from influxdb_client.client.influxdb_client_async import InfluxDBClientAsync

        # 전력 센서 데이터 집계
        data = await influxdb_service.query_point_history(
            point_id="",  # 전체 전력 센서
            start=f"-{period}",
            stop="now()",
            aggregation="mean",
            window=window,
        )

        return {
            "period": period,
            "window": window,
            "data": data,
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

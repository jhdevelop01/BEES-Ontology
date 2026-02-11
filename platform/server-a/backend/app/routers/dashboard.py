"""
대시보드 API 라우터
KPI 요약 정보를 제공한다.
"""

import time
from typing import Any

from fastapi import APIRouter

from app.services import mqtt_service, neo4j_service

router = APIRouter(prefix="/api/dashboard", tags=["대시보드"])


@router.get("/summary")
async def get_dashboard_summary() -> dict[str, Any]:
    """
    대시보드 KPI 요약:
    - 활성 장비 수
    - 평균 온도 (온도 센서 평균)
    - 활성 알람 수
    - 시뮬레이션 상태
    """
    point_cache = mqtt_service.get_point_cache()
    device_cache = mqtt_service.get_device_cache()

    # 활성 장비 수 (MQTT에서 is_active=True인 장비)
    active_devices = sum(
        1 for d in device_cache.values() if d.get("is_active", False)
    )
    total_devices = len(device_cache) if device_cache else await neo4j_service.get_equipment_count()

    # 평균 온도 (Temperature 관련 센서값 평균)
    temp_values = [
        p["value"]
        for p in point_cache.values()
        if isinstance(p.get("value"), (int, float))
        and any(kw in p.get("point_id", "").lower() for kw in ["temp", "temperature"])
    ]
    avg_temperature = round(sum(temp_values) / len(temp_values), 1) if temp_values else 24.0

    # 활성 알람 수 (최근 이벤트에서 alarm 타입 카운트)
    alarm_count = mqtt_service.get_alarm_count()

    # 시뮬레이션 상태
    simulation_status = "running" if point_cache else "stopped"

    return {
        "kpi": {
            "active_devices": active_devices,
            "total_devices": total_devices,
            "avg_temperature": avg_temperature,
            "alarm_count": alarm_count,
            "simulation_status": simulation_status,
        },
        "devices": list(device_cache.values())[:10],
        "recent_points": [
            p for p in sorted(
                point_cache.values(),
                key=lambda x: x.get("ts", 0),
                reverse=True,
            )[:10]
        ],
        "timestamp": time.time(),
    }

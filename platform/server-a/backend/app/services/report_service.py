"""
보고서 생성 서비스
에너지, 장비 정비, 쾌적도, 알람 보고서 데이터 생성 로직.
"""

import csv
import io
import json
import logging
import time
import uuid
from datetime import datetime
from typing import Any

from app.services import influxdb_service, mqtt_service, postgres_service

logger = logging.getLogger("server-a.reports")

# 보고서 프리셋 정의
REPORT_PRESETS = [
    {
        "id": "energy_monthly",
        "name": "에너지 월간 보고서",
        "description": "월간 에너지 소비량, 시스템별 비율, EUI 지표 포함",
    },
    {
        "id": "maintenance_status",
        "name": "장비 정비 현황",
        "description": "전체 작업 주문 현황, 완료율, 담당자별 실적",
    },
    {
        "id": "comfort",
        "name": "쾌적도 보고서",
        "description": "층별 온도/습도 분포, 쾌적 범위 이탈 현황",
    },
    {
        "id": "alarm_summary",
        "name": "알람 요약 보고서",
        "description": "기간별 알람 발생 건수, 심각도별 분류, 장비별 빈도",
    },
]

# 생성된 보고서 캐시 (메모리)
_report_cache: dict[str, dict[str, Any]] = {}


def get_presets() -> list[dict[str, Any]]:
    """프리셋 목록 반환."""
    return REPORT_PRESETS


async def generate_report(
    preset_id: str | None,
    custom: dict[str, Any] | None,
    period_start: str,
    period_end: str,
    fmt: str = "json",
) -> dict[str, Any]:
    """
    보고서 데이터 생성.
    CSV/JSON 형식으로 반환.
    """
    report_id = str(uuid.uuid4())[:8]
    generated_at = datetime.utcnow().isoformat()

    if preset_id == "energy_monthly":
        data = await _generate_energy_report(period_start, period_end)
    elif preset_id == "maintenance_status":
        data = await _generate_maintenance_report(period_start, period_end)
    elif preset_id == "comfort":
        data = await _generate_comfort_report(period_start, period_end)
    elif preset_id == "alarm_summary":
        data = await _generate_alarm_report(period_start, period_end)
    elif custom:
        data = await _generate_custom_report(custom, period_start, period_end)
    else:
        data = {"error": "preset_id 또는 custom 필요"}

    # CSV 변환
    csv_content = None
    if fmt == "csv" and isinstance(data.get("rows"), list):
        csv_content = _to_csv(data["rows"])

    report = {
        "report_id": report_id,
        "preset_id": preset_id,
        "period": {"start": period_start, "end": period_end},
        "format": fmt,
        "status": "ready",
        "generated_at": generated_at,
        "data": data if fmt == "json" else None,
        "csv_content": csv_content,
    }

    _report_cache[report_id] = report
    logger.info("보고서 생성 완료: %s (preset=%s, format=%s)", report_id, preset_id, fmt)
    return report


def get_report(report_id: str) -> dict[str, Any] | None:
    """캐시에서 보고서 조회."""
    return _report_cache.get(report_id)


def get_report_history(page: int = 1, limit: int = 20) -> dict[str, Any]:
    """생성된 보고서 이력."""
    all_reports = sorted(
        _report_cache.values(),
        key=lambda r: r.get("generated_at", ""),
        reverse=True,
    )
    start = (page - 1) * limit
    end = start + limit
    items = [
        {k: v for k, v in r.items() if k not in ("data", "csv_content")}
        for r in all_reports[start:end]
    ]
    return {
        "items": items,
        "total": len(all_reports),
        "page": page,
        "pages": (len(all_reports) + limit - 1) // limit,
    }


# ── 내부 보고서 생성 함수 ──────────────────────────────────────────────────

async def _generate_energy_report(start: str, end: str) -> dict[str, Any]:
    """에너지 보고서 데이터."""
    point_cache = mqtt_service.get_point_cache()
    power_points = {
        pid: data for pid, data in point_cache.items()
        if any(kw in pid.lower() for kw in ["power", "kw", "watt"])
    }
    total_kw = sum(d.get("value", 0) for d in power_points.values() if isinstance(d.get("value"), (int, float)))
    return {
        "title": "에너지 월간 보고서",
        "total_kw": round(total_kw, 2),
        "power_point_count": len(power_points),
        "rows": [
            {"point_id": pid, "value_kw": round(d.get("value", 0), 2), "unit": d.get("unit", "")}
            for pid, d in power_points.items()
        ],
    }


async def _generate_maintenance_report(start: str, end: str) -> dict[str, Any]:
    """장비 정비 보고서 데이터."""
    pool = postgres_service.get_pool()
    if not pool:
        return {"title": "장비 정비 현황", "error": "PostgreSQL 미연결", "rows": []}

    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT wo.id, wo.title, wo.status, wo.priority, wo.created_at, wo.completed_at,
                   em.ontology_id, u.name AS assigned_to_name
            FROM work_orders wo
            LEFT JOIN equipment_metadata em ON wo.equipment_id = em.id
            LEFT JOIN users u ON wo.assigned_to = u.id
            ORDER BY wo.created_at DESC LIMIT 100
            """
        )

    items = []
    for r in rows:
        items.append({
            "id": r["id"],
            "title": r["title"],
            "status": r["status"],
            "priority": r["priority"],
            "equipment": r["ontology_id"],
            "assigned_to": r["assigned_to_name"],
            "created_at": r["created_at"].isoformat() if r["created_at"] else "",
            "completed_at": r["completed_at"].isoformat() if r["completed_at"] else "",
        })

    completed = sum(1 for i in items if i["status"] == "completed")
    return {
        "title": "장비 정비 현황",
        "total": len(items),
        "completed": completed,
        "completion_rate": round(completed / max(len(items), 1) * 100, 1),
        "rows": items,
    }


async def _generate_comfort_report(start: str, end: str) -> dict[str, Any]:
    """쾌적도 보고서 데이터."""
    point_cache = mqtt_service.get_point_cache()
    temp_data = []
    humidity_data = []
    for pid, data in point_cache.items():
        value = data.get("value")
        if not isinstance(value, (int, float)):
            continue
        if "temp" in pid.lower():
            temp_data.append({"point_id": pid, "value": value, "unit": "°C"})
        elif "humid" in pid.lower() or "rh" in pid.lower():
            humidity_data.append({"point_id": pid, "value": value, "unit": "%"})

    avg_temp = round(sum(d["value"] for d in temp_data) / max(len(temp_data), 1), 1)
    avg_humidity = round(sum(d["value"] for d in humidity_data) / max(len(humidity_data), 1), 1)

    return {
        "title": "쾌적도 보고서",
        "avg_temperature": avg_temp,
        "avg_humidity": avg_humidity,
        "temp_sensor_count": len(temp_data),
        "humidity_sensor_count": len(humidity_data),
        "rows": temp_data + humidity_data,
    }


async def _generate_alarm_report(start: str, end: str) -> dict[str, Any]:
    """알람 요약 보고서 데이터."""
    alarms = mqtt_service.get_alarm_cache()
    by_severity: dict[str, int] = {}
    by_equipment: dict[str, int] = {}
    for a in alarms:
        sev = a.get("severity", "unknown")
        by_severity[sev] = by_severity.get(sev, 0) + 1
        equip = a.get("equipment", "unknown")
        by_equipment[equip] = by_equipment.get(equip, 0) + 1

    return {
        "title": "알람 요약 보고서",
        "total_alarms": len(alarms),
        "by_severity": by_severity,
        "by_equipment": dict(sorted(by_equipment.items(), key=lambda x: -x[1])[:20]),
        "rows": [
            {"severity": a.get("severity"), "equipment": a.get("equipment"),
             "message": a.get("message", ""), "ts": a.get("ts")}
            for a in alarms
        ],
    }


async def _generate_custom_report(custom: dict[str, Any], start: str, end: str) -> dict[str, Any]:
    """사용자 정의 보고서."""
    return {
        "title": "사용자 정의 보고서",
        "custom_config": custom,
        "rows": [],
    }


def _to_csv(rows: list[dict[str, Any]]) -> str:
    """딕셔너리 리스트를 CSV 문자열로 변환."""
    if not rows:
        return ""
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=rows[0].keys())
    writer.writeheader()
    writer.writerows(rows)
    return output.getvalue()

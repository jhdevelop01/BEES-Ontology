"""
BEES Platform — Server D 장비 상태 API (InfluxDB)

엔드포인트:
  GET  /data/devices/summary              — 전체 장비 상태 현황
  GET  /data/devices/{device_id}/history   — 장비 상태 이력
"""

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from ..config import settings
from ..database import get_influx_query_api, run_influx_query
from ..models import (
    DeviceStateHistory,
    DeviceStateItem,
    DeviceStateRecord,
    DeviceStateSummary,
)

logger = logging.getLogger("server-d.devices")
router = APIRouter(prefix="/data/devices", tags=["장비 상태"])


# ─────────────────────────────────────────────
# GET /data/devices/summary — 전체 장비 상태 현황
# ─────────────────────────────────────────────

@router.get("/summary", response_model=DeviceStateSummary)
async def get_devices_summary(keyword: Optional[str] = Query(None, description="장비 ID 키워드 필터")):
    """전체 장비의 최신 ON/OFF 상태 및 모드 조회"""
    query_api = get_influx_query_api()
    if not query_api:
        raise HTTPException(status_code=503, detail="InfluxDB 미연결")

    try:
        flux_query = f'''
        from(bucket: "{settings.influxdb_bucket}")
          |> range(start: -5m)
          |> filter(fn: (r) => r._measurement == "device_state" and r._field == "is_active")
          |> group(columns: ["device_id"])
          |> last()
        '''

        tables = await run_influx_query(query_api, flux_query)

        devices: list[DeviceStateItem] = []
        for table in tables:
            for record in table.records:
                device_id = record.values.get("device_id", "unknown")
                if keyword and keyword.upper() not in device_id.upper():
                    continue
                is_active = record.get_value() >= 1.0
                devices.append(
                    DeviceStateItem(
                        device_id=device_id,
                        is_active=is_active,
                        mode=record.values.get("mode", "unknown"),
                        last_time=record.get_time().isoformat() if record.get_time() else None,
                    )
                )

        devices.sort(key=lambda d: d.device_id)
        active_count = sum(1 for d in devices if d.is_active)

        return DeviceStateSummary(
            total_devices=len(devices),
            active_count=active_count,
            inactive_count=len(devices) - active_count,
            devices=devices,
        )

    except Exception as e:
        logger.error("장비 상태 현황 조회 실패: %s", e)
        raise HTTPException(status_code=500, detail=f"장비 상태 조회 실패: {e}")


# ─────────────────────────────────────────────
# GET /data/devices/{device_id}/history — 장비 상태 이력
# ─────────────────────────────────────────────

@router.get("/{device_id}/history", response_model=DeviceStateHistory)
async def get_device_history(
    device_id: str,
    start: Optional[str] = Query(None, alias="from", description="시작 시각 (상대: -1h, -24h)"),
    end: Optional[str] = Query(None, alias="to", description="종료 시각"),
    aggregation: Optional[str] = Query(None, description="집계 윈도우 (1m, 5m, 1h)"),
):
    """특정 장비의 ON/OFF 상태 이력 조회"""
    query_api = get_influx_query_api()
    if not query_api:
        raise HTTPException(status_code=503, detail="InfluxDB 미연결")

    range_start = start if start else "-1h"
    range_stop = f", stop: {end}" if end else ""

    try:
        if aggregation:
            flux_query = f'''
            from(bucket: "{settings.influxdb_bucket}")
              |> range(start: {range_start}{range_stop})
              |> filter(fn: (r) => r._measurement == "device_state"
                                and r._field == "is_active"
                                and r.device_id == "{device_id}")
              |> aggregateWindow(every: {aggregation}, fn: max, createEmpty: false)
            '''
        else:
            flux_query = f'''
            from(bucket: "{settings.influxdb_bucket}")
              |> range(start: {range_start}{range_stop})
              |> filter(fn: (r) => r._measurement == "device_state"
                                and r._field == "is_active"
                                and r.device_id == "{device_id}")
            '''

        tables = await run_influx_query(query_api, flux_query)

        records: list[DeviceStateRecord] = []
        for table in tables:
            for record in table.records:
                records.append(
                    DeviceStateRecord(
                        time=record.get_time().isoformat() if record.get_time() else "",
                        is_active=record.get_value() >= 1.0,
                    )
                )

        # 가동률 계산
        uptime_ratio = None
        if records:
            active_count = sum(1 for r in records if r.is_active)
            uptime_ratio = round(active_count / len(records), 4)

        return DeviceStateHistory(
            device_id=device_id,
            records=records[-500:],  # 최대 500건
            count=len(records),
            uptime_ratio=uptime_ratio,
        )

    except Exception as e:
        logger.error("장비 상태 이력 조회 실패 (device_id=%s): %s", device_id, e)
        raise HTTPException(status_code=500, detail=f"장비 상태 이력 조회 실패: {e}")

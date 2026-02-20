"""
BEES Platform — Server D 시계열 데이터 API (InfluxDB)

엔드포인트:
  GET  /data/points/{id}/latest    — 최신값 조회
  GET  /data/points/{id}/history   — 시계열 조회 (from, to, aggregation)
  GET  /data/points/summary        — 전체 포인트 현황
  POST /data/points                — 단건 저장 (REST fallback)
"""

import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from influxdb_client import Point, WritePrecision
from influxdb_client.client.write_api import SYNCHRONOUS

from ..config import settings
from ..database import get_influx_client, get_influx_query_api
from ..models import (
    PointHistory,
    PointLatest,
    PointRecord,
    PointSummary,
    PointSummaryItem,
    PointWrite,
)

logger = logging.getLogger("server-d.points")
router = APIRouter(prefix="/data/points", tags=["시계열 데이터"])


# ─────────────────────────────────────────────
# GET /data/points/summary — 전체 포인트 현황
# (주의: summary 라우트를 {point_id} 위에 선언해야 path 충돌 방지)
# ─────────────────────────────────────────────

@router.get("/summary", response_model=PointSummary)
async def get_points_summary():
    """전체 포인트 현황 — 각 포인트의 최신값, 마지막 시각, 레코드 수"""
    query_api = get_influx_query_api()
    if not query_api:
        raise HTTPException(status_code=503, detail="InfluxDB 미연결")

    try:
        # 모든 고유 point_id의 최신 레코드 조회
        flux_query = f'''
        from(bucket: "{settings.influxdb_bucket}")
          |> range(start: -7d)
          |> filter(fn: (r) => r._measurement == "sensor_data" and r._field == "value")
          |> group(columns: ["point_id"])
          |> last()
        '''

        # 전체 레코드 수 집계 (개별 포인트별 카운트 대신 한 번만 쿼리)
        count_flux = f'''
        from(bucket: "{settings.influxdb_bucket}")
          |> range(start: -7d)
          |> filter(fn: (r) => r._measurement == "sensor_data" and r._field == "value")
          |> count()
          |> group()
          |> sum()
        '''

        tables = query_api.query(flux_query, org=settings.influxdb_org)

        points: list[PointSummaryItem] = []
        for table in tables:
            for record in table.records:
                points.append(
                    PointSummaryItem(
                        point_id=record.values.get("point_id", "unknown"),
                        last_value=record.get_value(),
                        last_time=record.get_time().isoformat() if record.get_time() else None,
                        unit=record.values.get("unit", ""),
                        record_count=0,  # 개별 카운트는 비용이 크므로 생략
                    )
                )

        # 전체 레코드 수 집계
        total_records = 0
        try:
            count_tables = query_api.query(count_flux, org=settings.influxdb_org)
            for table in count_tables:
                for record in table.records:
                    total_records = int(record.get_value())
        except Exception as e:
            logger.warning("전체 레코드 수 집계 실패 (무시): %s", e)

        return PointSummary(total_points=len(points), total_records=total_records, points=points)

    except Exception as e:
        logger.error("포인트 현황 조회 실패: %s", e)
        raise HTTPException(status_code=500, detail=f"포인트 현황 조회 실패: {e}")


# ─────────────────────────────────────────────
# GET /data/points/{point_id}/latest — 최신값
# ─────────────────────────────────────────────

@router.get("/{point_id}/latest", response_model=PointLatest)
async def get_point_latest(point_id: str):
    """특정 포인트의 최신 센서값 조회"""
    query_api = get_influx_query_api()
    if not query_api:
        raise HTTPException(status_code=503, detail="InfluxDB 미연결")

    try:
        flux_query = f'''
        from(bucket: "{settings.influxdb_bucket}")
          |> range(start: -7d)
          |> filter(fn: (r) => r._measurement == "sensor_data"
                            and r._field == "value"
                            and r.point_id == "{point_id}")
          |> last()
        '''
        tables = query_api.query(flux_query, org=settings.influxdb_org)

        for table in tables:
            for record in table.records:
                return PointLatest(
                    point_id=point_id,
                    value=record.get_value(),
                    time=record.get_time().isoformat() if record.get_time() else "",
                    unit=record.values.get("unit", ""),
                    quality=record.values.get("quality", ""),
                )

        raise HTTPException(status_code=404, detail=f"포인트 '{point_id}' 데이터 없음")

    except HTTPException:
        raise
    except Exception as e:
        logger.error("최신값 조회 실패 (point_id=%s): %s", point_id, e)
        raise HTTPException(status_code=500, detail=f"최신값 조회 실패: {e}")


# ─────────────────────────────────────────────
# GET /data/points/{point_id}/history — 시계열 조회
# ─────────────────────────────────────────────

@router.get("/{point_id}/history", response_model=PointHistory)
async def get_point_history(
    point_id: str,
    start: Optional[str] = Query(
        None,
        alias="from",
        description="시작 시각 (ISO 8601 또는 상대: -1h, -24h, -7d)",
    ),
    end: Optional[str] = Query(
        None,
        alias="to",
        description="종료 시각 (ISO 8601). 기본: 현재",
    ),
    aggregation: Optional[str] = Query(
        None,
        description="집계 윈도우 (예: 1m, 5m, 1h, 1d). 없으면 원시 데이터",
    ),
):
    """
    특정 포인트의 시계열 데이터 조회

    - from/to: ISO 8601 또는 상대 시간 (-1h, -24h, -7d 등)
    - aggregation: 집계 윈도우 크기 (1m, 5m, 1h, 1d). 없으면 원시 데이터 반환
    """
    query_api = get_influx_query_api()
    if not query_api:
        raise HTTPException(status_code=503, detail="InfluxDB 미연결")

    # 기본값: 최근 1시간
    range_start = start if start else "-1h"
    range_stop = f', stop: {end}' if end else ""

    try:
        if aggregation:
            # 집계 쿼리
            flux_query = f'''
            from(bucket: "{settings.influxdb_bucket}")
              |> range(start: {range_start}{range_stop})
              |> filter(fn: (r) => r._measurement == "sensor_data"
                                and r._field == "value"
                                and r.point_id == "{point_id}")
              |> aggregateWindow(every: {aggregation}, fn: mean, createEmpty: false)
              |> yield(name: "aggregated")
            '''
        else:
            # 원시 데이터 쿼리
            flux_query = f'''
            from(bucket: "{settings.influxdb_bucket}")
              |> range(start: {range_start}{range_stop})
              |> filter(fn: (r) => r._measurement == "sensor_data"
                                and r._field == "value"
                                and r.point_id == "{point_id}")
              |> yield(name: "raw")
            '''

        tables = query_api.query(flux_query, org=settings.influxdb_org)

        records: list[PointRecord] = []
        for table in tables:
            for record in table.records:
                records.append(
                    PointRecord(
                        time=record.get_time().isoformat() if record.get_time() else "",
                        value=record.get_value(),
                        quality=record.values.get("quality", None),
                    )
                )

        return PointHistory(
            point_id=point_id,
            records=records,
            count=len(records),
            aggregation=aggregation,
        )

    except Exception as e:
        logger.error("시계열 조회 실패 (point_id=%s): %s", point_id, e)
        raise HTTPException(status_code=500, detail=f"시계열 조회 실패: {e}")


# ─────────────────────────────────────────────
# POST /data/points — 단건 저장 (REST fallback)
# ─────────────────────────────────────────────

@router.post("", status_code=201)
async def write_point(data: PointWrite):
    """
    센서 데이터 단건 저장 (REST fallback)

    MQTT를 사용할 수 없는 경우를 위한 대체 엔드포인트.
    """
    influx_client = get_influx_client()
    if not influx_client:
        raise HTTPException(status_code=503, detail="InfluxDB 미연결")

    try:
        # 타임스탬프 파싱
        if data.ts:
            ts = datetime.fromisoformat(data.ts.replace("Z", "+00:00"))
        else:
            ts = datetime.now(timezone.utc)

        # InfluxDB Point 생성 및 저장
        point = (
            Point("sensor_data")
            .tag("point_id", data.point_id)
            .tag("unit", data.unit or "")
            .tag("quality", data.quality)
            .field("value", data.value)
            .time(ts, WritePrecision.NS)
        )

        write_api = influx_client.write_api(write_options=SYNCHRONOUS)
        write_api.write(
            bucket=settings.influxdb_bucket,
            org=settings.influxdb_org,
            record=point,
        )

        logger.info("단건 저장 완료: point_id=%s, value=%s", data.point_id, data.value)
        return {
            "status": "ok",
            "point_id": data.point_id,
            "value": data.value,
            "time": ts.isoformat(),
        }

    except Exception as e:
        logger.error("단건 저장 실패: %s", e)
        raise HTTPException(status_code=500, detail=f"데이터 저장 실패: {e}")

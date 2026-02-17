"""
데이터 내보내기 API 라우터

엔드포인트:
  GET /export — 시계열 데이터 CSV/JSON 내보내기
"""

import csv
import io
import json
import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse

from ..config import settings
from ..database import get_influx_query_api

logger = logging.getLogger("server-d.export")
router = APIRouter(prefix="/export", tags=["데이터 내보내기"])


@router.get("")
async def export_data(
    format: str = Query("csv", description="출력 형식 (csv, json)"),
    start: str = Query("-24h", description="시작 시간 (상대: -24h, -7d 또는 ISO 8601)"),
    end: Optional[str] = Query(None, description="종료 시간 (ISO 8601, 기본: 현재)"),
    equipment: Optional[str] = Query(None, description="장비 필터 (예: bldg:AHU_5F)"),
    points: Optional[str] = Query(None, description="포인트 ID 목록 (콤마 구분)"),
    aggregation: Optional[str] = Query(None, description="집계 윈도우 (1m, 5m, 1h)"),
):
    """
    시계열 데이터 내보내기.
    InfluxDB에서 조회하여 CSV 또는 JSON 형식으로 스트리밍 반환.
    """
    query_api = get_influx_query_api()
    if not query_api:
        raise HTTPException(status_code=503, detail="InfluxDB 미연결")

    # 필터 조건 구성
    filters = ['r._measurement == "sensor_data"', 'r._field == "value"']

    if points:
        point_list = [p.strip() for p in points.split(",")]
        point_filter = " or ".join(f'r.point_id == "{p}"' for p in point_list)
        filters.append(f"({point_filter})")
    elif equipment:
        # 장비 ID에서 prefix 매칭
        equip_name = equipment.replace("bldg:", "")
        filters.append(f'r.point_id =~ /.*{equip_name}.*/')

    filter_clause = " and ".join(filters)

    # stop 절 구성
    stop_clause = ""
    if end:
        stop_clause = f', stop: time(v: "{end}")'

    # 집계
    if aggregation:
        agg_clause = f'|> aggregateWindow(every: {aggregation}, fn: mean, createEmpty: false)'
    else:
        agg_clause = ""

    # start 처리
    if start.startswith("-"):
        start_expr = start
    else:
        start_expr = f'time(v: "{start}")'

    flux_query = f'''
        from(bucket: "{settings.influxdb_bucket}")
          |> range(start: {start_expr}{stop_clause})
          |> filter(fn: (r) => {filter_clause})
          {agg_clause}
          |> sort(columns: ["_time"])
    '''

    try:
        tables = query_api.query(flux_query, org=settings.influxdb_org)
    except Exception as e:
        logger.error("InfluxDB 내보내기 쿼리 실패: %s", e)
        raise HTTPException(status_code=500, detail=f"데이터 조회 실패: {e}")

    # 결과 정리
    records = []
    for table in tables:
        for record in table.records:
            records.append({
                "time": record.get_time().isoformat() if record.get_time() else "",
                "point_id": record.values.get("point_id", ""),
                "value": record.get_value(),
                "unit": record.values.get("unit", ""),
                "quality": record.values.get("quality", ""),
            })

    if format == "csv":
        return _stream_csv(records)
    else:
        return _stream_json(records)


def _stream_csv(records: list[dict]) -> StreamingResponse:
    """CSV 스트리밍 응답."""
    def generate():
        output = io.StringIO()
        if records:
            writer = csv.DictWriter(output, fieldnames=records[0].keys())
            writer.writeheader()
            yield output.getvalue()
            output.truncate(0)
            output.seek(0)

            for row in records:
                writer.writerow(row)
                yield output.getvalue()
                output.truncate(0)
                output.seek(0)

    return StreamingResponse(
        generate(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=bees_export.csv"},
    )


def _stream_json(records: list[dict]) -> StreamingResponse:
    """JSON 스트리밍 응답."""
    content = json.dumps({
        "total": len(records),
        "records": records,
    }, ensure_ascii=False, indent=2)

    return StreamingResponse(
        iter([content]),
        media_type="application/json",
        headers={"Content-Disposition": "attachment; filename=bees_export.json"},
    )

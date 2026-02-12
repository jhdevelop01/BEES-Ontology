"""
InfluxDB 직접 조회 서비스
Server D 프록시 없이 InfluxDB에서 시계열 데이터를 직접 조회한다.
measurement: sensor_data, tag: point_id/unit/quality, field: value
"""

import logging
from typing import Any

from app.config import INFLUXDB_URL, INFLUXDB_TOKEN, INFLUXDB_ORG, INFLUXDB_BUCKET

logger = logging.getLogger(__name__)

_client = None
_query_api = None


async def connect() -> None:
    """InfluxDB 클라이언트 초기화"""
    global _client, _query_api
    try:
        from influxdb_client.client.influxdb_client_async import InfluxDBClientAsync

        _client = InfluxDBClientAsync(
            url=INFLUXDB_URL,
            token=INFLUXDB_TOKEN,
            org=INFLUXDB_ORG,
        )
        _query_api = _client.query_api()
        # 연결 확인
        ready = await _client.ping()
        if ready:
            logger.info("InfluxDB 연결 성공: %s", INFLUXDB_URL)
        else:
            logger.warning("InfluxDB ping 실패: %s", INFLUXDB_URL)
            _client = None
            _query_api = None
    except Exception as e:
        logger.warning("InfluxDB 연결 실패 (Server D 프록시 폴백 가능): %s", e)
        _client = None
        _query_api = None


async def disconnect() -> None:
    """InfluxDB 클라이언트 종료"""
    global _client, _query_api
    if _client:
        await _client.close()
        _client = None
        _query_api = None
        logger.info("InfluxDB 연결 종료")


def is_connected() -> bool:
    """InfluxDB 연결 상태"""
    return _query_api is not None


async def query_point_history(
    point_id: str,
    start: str = "-1h",
    stop: str = "now()",
    aggregation: str = "mean",
    window: str = "1m",
) -> list[dict[str, Any]]:
    """
    InfluxDB에서 포인트 시계열 데이터 조회.
    미연결 시 빈 리스트 반환 (history.py에서 Server D 폴백).
    """
    if not _query_api:
        return []

    try:
        # stop 처리: "now()"는 Flux에서 그대로, ISO 형식은 time() 래핑
        stop_clause = ""
        if stop and stop != "now()":
            stop_clause = f', stop: time(v: "{stop}")'

        # start 처리: 상대시간(-1h)은 그대로, ISO 형식은 time() 래핑
        if start.startswith("-"):
            start_expr = start
        else:
            start_expr = f'time(v: "{start}")'

        # 집계 쿼리
        if window and window != "raw":
            flux = f'''
                from(bucket: "{INFLUXDB_BUCKET}")
                  |> range(start: {start_expr}{stop_clause})
                  |> filter(fn: (r) => r._measurement == "sensor_data"
                                    and r._field == "value"
                                    and r.point_id == "{point_id}")
                  |> aggregateWindow(every: {window}, fn: {aggregation}, createEmpty: false)
                  |> yield(name: "aggregated")
            '''
        else:
            flux = f'''
                from(bucket: "{INFLUXDB_BUCKET}")
                  |> range(start: {start_expr}{stop_clause})
                  |> filter(fn: (r) => r._measurement == "sensor_data"
                                    and r._field == "value"
                                    and r.point_id == "{point_id}")
                  |> yield(name: "raw")
            '''

        tables = await _query_api.query(flux, org=INFLUXDB_ORG)

        results = []
        for table in tables:
            for record in table.records:
                results.append({
                    "point_id": point_id,
                    "value": record.get_value(),
                    "ts": record.get_time().timestamp() if record.get_time() else None,
                    "unit": record.values.get("unit", ""),
                    "quality": record.values.get("quality", "good"),
                })

        return results

    except Exception as e:
        logger.warning("InfluxDB 시계열 조회 실패: %s — %s", point_id, e)
        return []


async def get_point_latest(point_id: str) -> dict[str, Any] | None:
    """InfluxDB에서 포인트 최신값 조회. 미연결 시 None 반환."""
    if not _query_api:
        return None

    try:
        flux = f'''
            from(bucket: "{INFLUXDB_BUCKET}")
              |> range(start: -7d)
              |> filter(fn: (r) => r._measurement == "sensor_data"
                                and r._field == "value"
                                and r.point_id == "{point_id}")
              |> last()
        '''

        tables = await _query_api.query(flux, org=INFLUXDB_ORG)

        for table in tables:
            for record in table.records:
                return {
                    "point_id": point_id,
                    "value": record.get_value(),
                    "ts": record.get_time().timestamp() if record.get_time() else None,
                    "unit": record.values.get("unit", ""),
                    "quality": record.values.get("quality", "good"),
                }

        return None

    except Exception as e:
        logger.warning("InfluxDB 최신값 조회 실패: %s — %s", point_id, e)
        return None

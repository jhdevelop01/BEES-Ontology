"""
InfluxDB 서비스 (선택적 — Server D 경유 가능)
직접 InfluxDB에 연결하여 시계열 데이터를 조회한다.
Phase 1에서는 Server D 프록시를 주로 사용하며, 이 서비스는 보조 용도.
"""

import logging
from typing import Any

from app.config import INFLUXDB_URL, INFLUXDB_TOKEN, INFLUXDB_ORG, INFLUXDB_BUCKET

logger = logging.getLogger(__name__)

# Phase 1에서는 InfluxDB 직접 연결을 최소화하고 Server D 경유를 권장.
# 이 모듈은 필요 시 직접 쿼리용으로 확장 가능.


async def query_point_history(
    point_id: str,
    start: str = "-1h",
    stop: str = "now()",
    aggregation: str = "mean",
    window: str = "1m",
) -> list[dict[str, Any]]:
    """
    InfluxDB에서 포인트 시계열 데이터 조회.
    Phase 1에서는 스텁 — Server D 프록시를 통해 조회하는 것을 권장.
    """
    logger.info(
        "InfluxDB 쿼리 (스텁): point=%s, start=%s, stop=%s",
        point_id, start, stop,
    )
    # TODO: Phase 2에서 influxdb-client 직접 연결 구현
    # from influxdb_client.client.influxdb_client_async import InfluxDBClientAsync
    return []


async def get_point_latest(point_id: str) -> dict[str, Any] | None:
    """InfluxDB에서 포인트 최신값 조회 (스텁)"""
    logger.info("InfluxDB 최신값 조회 (스텁): point=%s", point_id)
    return None

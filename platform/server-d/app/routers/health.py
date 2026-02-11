"""
BEES Platform — Server D 헬스 체크 API

엔드포인트:
  GET /health — 서비스 상태 확인 (InfluxDB, PostgreSQL, MQTT)
"""

import logging
import time

from fastapi import APIRouter

from ..database import get_influx_client, get_pg_pool
from ..models import HealthCheck
from ..mqtt_worker import mqtt_worker

logger = logging.getLogger("server-d.health")
router = APIRouter(tags=["헬스 체크"])

# 서버 시작 시각 (uptime 계산용)
_start_time: float = time.time()


def set_start_time(t: float) -> None:
    """서버 시작 시각 설정"""
    global _start_time
    _start_time = t


@router.get("/health", response_model=HealthCheck)
async def health_check():
    """
    서비스 헬스 체크

    각 의존 서비스(InfluxDB, PostgreSQL, MQTT)의 연결 상태를 확인하고
    전체 서비스 상태를 반환한다.
    """
    influx_status = "disconnected"
    postgres_status = "disconnected"
    mqtt_status = "disconnected"
    overall_status = "ok"

    # ── InfluxDB 상태 확인 ──
    influx_client = get_influx_client()
    if influx_client:
        try:
            health = influx_client.health()
            influx_status = health.status if health else "unknown"
        except Exception as e:
            influx_status = f"error: {e}"
            logger.warning("InfluxDB 헬스 체크 실패: %s", e)
    else:
        influx_status = "not_initialized"

    # ── PostgreSQL 상태 확인 ──
    pool = get_pg_pool()
    if pool:
        try:
            async with pool.acquire() as conn:
                await conn.fetchval("SELECT 1")
            postgres_status = "pass"
        except Exception as e:
            postgres_status = f"error: {e}"
            logger.warning("PostgreSQL 헬스 체크 실패: %s", e)
    else:
        postgres_status = "not_initialized"

    # ── MQTT 상태 확인 ──
    if mqtt_worker.is_mqtt_connected:
        mqtt_status = "connected"
    else:
        mqtt_status = "disconnected"

    # ── 전체 상태 판정 ──
    if "error" in influx_status or "error" in postgres_status:
        overall_status = "degraded"
    if influx_status == "not_initialized" and postgres_status == "not_initialized":
        overall_status = "starting"

    uptime = time.time() - _start_time

    return HealthCheck(
        status=overall_status,
        service="server-d",
        version="1.0.0",
        influxdb=influx_status,
        postgres=postgres_status,
        mqtt=mqtt_status,
        uptime_seconds=round(uptime, 1),
    )

"""
BEES Platform — Server D 데이터베이스 연결 관리
InfluxDB (시계열) + PostgreSQL (관리 데이터)
"""

import logging
from typing import Optional

import asyncpg
from influxdb_client import InfluxDBClient
from influxdb_client.client.query_api import QueryApi

from .config import settings

logger = logging.getLogger("server-d.database")


# ─────────────────────────────────────────────
# PostgreSQL 커넥션 풀
# ─────────────────────────────────────────────

_pg_pool: Optional[asyncpg.Pool] = None


async def init_postgres() -> asyncpg.Pool:
    """PostgreSQL 커넥션 풀 초기화"""
    global _pg_pool
    try:
        _pg_pool = await asyncpg.create_pool(
            dsn=settings.database_url,
            min_size=2,
            max_size=10,
            command_timeout=30,
        )
        logger.info("PostgreSQL 커넥션 풀 초기화 완료: %s", settings.database_url)
        return _pg_pool
    except Exception as e:
        logger.error("PostgreSQL 연결 실패: %s", e)
        raise


async def close_postgres() -> None:
    """PostgreSQL 커넥션 풀 종료"""
    global _pg_pool
    if _pg_pool:
        await _pg_pool.close()
        _pg_pool = None
        logger.info("PostgreSQL 커넥션 풀 종료 완료")


def get_pg_pool() -> Optional[asyncpg.Pool]:
    """현재 PostgreSQL 커넥션 풀 반환"""
    return _pg_pool


# ─────────────────────────────────────────────
# InfluxDB 클라이언트 (쿼리용)
# ─────────────────────────────────────────────

_influx_client: Optional[InfluxDBClient] = None
_influx_query_api: Optional[QueryApi] = None


def init_influxdb() -> InfluxDBClient:
    """InfluxDB 쿼리 클라이언트 초기화 (REST API 조회용)"""
    global _influx_client, _influx_query_api
    try:
        _influx_client = InfluxDBClient(
            url=settings.influxdb_url,
            token=settings.influxdb_token,
            org=settings.influxdb_org,
        )
        _influx_query_api = _influx_client.query_api()
        logger.info("InfluxDB 쿼리 클라이언트 초기화 완료: %s", settings.influxdb_url)
        return _influx_client
    except Exception as e:
        logger.error("InfluxDB 연결 실패: %s", e)
        raise


def close_influxdb() -> None:
    """InfluxDB 클라이언트 종료"""
    global _influx_client, _influx_query_api
    if _influx_client:
        _influx_client.close()
        _influx_client = None
        _influx_query_api = None
        logger.info("InfluxDB 클라이언트 종료 완료")


def get_influx_client() -> Optional[InfluxDBClient]:
    """현재 InfluxDB 클라이언트 반환"""
    return _influx_client


def get_influx_query_api() -> Optional[QueryApi]:
    """현재 InfluxDB 쿼리 API 반환"""
    return _influx_query_api

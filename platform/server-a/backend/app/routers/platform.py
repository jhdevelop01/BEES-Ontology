"""
플랫폼 전체 상태 API 라우터
Server A~D 및 인프라(Neo4j, MQTT, InfluxDB, PostgreSQL) 헬스를 집계하여 반환한다.
"""

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any

import httpx
from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.config import SERVER_B_URL, SERVER_C_URL, SERVER_D_URL
from app.services import neo4j_service, mqtt_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/platform", tags=["플랫폼"])

_TIMEOUT = 3.0  # 외부 서버 호출 타임아웃 (초)


# ── 응답 모델 ──

class ServerStatus(BaseModel):
    status: str = Field(..., description="online / offline / degraded")
    port: int = Field(..., description="호스트 포트")
    role: str = Field(..., description="서버 역할")
    details: dict[str, Any] = Field(default_factory=dict, description="서버 헬스 응답 원본")


class InfraStatus(BaseModel):
    status: str = Field(..., description="online / offline / unknown")
    port: int = Field(..., description="호스트 포트")


class PlatformHealthResponse(BaseModel):
    servers: dict[str, ServerStatus]
    infrastructure: dict[str, InfraStatus]
    timestamp: str = Field(..., description="ISO 8601 타임스탬프")


# ── 내부 헬퍼 ──

async def _fetch_server_health(url: str) -> dict[str, Any] | None:
    """외부 서버의 /health 호출. 실패 시 None 반환."""
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.get(f"{url}/health")
            resp.raise_for_status()
            return resp.json()
    except Exception as e:
        logger.warning("서버 헬스 조회 실패 (%s): %s", url, e)
        return None


def _make_server_status(
    data: dict[str, Any] | None,
    port: int,
    role: str,
) -> ServerStatus:
    """헬스 응답을 ServerStatus로 변환."""
    if data is None:
        return ServerStatus(status="offline", port=port, role=role, details={})
    status = data.get("status", "unknown")
    if status in ("healthy", "ok"):
        status = "online"
    return ServerStatus(status=status, port=port, role=role, details=data)


async def _check_neo4j() -> InfraStatus:
    """Neo4j 연결 상태를 간접 확인 (RETURN 1 쿼리)."""
    try:
        result = await neo4j_service.run_cypher("RETURN 1 AS n")
        if result and "error" not in result[0]:
            return InfraStatus(status="online", port=7689)
    except Exception:
        pass
    return InfraStatus(status="offline", port=7689)


def _check_mqtt() -> InfraStatus:
    """Server A 자체 MQTT 클라이언트 연결 상태 확인."""
    client = mqtt_service._client
    if client is not None and client.is_connected():
        return InfraStatus(status="online", port=1885)
    return InfraStatus(status="offline", port=1885)


def _infer_influxdb(server_d_data: dict[str, Any] | None) -> InfraStatus:
    """Server D 응답에서 InfluxDB 상태 추론."""
    if server_d_data is None:
        return InfraStatus(status="unknown", port=8088)
    influx = server_d_data.get("influxdb", "")
    if influx in ("pass", "healthy"):
        return InfraStatus(status="online", port=8088)
    if "error" in str(influx):
        return InfraStatus(status="offline", port=8088)
    return InfraStatus(status="unknown", port=8088)


def _infer_postgresql(server_d_data: dict[str, Any] | None) -> InfraStatus:
    """Server D 응답에서 PostgreSQL 상태 추론."""
    if server_d_data is None:
        return InfraStatus(status="unknown", port=5434)
    pg = server_d_data.get("postgres", "")
    if pg in ("pass", "healthy"):
        return InfraStatus(status="online", port=5434)
    if "error" in str(pg):
        return InfraStatus(status="offline", port=5434)
    return InfraStatus(status="unknown", port=5434)


# ── 엔드포인트 ──

@router.get("/health", response_model=PlatformHealthResponse)
async def platform_health():
    """
    플랫폼 전체 헬스 집계.

    Server A~D + Neo4j/MQTT/InfluxDB/PostgreSQL 상태를 한 번에 반환한다.
    개별 서버 장애 시에도 나머지 상태는 정상 반환된다 (3초 타임아웃).
    """
    # Server B, C, D 헬스를 동시 호출
    results = await asyncio.gather(
        _fetch_server_health(SERVER_B_URL),
        _fetch_server_health(SERVER_C_URL),
        _fetch_server_health(SERVER_D_URL),
        return_exceptions=True,
    )

    server_b_data = results[0] if not isinstance(results[0], BaseException) else None
    server_c_data = results[1] if not isinstance(results[1], BaseException) else None
    server_d_data = results[2] if not isinstance(results[2], BaseException) else None

    # Server A는 자기 자신 — 이 코드가 실행 중이면 online
    server_a = ServerStatus(
        status="online",
        port=8010,
        role="API Gateway",
        details={"service": "server-a-backend", "version": "1.0.0"},
    )

    # Neo4j + MQTT 상태 (Neo4j는 비동기)
    neo4j_status = await _check_neo4j()
    mqtt_status = _check_mqtt()

    return PlatformHealthResponse(
        servers={
            "server_a": server_a,
            "server_b": _make_server_status(server_b_data, 8011, "BAS Adapter"),
            "server_c": _make_server_status(server_c_data, 8012, "Emulator"),
            "server_d": _make_server_status(server_d_data, 8013, "Historian"),
        },
        infrastructure={
            "neo4j": neo4j_status,
            "mqtt": mqtt_status,
            "influxdb": _infer_influxdb(server_d_data),
            "postgresql": _infer_postgresql(server_d_data),
        },
        timestamp=datetime.now(timezone.utc).isoformat(),
    )

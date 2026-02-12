"""
Server B — BAS Adapter (Protocol Gateway)
==========================================
Server A로부터 제어 명령을 수신하여 Server C(가상 건물 에뮬레이터)로 전달하는
프로토콜 게이트웨이. Phase 1에서는 REST-to-REST 패스스루 방식.

주요 기능:
  - POST /command        : 제어 명령 수신 → Server C 전달 → MQTT 발행 → 감사 로그
  - GET  /devices        : 디바이스 레지스트리 전체 조회
  - GET  /devices/{id}/status : Server C에서 장비 상태 조회
  - GET  /health         : 헬스체크
  - GET  /audit-log      : 명령 감사 로그 조회 (최근 100건)
"""

from __future__ import annotations

import json
import logging
import os
import sys
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

import asyncpg
import httpx
import paho.mqtt.client as mqtt
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from app.config import settings
from app.device_registry import registry
from app.neo4j_loader import load_devices_from_neo4j

# ---------------------------------------------------------------------------
# 로깅 설정
# ---------------------------------------------------------------------------
log_dir = Path(settings.LOG_DIR)
log_dir.mkdir(parents=True, exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(log_dir / "server_b.log", encoding="utf-8"),
    ],
)
logger = logging.getLogger("server-b")

# ---------------------------------------------------------------------------
# 전역 리소스 (lifespan에서 초기화/정리)
# ---------------------------------------------------------------------------
_mqtt_client: Optional[mqtt.Client] = None
_pg_pool: Optional[asyncpg.Pool] = None
_http_client: Optional[httpx.AsyncClient] = None

# 로컬 인메모리 감사 로그 (PostgreSQL 미연결 시 폴백)
_local_audit_log: list[dict[str, Any]] = []
MAX_LOCAL_AUDIT = 500


# ---------------------------------------------------------------------------
# Pydantic 모델
# ---------------------------------------------------------------------------
class CommandRequest(BaseModel):
    """제어 명령 요청 스키마."""
    deviceId: str = Field(..., description="온톨로지 장비 ID (예: bldg:AHU_5F)")
    command: str = Field(..., description="명령어 (ON, OFF, setpoint)")
    params: dict[str, Any] = Field(default_factory=dict, description="추가 파라미터")
    userId: int = Field(..., description="요청 사용자 ID")


class CommandResponse(BaseModel):
    """제어 명령 응답 스키마."""
    success: bool
    deviceId: str
    command: str
    message: str
    server_c_response: Optional[dict[str, Any]] = None
    timestamp: str


class HealthResponse(BaseModel):
    """헬스체크 응답."""
    status: str
    service: str = "server-b"
    version: str = "1.0.0"
    registered_devices: int
    mqtt_connected: bool
    db_connected: bool
    timestamp: str


# ---------------------------------------------------------------------------
# MQTT 헬퍼
# ---------------------------------------------------------------------------
def _init_mqtt() -> mqtt.Client:
    """MQTT 클라이언트를 초기화하고 브로커에 연결한다."""
    client = mqtt.Client(
        client_id=settings.MQTT_CLIENT_ID,
        callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
    )

    def on_connect(client: mqtt.Client, userdata: Any, flags: Any, rc: Any, properties: Any = None) -> None:
        if hasattr(rc, 'value'):
            rc_val = rc.value
        else:
            rc_val = rc
        if rc_val == 0:
            logger.info("MQTT 브로커 연결 성공: %s:%s", settings.MQTT_BROKER, settings.MQTT_PORT)
        else:
            logger.warning("MQTT 브로커 연결 실패 (rc=%s)", rc_val)

    def on_disconnect(client: mqtt.Client, userdata: Any, flags: Any = None, rc: Any = None, properties: Any = None) -> None:
        logger.warning("MQTT 브로커 연결 해제")

    client.on_connect = on_connect
    client.on_disconnect = on_disconnect

    try:
        client.connect(settings.MQTT_BROKER, settings.MQTT_PORT, keepalive=60)
        client.loop_start()
        logger.info("MQTT 클라이언트 시작")
    except Exception as e:
        logger.error("MQTT 연결 실패: %s (서비스는 계속 실행)", e)

    return client


def _publish_mqtt(device_id: str, payload: dict[str, Any]) -> bool:
    """MQTT 토픽에 메시지를 발행한다. 실패 시 False 반환."""
    global _mqtt_client
    if _mqtt_client is None or not _mqtt_client.is_connected():
        logger.warning("MQTT 클라이언트 미연결 — 메시지 발행 스킵")
        return False

    topic = f"bees/commands/{device_id}"
    try:
        result = _mqtt_client.publish(
            topic,
            json.dumps(payload, ensure_ascii=False),
            qos=1,
        )
        if result.rc == mqtt.MQTT_ERR_SUCCESS:
            logger.info("MQTT 발행 성공: %s", topic)
            return True
        else:
            logger.warning("MQTT 발행 실패 (rc=%s): %s", result.rc, topic)
            return False
    except Exception as e:
        logger.error("MQTT 발행 예외: %s", e)
        return False


# ---------------------------------------------------------------------------
# PostgreSQL 헬퍼
# ---------------------------------------------------------------------------
async def _init_pg() -> Optional[asyncpg.Pool]:
    """PostgreSQL 연결 풀을 초기화한다."""
    try:
        pool = await asyncpg.create_pool(
            dsn=settings.DATABASE_URL,
            min_size=1,
            max_size=5,
            command_timeout=10,
        )
        logger.info("PostgreSQL 연결 풀 생성 완료")

        # audit_log 테이블 존재 확인 (없으면 생성)
        async with pool.acquire() as conn:
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS audit_log (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER,
                    action VARCHAR(50) NOT NULL,
                    target_equipment VARCHAR(255),
                    old_value TEXT,
                    new_value TEXT,
                    source VARCHAR(50),
                    ip_address INET,
                    created_at TIMESTAMPTZ DEFAULT NOW()
                )
            """)
            logger.info("audit_log 테이블 확인/생성 완료")

        return pool
    except Exception as e:
        logger.error("PostgreSQL 연결 실패: %s (로컬 로그 모드로 전환)", e)
        return None


async def _save_audit_log(
    user_id: int,
    action: str,
    target_equipment: str,
    old_value: Optional[str],
    new_value: str,
    source: str = "api",
) -> None:
    """감사 로그를 PostgreSQL에 저장한다. 실패 시 로컬 인메모리에 보관."""
    record = {
        "user_id": user_id,
        "action": action,
        "target_equipment": target_equipment,
        "old_value": old_value,
        "new_value": new_value,
        "source": source,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    if _pg_pool is not None:
        try:
            async with _pg_pool.acquire() as conn:
                await conn.execute(
                    """
                    INSERT INTO audit_log (user_id, action, target_equipment, old_value, new_value, source)
                    VALUES ($1, $2, $3, $4, $5, $6)
                    """,
                    user_id, action, target_equipment, old_value, new_value, source,
                )
                logger.info("감사 로그 DB 저장 완료: %s → %s", target_equipment, action)
                return
        except Exception as e:
            logger.error("감사 로그 DB 저장 실패: %s", e)

    # PostgreSQL 저장 실패 시 로컬 폴백
    _local_audit_log.append(record)
    if len(_local_audit_log) > MAX_LOCAL_AUDIT:
        _local_audit_log.pop(0)  # FIFO 유지
    logger.info("감사 로그 로컬 저장: %s → %s", target_equipment, action)


async def _fetch_audit_logs(limit: int = 100) -> list[dict]:
    """감사 로그를 조회한다. PostgreSQL 우선, 실패 시 로컬."""
    if _pg_pool is not None:
        try:
            async with _pg_pool.acquire() as conn:
                rows = await conn.fetch(
                    """
                    SELECT id, user_id, action, target_equipment,
                           old_value, new_value, source, created_at
                    FROM audit_log
                    ORDER BY created_at DESC
                    LIMIT $1
                    """,
                    limit,
                )
                return [dict(row) for row in rows]
        except Exception as e:
            logger.error("감사 로그 DB 조회 실패: %s", e)

    # 로컬 폴백
    return list(reversed(_local_audit_log[-limit:]))


# ---------------------------------------------------------------------------
# Lifespan (앱 시작/종료 시 리소스 관리)
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    """앱 시작 시 MQTT, PostgreSQL, httpx 초기화. 종료 시 정리."""
    global _mqtt_client, _pg_pool, _http_client

    logger.info("=" * 60)
    logger.info("Server B (BAS Adapter) 시작")
    logger.info("  Server C URL: %s", settings.SERVER_C_URL)
    logger.info("  MQTT Broker:  %s:%s", settings.MQTT_BROKER, settings.MQTT_PORT)
    logger.info("  등록 장비:    %d개", registry.count)
    logger.info("=" * 60)

    # Neo4j에서 장비 자동 로딩 (Phase 2)
    neo4j_count = await load_devices_from_neo4j()
    logger.info("Neo4j 디바이스 로딩: %d개 추가 (전체 %d개)", neo4j_count, registry.count)

    # MQTT 초기화
    _mqtt_client = _init_mqtt()

    # PostgreSQL 초기화
    _pg_pool = await _init_pg()

    # httpx 비동기 클라이언트 초기화
    _http_client = httpx.AsyncClient(
        base_url=settings.SERVER_C_URL,
        timeout=httpx.Timeout(settings.SERVER_C_TIMEOUT),
    )

    yield

    # 종료 정리
    logger.info("Server B 종료 중...")
    if _mqtt_client is not None:
        _mqtt_client.loop_stop()
        _mqtt_client.disconnect()
    if _pg_pool is not None:
        await _pg_pool.close()
    if _http_client is not None:
        await _http_client.aclose()
    logger.info("Server B 종료 완료")


# ---------------------------------------------------------------------------
# FastAPI 앱 생성
# ---------------------------------------------------------------------------
app = FastAPI(
    title="BEES Server B — BAS Adapter",
    description=(
        "삼성물산 GEC B동 디지털 트윈 플랫폼의 프로토콜 게이트웨이. "
        "Server A의 제어 명령을 Server C(가상 건물 에뮬레이터)로 전달한다."
    ),
    version="1.0.0",
    lifespan=lifespan,
)


# ---------------------------------------------------------------------------
# API 엔드포인트
# ---------------------------------------------------------------------------

# ── POST /command ──────────────────────────────────────────────────────────
@app.post("/command", response_model=CommandResponse)
async def send_command(req: CommandRequest) -> CommandResponse:
    """
    제어 명령 수신 및 처리.

    플로우:
      1. deviceId 유효성 검증 (레지스트리에 존재?)
      2. command 유효성 검증 (ON/OFF/setpoint 등)
      3. httpx로 Server C 호출: POST /devices/{id}/command
      4. MQTT 발행: bees/commands/{deviceId}
      5. PostgreSQL audit_log에 명령 기록
      6. 결과 반환
    """
    now = datetime.now(timezone.utc)
    ts_str = now.isoformat()

    # 1. deviceId 유효성 검증
    if not registry.exists(req.deviceId):
        logger.warning("미등록 장비 명령 시도: %s", req.deviceId)
        await _save_audit_log(
            user_id=req.userId,
            action="command_rejected",
            target_equipment=req.deviceId,
            old_value=None,
            new_value=json.dumps({"command": req.command, "reason": "unknown_device"}),
        )
        raise HTTPException(
            status_code=404,
            detail=f"미등록 장비: {req.deviceId}. 디바이스 레지스트리에 등록된 장비만 제어할 수 있습니다.",
        )

    # 2. command 유효성 검증
    if not registry.is_command_allowed(req.deviceId, req.command):
        device = registry.get(req.deviceId)
        allowed = device.allowed_commands if device else []
        logger.warning("허용되지 않은 명령: %s → %s (허용: %s)", req.deviceId, req.command, allowed)
        await _save_audit_log(
            user_id=req.userId,
            action="command_rejected",
            target_equipment=req.deviceId,
            old_value=None,
            new_value=json.dumps({"command": req.command, "reason": "command_not_allowed"}),
        )
        raise HTTPException(
            status_code=400,
            detail=f"허용되지 않은 명령: '{req.command}'. 허용 명령: {allowed}",
        )

    # 3. Server C 호출
    server_c_result: Optional[dict[str, Any]] = None
    command_success = False

    try:
        # Server C의 API 경로: POST /devices/{id}/command
        # deviceId에서 "bldg:" 접두어를 유지하여 전달
        response = await _http_client.post(
            f"/devices/{req.deviceId}/command",
            json={
                "command": req.command,
                "params": req.params,
            },
        )
        response.raise_for_status()
        server_c_result = response.json()
        command_success = True
        logger.info("Server C 응답 성공: %s → %s", req.deviceId, req.command)

    except httpx.TimeoutException:
        logger.error("Server C 호출 타임아웃 (%s초): %s", settings.SERVER_C_TIMEOUT, req.deviceId)
        await _save_audit_log(
            user_id=req.userId,
            action="command_failed",
            target_equipment=req.deviceId,
            old_value=None,
            new_value=json.dumps({"command": req.command, "reason": "timeout"}),
        )
        raise HTTPException(
            status_code=503,
            detail=f"Server C 응답 타임아웃 ({settings.SERVER_C_TIMEOUT}초). 에뮬레이터가 응답하지 않습니다.",
        )

    except httpx.HTTPStatusError as e:
        logger.error("Server C HTTP 에러: %s %s", e.response.status_code, e.response.text)
        await _save_audit_log(
            user_id=req.userId,
            action="command_failed",
            target_equipment=req.deviceId,
            old_value=None,
            new_value=json.dumps({
                "command": req.command,
                "reason": "server_c_error",
                "status_code": e.response.status_code,
            }),
        )
        raise HTTPException(
            status_code=503,
            detail=f"Server C 오류 응답: {e.response.status_code}",
        )

    except httpx.ConnectError:
        logger.error("Server C 연결 실패: %s", settings.SERVER_C_URL)
        await _save_audit_log(
            user_id=req.userId,
            action="command_failed",
            target_equipment=req.deviceId,
            old_value=None,
            new_value=json.dumps({"command": req.command, "reason": "connection_error"}),
        )
        raise HTTPException(
            status_code=503,
            detail="Server C에 연결할 수 없습니다. 에뮬레이터가 실행 중인지 확인하세요.",
        )

    # 4. MQTT 발행
    mqtt_payload = {
        "command": req.command,
        "params": req.params,
        "user_id": req.userId,
        "ts": ts_str,
        "result": "success" if command_success else "failed",
    }
    _publish_mqtt(req.deviceId, mqtt_payload)

    # 5. 감사 로그 저장
    await _save_audit_log(
        user_id=req.userId,
        action="command",
        target_equipment=req.deviceId,
        old_value=None,
        new_value=json.dumps({
            "command": req.command,
            "params": req.params,
            "result": "success",
        }),
    )

    # 6. 결과 반환
    return CommandResponse(
        success=True,
        deviceId=req.deviceId,
        command=req.command,
        message=f"명령 '{req.command}'이(가) {req.deviceId}에 성공적으로 전달되었습니다.",
        server_c_response=server_c_result,
        timestamp=ts_str,
    )


# ── GET /devices ───────────────────────────────────────────────────────────
@app.get("/devices")
async def list_devices() -> dict[str, Any]:
    """디바이스 레지스트리에 등록된 전체 장비를 조회한다."""
    devices = registry.list_all()
    return {
        "count": len(devices),
        "devices": devices,
    }


# ── GET /devices/{device_id}/status ────────────────────────────────────────
@app.get("/devices/{device_id}/status")
async def get_device_status(device_id: str) -> dict[str, Any]:
    """
    특정 장비의 상태를 조회한다.
    Server C에 요청하여 실시간 상태를 가져온다.

    Args:
        device_id: 온톨로지 장비 ID (예: bldg:AHU_5F)
    """
    # 레지스트리에 등록된 장비인지 확인
    if not registry.exists(device_id):
        raise HTTPException(
            status_code=404,
            detail=f"미등록 장비: {device_id}",
        )

    # Server C에서 상태 조회
    try:
        response = await _http_client.get(f"/devices/{device_id}")
        response.raise_for_status()
        device_data = response.json()
        return {
            "deviceId": device_id,
            "source": "server-c",
            "data": device_data,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    except httpx.TimeoutException:
        logger.error("Server C 상태 조회 타임아웃: %s", device_id)
        raise HTTPException(
            status_code=503,
            detail=f"Server C 응답 타임아웃 ({settings.SERVER_C_TIMEOUT}초)",
        )

    except httpx.ConnectError:
        logger.error("Server C 연결 실패 (상태 조회): %s", device_id)
        raise HTTPException(
            status_code=503,
            detail="Server C에 연결할 수 없습니다.",
        )

    except httpx.HTTPStatusError as e:
        logger.error("Server C 상태 조회 오류: %s", e.response.status_code)
        raise HTTPException(
            status_code=e.response.status_code,
            detail=f"Server C 오류: {e.response.text}",
        )


# ── GET /health ────────────────────────────────────────────────────────────
@app.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """게이트웨이 헬스체크. MQTT, DB 연결 상태를 포함한다."""
    mqtt_ok = _mqtt_client is not None and _mqtt_client.is_connected()

    db_ok = False
    if _pg_pool is not None:
        try:
            async with _pg_pool.acquire() as conn:
                await conn.fetchval("SELECT 1")
            db_ok = True
        except Exception:
            pass

    return HealthResponse(
        status="healthy" if mqtt_ok and db_ok else "degraded",
        registered_devices=registry.count,
        mqtt_connected=mqtt_ok,
        db_connected=db_ok,
        timestamp=datetime.now(timezone.utc).isoformat(),
    )


# ── GET /audit-log ─────────────────────────────────────────────────────────
@app.get("/audit-log")
async def get_audit_log(limit: int = 100) -> dict[str, Any]:
    """
    명령 감사 로그를 조회한다.

    Args:
        limit: 조회 건수 (기본 100, 최대 500)
    """
    limit = min(limit, MAX_LOCAL_AUDIT)
    logs = await _fetch_audit_logs(limit)

    # asyncpg Record를 JSON 직렬화 가능하도록 변환
    serialized = []
    for log in logs:
        entry = {}
        for key, value in log.items():
            if isinstance(value, datetime):
                entry[key] = value.isoformat()
            else:
                entry[key] = value
        serialized.append(entry)

    return {
        "count": len(serialized),
        "limit": limit,
        "logs": serialized,
    }


# ---------------------------------------------------------------------------
# 엔트리포인트 (직접 실행 시)
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=True,
        log_level="info",
    )

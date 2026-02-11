"""
Server C: 가상 건물 에뮬레이터 — FastAPI 메인 애플리케이션.

삼성물산 GEC B동의 장비/센서를 시뮬레이션하여 MQTT로 실시간 데이터를 발행한다.
Phase 1 MVP: AHU_5F 1대 + 연결 센서 5개.
"""

import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from .config import settings
from .engine import EmulatorEngine

# ─────────────────────────────────────────────────────────────
# 로깅 설정
# ─────────────────────────────────────────────────────────────

os.makedirs(settings.LOG_DIR, exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(
            os.path.join(settings.LOG_DIR, "server-c.log"),
            encoding="utf-8",
        ),
    ],
)
logger = logging.getLogger("server-c")


# ─────────────────────────────────────────────────────────────
# 시뮬레이션 엔진 (싱글턴)
# ─────────────────────────────────────────────────────────────

engine = EmulatorEngine()


# ─────────────────────────────────────────────────────────────
# FastAPI 앱 생명주기
# ─────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """앱 시작/종료 시 리소스 관리."""
    logger.info("Server C 시작 — 가상 건물 에뮬레이터")
    logger.info(f"MQTT 브로커: {settings.MQTT_BROKER}:{settings.MQTT_PORT}")
    logger.info(f"시뮬레이션 간격: {settings.SIMULATION_INTERVAL}초")
    yield
    # 종료 시 시뮬레이션 정리
    if engine._running:
        await engine.stop()
        logger.info("시뮬레이션 자동 정지 (앱 종료)")
    logger.info("Server C 종료")


app = FastAPI(
    title="BEES Server C — 가상 건물 에뮬레이터",
    description=(
        "삼성물산 GEC B동 가상 건물 에뮬레이터. "
        "Brick Schema 온톨로지 기반 장비/센서 시뮬레이션 및 MQTT 데이터 발행."
    ),
    version="1.0.0",
    lifespan=lifespan,
)


# ─────────────────────────────────────────────────────────────
# 요청/응답 모델
# ─────────────────────────────────────────────────────────────

class CommandRequest(BaseModel):
    """장비 제어 명령 요청."""
    command: str = Field(..., description="명령어: ON, OFF, MODE")
    params: dict = Field(default_factory=dict, description="추가 파라미터 (예: {mode: 'manual'})")


class CommandResponse(BaseModel):
    """장비 제어 명령 응답."""
    success: bool
    device_id: str | None = None
    command: str | None = None
    mode: str | None = None
    state: dict | None = None
    error: str | None = None


class SimulationResponse(BaseModel):
    """시뮬레이션 제어 응답."""
    status: str
    message: str


class HealthResponse(BaseModel):
    """헬스체크 응답."""
    status: str
    service: str
    version: str
    timestamp: str
    simulation: dict


# ─────────────────────────────────────────────────────────────
# API 엔드포인트 — 헬스체크
# ─────────────────────────────────────────────────────────────

@app.get("/health", response_model=HealthResponse, tags=["시스템"])
async def health_check():
    """서버 헬스체크. 시뮬레이션 상태도 포함."""
    return HealthResponse(
        status="healthy",
        service="server-c-emulator",
        version="1.0.0",
        timestamp=datetime.now(timezone.utc).isoformat(),
        simulation=engine.get_status(),
    )


# ─────────────────────────────────────────────────────────────
# API 엔드포인트 — 시뮬레이션 제어
# ─────────────────────────────────────────────────────────────

@app.post("/simulation/start", response_model=SimulationResponse, tags=["시뮬레이션"])
async def simulation_start():
    """시뮬레이션 시작. 호출 전까지 데이터 생성 없음."""
    result = await engine.start()
    return SimulationResponse(**result)


@app.post("/simulation/stop", response_model=SimulationResponse, tags=["시뮬레이션"])
async def simulation_stop():
    """시뮬레이션 중지. MQTT 발행 및 데이터 생성 중단."""
    result = await engine.stop()
    return SimulationResponse(**result)


@app.get("/simulation/status", tags=["시뮬레이션"])
async def simulation_status():
    """시뮬레이션 현재 상태 조회."""
    return engine.get_status()


# ─────────────────────────────────────────────────────────────
# API 엔드포인트 — 장비 제어
# ─────────────────────────────────────────────────────────────

@app.get("/devices", tags=["장비"])
async def get_all_devices():
    """전체 장비 상태 및 최신 센서값 조회."""
    return engine.get_all_devices()


@app.get("/devices/{device_id:path}", tags=["장비"])
async def get_device(device_id: str):
    """
    특정 장비 상태 + 연결 센서 최신값 조회.
    device_id 예시: bldg:AHU_5F
    """
    result = engine.get_device(device_id)
    if result is None:
        raise HTTPException(
            status_code=404,
            detail=f"장비를 찾을 수 없습니다: {device_id}",
        )
    return result


@app.post("/devices/{device_id:path}/command", tags=["장비"])
async def device_command(device_id: str, request: CommandRequest):
    """
    장비 제어 명령 전송.

    - **ON**: 장비 활성화 (센서 데이터가 정상 운전 모드로 생성)
    - **OFF**: 장비 비활성화 (대기전력만, 급기온도 외기 수렴)
    - **MODE**: 운전 모드 변경 (params에 mode 필요: auto/manual/standby)
    """
    result = engine.execute_command(device_id, request.command, request.params)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    return result

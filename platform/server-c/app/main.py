"""
Server C: 가상 건물 에뮬레이터 — FastAPI 메인 애플리케이션.

삼성물산 GEC B동의 장비/센서를 시뮬레이션하여 MQTT로 실시간 데이터를 발행한다.
Phase 1 MVP: AHU_5F 1대 + 연결 센서 5개.
Phase 4: 시나리오 관리, 고장 주입, HVAC 열역학 모델링.
"""

import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from .config import settings
from .engine import EmulatorEngine
from .fault_injection import FAULT_TYPES

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

    # Phase 2: Neo4j에서 장비/센서 자동 로딩
    load_result = await engine.initialize_from_neo4j()
    logger.info(f"Neo4j 로딩 결과: {load_result}")

    # Phase 3: 시뮬레이션 자동 시작
    if settings.AUTO_START_SIMULATION:
        try:
            start_result = await engine.start()
            logger.info(f"시뮬레이션 자동 시작 완료: {start_result}")
        except Exception as e:
            logger.error(f"시뮬레이션 자동 시작 실패 (서버는 계속 구동): {e}")
    else:
        logger.info("시뮬레이션 자동 시작 비활성화 (AUTO_START_SIMULATION=false)")

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
        "Brick Schema 온톨로지 기반 84개 장비 + 164개 센서 시뮬레이션 및 MQTT 데이터 발행. "
        "시나리오 관리, 고장 주입, HVAC 열역학 모델링 지원."
    ),
    version="2.0.0",
    lifespan=lifespan,
    openapi_tags=[
        {"name": "시스템", "description": "헬스체크 및 Neo4j 상태"},
        {"name": "시뮬레이션", "description": "시뮬레이션 시작/중지/상태 제어"},
        {"name": "장비", "description": "장비 상태 조회 및 제어 명령"},
        {"name": "시나리오", "description": "시뮬레이션 시나리오 관리 (6개 프리셋 + 커스텀)"},
        {"name": "고장 주입", "description": "장비 고장 시뮬레이션 (6개 유형)"},
        {"name": "기상", "description": "외기 기상 조건 조회"},
    ],
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


class Neo4jStatusResponse(BaseModel):
    """Neo4j 로딩 상태 응답."""
    neo4j_loaded: bool = Field(..., description="Neo4j 로딩 완료 여부")
    device_count: int = Field(..., description="등록 장비 수")
    point_count: int = Field(..., description="등록 포인트 수")


class ScenarioListItem(BaseModel):
    """시나리오 목록 항목."""
    name: str
    display_name: str = ""
    description: str = ""
    is_active: bool = False


class ScenarioLoadRequest(BaseModel):
    """시나리오 로드 요청."""
    name: str = Field(..., description="시나리오 이름 (예: normal, summer, peak_load)")


class CustomScenarioRequest(BaseModel):
    """커스텀 시나리오 생성 요청."""
    name: str = Field(..., description="시나리오 이름")
    display_name: str = Field(default="사용자 정의", description="표시명")
    description: str = Field(default="", description="설명")
    occupancy: float = Field(default=0.7, ge=0.0, le=1.0, description="재실률 (0.0~1.0)")
    outdoor_temp_min: float = Field(default=15.0, description="외기온 최소 (°C)")
    outdoor_temp_max: float = Field(default=25.0, description="외기온 최대 (°C)")
    hvac_mode: str = Field(default="auto", description="HVAC 모드: auto, cooling, heating, max_cooling, max_ventilation, eco")
    solar_factor: float = Field(default=1.0, ge=0.0, le=2.0, description="태양 복사 보정 계수 (0.0~2.0)")


class FaultInjectRequest(BaseModel):
    """고장 주입 요청."""
    fault_type: str = Field(..., description="고장 유형: stuck_damper, sensor_stuck, sensor_drift, comm_loss, degraded_performance, valve_leak")
    target_id: str = Field(..., description="대상 장비/센서 ID (예: bldg:AHU_5F)")
    params: dict = Field(default_factory=dict, description="고장 파라미터 (유형별 상이)")


# ─────────────────────────────────────────────────────────────
# API 엔드포인트 — 헬스체크
# ─────────────────────────────────────────────────────────────

@app.get("/health", response_model=HealthResponse, tags=["시스템"])
async def health_check():
    """서버 헬스체크. 시뮬레이션 상태도 포함."""
    return HealthResponse(
        status="healthy",
        service="server-c-emulator",
        version="2.0.0",
        timestamp=datetime.now(timezone.utc).isoformat(),
        simulation=engine.get_status(),
    )


# ─────────────────────────────────────────────────────────────
# API 엔드포인트 — 시뮬레이션 제어
# ─────────────────────────────────────────────────────────────

@app.get("/neo4j/status", tags=["시스템"], response_model=Neo4jStatusResponse)
async def neo4j_load_status():
    """Neo4j 로딩 상태 및 등록된 장비/포인트 수 조회."""
    return {
        "neo4j_loaded": engine._neo4j_loaded,
        "device_count": len(engine._devices),
        "point_count": len(engine._profiles),
    }


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


# ─────────────────────────────────────────────────────────────
# API 엔드포인트 — 시나리오 관리 (Phase 4)
# ─────────────────────────────────────────────────────────────

@app.get("/scenarios", tags=["시나리오"])
async def list_scenarios():
    """전체 시나리오 목록 조회 (프리셋 + 커스텀)."""
    return engine.scenario_manager.list_scenarios()


@app.get("/scenarios/active", tags=["시나리오"])
async def get_active_scenario():
    """현재 활성 시나리오 조회."""
    return engine.scenario_manager.get_active()


@app.get("/scenarios/{scenario_id}", tags=["시나리오"])
async def get_scenario(scenario_id: str):
    """특정 시나리오 상세 조회."""
    result = engine.scenario_manager.get_scenario(scenario_id)
    if result is None:
        raise HTTPException(
            status_code=404,
            detail=f"시나리오를 찾을 수 없습니다: {scenario_id}",
        )
    return result


@app.post("/scenarios/load", tags=["시나리오"])
async def load_scenario(request: ScenarioLoadRequest):
    """
    시나리오 로드 (프리셋 또는 커스텀).

    사용 가능한 프리셋: normal, emergency, peak_load, summer, winter, night_weekend
    """
    result = engine.scenario_manager.load_scenario(request.name)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    return result


@app.post("/scenarios/custom", tags=["시나리오"])
async def create_custom_scenario(request: CustomScenarioRequest):
    """
    커스텀 시나리오 생성 및 즉시 활성화.

    재실률, 외기온 범위, HVAC 모드, 태양 복사 계수를 자유롭게 설정.
    """
    result = engine.scenario_manager.create_custom(
        name=request.name,
        display_name=request.display_name,
        description=request.description,
        occupancy=request.occupancy,
        outdoor_temp_min=request.outdoor_temp_min,
        outdoor_temp_max=request.outdoor_temp_max,
        hvac_mode=request.hvac_mode,
        solar_factor=request.solar_factor,
    )
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    return result


# ─────────────────────────────────────────────────────────────
# API 엔드포인트 — 고장 주입 (Phase 4)
# ─────────────────────────────────────────────────────────────

@app.get("/faults/types", tags=["고장 주입"])
async def list_fault_types():
    """사용 가능한 고장 유형 및 설명 조회."""
    return list(FAULT_TYPES.values())


@app.get("/faults/active", tags=["고장 주입"])
async def list_active_faults():
    """현재 활성 고장 목록 조회."""
    return engine.fault_manager.get_active_faults()


@app.post("/faults/inject", tags=["고장 주입"])
async def inject_fault(request: FaultInjectRequest):
    """
    고장 주입.

    고장 유형별 필수 파라미터:
    - **stuck_damper**: `{stuck_position: 30}` (%)
    - **sensor_stuck**: `{fixed_value: 25.0}`
    - **sensor_drift**: `{drift_rate: 0.5}` (단위/시간)
    - **comm_loss**: 파라미터 불필요
    - **degraded_performance**: `{capacity_reduction: 40}` (%)
    - **valve_leak**: `{leak_percentage: 20}` (%)
    """
    result = engine.fault_manager.inject(
        fault_type=request.fault_type,
        target_id=request.target_id,
        params=request.params,
    )
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    return result


@app.post("/faults/{fault_id}/clear", tags=["고장 주입"])
async def clear_fault(fault_id: str):
    """고장 해제."""
    result = engine.fault_manager.clear(fault_id)
    if not result.get("success"):
        raise HTTPException(status_code=404, detail=result.get("error"))
    return result


# ─────────────────────────────────────────────────────────────
# API 엔드포인트 — 기상/열역학 정보 (Phase 4)
# ─────────────────────────────────────────────────────────────

@app.get("/weather/current", tags=["기상"])
async def get_current_weather():
    """현재 기상 조건 조회 (외기온, 습도, 태양 복사)."""
    return engine.weather_provider.get_current_conditions()

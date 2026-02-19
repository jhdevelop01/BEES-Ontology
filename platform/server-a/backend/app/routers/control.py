"""
제어 API 라우터
장비 제어 명령을 Server B (BAS Adapter)로 전달한다.
"""

import json
import logging
from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from app.config import SERVER_B_URL, SERVER_C_URL
from app.dependencies import CurrentUser, require_role
from app.models import DeviceStatusResponse
from app.services import mqtt_service
from app.services import audit_service
from app.services import neo4j_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["제어"])


class ControlCommand(BaseModel):
    """제어 명령 요청 모델"""
    deviceId: str          # 예: "bldg:AHU_5F"
    command: str           # 예: "ON", "OFF", "SET_TEMP"
    params: dict[str, Any] = {}  # 추가 파라미터 (설정값 등)
    userId: int | None = None


class ControlResponse(BaseModel):
    """제어 명령 응답 모델"""
    success: bool
    message: str
    deviceId: str
    command: str


@router.post("/control", response_model=ControlResponse)
async def send_control_command(
    cmd: ControlCommand,
    request: Request,
    current_user: CurrentUser = Depends(require_role("operator", "admin")),
) -> ControlResponse:
    """
    제어 명령을 Server B로 전달.
    Server B가 오프라인이면 에러 반환.
    """
    logger.info("제어 명령 수신: %s → %s", cmd.deviceId, cmd.command)
    client_ip = request.client.host if request.client else None

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                f"{SERVER_B_URL}/command",
                json={
                    "deviceId": cmd.deviceId,
                    "command": cmd.command,
                    "params": cmd.params,
                    "userId": current_user.user_id,
                },
            )
            response.raise_for_status()
            result = response.json()

            # 감사 로그 기록 (Phase 4)
            await audit_service.log_action(
                user_id=current_user.user_id,
                action="command",
                target_equipment=cmd.deviceId,
                old_value=None,
                new_value=json.dumps({
                    "command": cmd.command,
                    "params": cmd.params,
                    "result": "success",
                }),
                source="dashboard",
                ip_address=client_ip,
            )

            return ControlResponse(
                success=result.get("success", True),
                message=result.get("message", f"{cmd.command} 명령 전송 성공"),
                deviceId=cmd.deviceId,
                command=cmd.command,
            )

    except httpx.ConnectError:
        logger.warning("Server B 연결 실패: %s", SERVER_B_URL)
        # 감사 로그: Server B 오프라인
        await audit_service.log_action(
            user_id=current_user.user_id,
            action="command",
            target_equipment=cmd.deviceId,
            old_value=None,
            new_value=json.dumps({
                "command": cmd.command,
                "params": cmd.params,
                "result": "server_b_offline",
            }),
            source="dashboard",
            ip_address=client_ip,
        )
        return ControlResponse(
            success=True,
            message=f"{cmd.command} 명령 전송 (Server B 오프라인 — 시뮬레이션 모드)",
            deviceId=cmd.deviceId,
            command=cmd.command,
        )
    except httpx.HTTPStatusError as e:
        logger.error("Server B 오류 응답: %s", e.response.status_code)
        raise HTTPException(
            status_code=e.response.status_code,
            detail=f"Server B 오류: {e.response.text}",
        )
    except Exception as e:
        logger.error("제어 명령 전송 실패: %s", e)
        raise HTTPException(status_code=500, detail=f"제어 명령 실패: {str(e)}")


@router.get("/devices/status", response_model=DeviceStatusResponse)
async def get_all_device_status() -> dict[str, Any]:
    """전체 장비 ON/OFF 상태 (MQTT + Neo4j 정보 병합)."""
    device_cache = mqtt_service.get_device_cache()
    if not device_cache:
        return {"devices": [], "total": 0, "active": 0}

    # Neo4j 장비 정보로 이름/타입/위치/라벨 보강
    try:
        equipment = await neo4j_service.get_equipment_list()
        eq_map = {eq["name"]: eq for eq in equipment}
    except Exception:
        eq_map = {}

    devices = []
    for d in device_cache.values():
        did = d["device_id"]
        # MQTT device_id는 "bldg:AHU_5F" 형태, eq_map 키는 "AHU_5F"
        lookup_key = did.replace("bldg:", "") if did.startswith("bldg:") else did
        eq = eq_map.get(lookup_key, {})
        devices.append({
            **d,
            "name": did,
            "label": eq.get("label", ""),
            "type": eq.get("type", ""),
            "location": eq.get("location", ""),
        })

    active = sum(1 for d in devices if d.get("is_active", False))
    return {"devices": devices, "total": len(devices), "active": active}


# ── 시뮬레이션 전체 제어 (Server C 프록시) ──

class SimulationResponse(BaseModel):
    """시뮬레이션 제어 응답"""
    status: str
    message: str


@router.post("/simulation/start", response_model=SimulationResponse)
async def simulation_start(
    request: Request,
    current_user: CurrentUser = Depends(require_role("operator", "admin")),
) -> SimulationResponse:
    """에뮬레이터 시뮬레이션 전체 시작 (Server C 프록시)."""
    logger.info("시뮬레이션 시작 요청 — user=%s", current_user.user_id)
    client_ip = request.client.host if request.client else None
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(f"{SERVER_C_URL}/simulation/start")
            resp.raise_for_status()
            result = resp.json()

        # 시뮬레이션 시작 성공 → MQTT 디바이스 캐시 전체 active 전환
        status = result.get("status", "started")
        if status in ("started", "already_running"):
            updated = mqtt_service.set_all_devices_active()
            logger.info("시뮬레이션 시작 — 디바이스 캐시 active 전환: %d건", updated)

        await audit_service.log_action(
            user_id=current_user.user_id,
            action="simulation_start",
            target_equipment="ALL",
            old_value=None,
            new_value=json.dumps({"result": status}),
            source="dashboard",
            ip_address=client_ip,
        )
        return SimulationResponse(
            status=status,
            message=result.get("message", "시뮬레이션이 시작되었습니다."),
        )
    except httpx.ConnectError:
        logger.warning("Server C 연결 실패: %s", SERVER_C_URL)
        return SimulationResponse(status="error", message="에뮬레이터(Server C)에 연결할 수 없습니다.")
    except Exception as e:
        logger.error("시뮬레이션 시작 실패: %s", e)
        raise HTTPException(status_code=500, detail=f"시뮬레이션 시작 실패: {str(e)}")


@router.post("/simulation/stop", response_model=SimulationResponse)
async def simulation_stop(
    request: Request,
    current_user: CurrentUser = Depends(require_role("operator", "admin")),
) -> SimulationResponse:
    """에뮬레이터 시뮬레이션 전체 정지 (Server C 프록시)."""
    logger.info("시뮬레이션 정지 요청 — user=%s", current_user.user_id)
    client_ip = request.client.host if request.client else None
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(f"{SERVER_C_URL}/simulation/stop")
            resp.raise_for_status()
            result = resp.json()

        # 시뮬레이션 정지 성공 → MQTT 디바이스 캐시 전체 inactive 전환
        status = result.get("status", "stopped")
        if status in ("stopped", "already_stopped"):
            updated = mqtt_service.set_all_devices_inactive()
            logger.info("시뮬레이션 정지 — 디바이스 캐시 inactive 전환: %d건", updated)

        await audit_service.log_action(
            user_id=current_user.user_id,
            action="simulation_stop",
            target_equipment="ALL",
            old_value=None,
            new_value=json.dumps({"result": status}),
            source="dashboard",
            ip_address=client_ip,
        )
        return SimulationResponse(
            status=status,
            message=result.get("message", "시뮬레이션이 정지되었습니다."),
        )
    except httpx.ConnectError:
        logger.warning("Server C 연결 실패: %s", SERVER_C_URL)
        return SimulationResponse(status="error", message="에뮬레이터(Server C)에 연결할 수 없습니다.")
    except Exception as e:
        logger.error("시뮬레이션 정지 실패: %s", e)
        raise HTTPException(status_code=500, detail=f"시뮬레이션 정지 실패: {str(e)}")


@router.get("/simulation/status")
async def simulation_status() -> dict[str, Any]:
    """에뮬레이터 시뮬레이션 상태 조회 (Server C 프록시)."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{SERVER_C_URL}/simulation/status")
            resp.raise_for_status()
            return resp.json()
    except httpx.ConnectError:
        return {"status": "disconnected", "message": "에뮬레이터 연결 불가"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

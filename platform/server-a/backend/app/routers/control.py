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

from app.config import SERVER_B_URL
from app.dependencies import CurrentUser, require_role
from app.models import DeviceStatusResponse
from app.services import mqtt_service
from app.services import audit_service

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
                    "userId": cmd.userId,
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
    """
    전체 장비 ON/OFF 상태 (MQTT 캐시에서 조회).
    캐시가 비어있으면 기본 AHU_5F 상태 반환.
    """
    device_cache = mqtt_service.get_device_cache()

    if not device_cache:
        # 기본 장비 상태 (시뮬레이션 데이터)
        return {
            "devices": [
                {
                    "device_id": "AHU_5F",
                    "name": "AHU 5층",
                    "is_active": False,
                    "mode": "standby",
                    "type": "AHU",
                    "location": "5F",
                    "ts": None,
                },
            ],
            "total": 1,
            "active": 0,
        }

    devices = list(device_cache.values())
    active = sum(1 for d in devices if d.get("is_active", False))

    return {
        "devices": devices,
        "total": len(devices),
        "active": active,
    }

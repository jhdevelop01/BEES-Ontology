"""
디바이스 레지스트리 모듈.
온톨로지 ID(bldg:*)와 에뮬레이터 내부 장비 매핑을 관리한다.
Phase 1: AHU_5F 1개 장비만 등록.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional


@dataclass
class DeviceInfo:
    """등록된 장비 정보."""

    ontology_id: str          # 온톨로지 식별자 (예: "bldg:AHU_5F")
    name: str                 # 장비 표시명
    device_type: str          # Brick 클래스 (예: "AHU")
    location: str             # 위치 (예: "5F_MER")
    controllable: bool        # 제어 가능 여부
    allowed_commands: list[str] = field(default_factory=list)  # 허용 명령 목록


class DeviceRegistry:
    """
    디바이스 레지스트리.
    온톨로지 ID를 키로 사용하여 장비 정보를 조회한다.
    Phase 1에서는 인메모리 딕셔너리로 관리한다.
    """

    def __init__(self) -> None:
        self._devices: dict[str, DeviceInfo] = {}
        self._init_phase1_devices()

    def _init_phase1_devices(self) -> None:
        """Phase 1 MVP: AHU_5F 1개 장비 등록."""
        self.register(
            DeviceInfo(
                ontology_id="bldg:AHU_5F",
                name="5층 공조기 (AHU)",
                device_type="AHU",
                location="5F_MER",
                controllable=True,
                allowed_commands=["ON", "OFF", "setpoint"],
            )
        )

    def register(self, device: DeviceInfo) -> None:
        """장비를 레지스트리에 등록한다."""
        self._devices[device.ontology_id] = device

    def get(self, ontology_id: str) -> Optional[DeviceInfo]:
        """온톨로지 ID로 장비 정보를 조회한다. 미등록 시 None."""
        return self._devices.get(ontology_id)

    def exists(self, ontology_id: str) -> bool:
        """장비 존재 여부를 확인한다."""
        return ontology_id in self._devices

    def is_controllable(self, ontology_id: str) -> bool:
        """장비가 제어 가능한지 확인한다."""
        device = self.get(ontology_id)
        if device is None:
            return False
        return device.controllable

    def is_command_allowed(self, ontology_id: str, command: str) -> bool:
        """해당 장비에 대해 특정 명령이 허용되는지 확인한다."""
        device = self.get(ontology_id)
        if device is None:
            return False
        return command in device.allowed_commands

    def list_all(self) -> list[dict]:
        """등록된 전체 장비를 딕셔너리 리스트로 반환한다."""
        result = []
        for device in self._devices.values():
            result.append({
                "ontology_id": device.ontology_id,
                "name": device.name,
                "device_type": device.device_type,
                "location": device.location,
                "controllable": device.controllable,
                "allowed_commands": device.allowed_commands,
            })
        return result

    @property
    def count(self) -> int:
        """등록된 장비 수를 반환한다."""
        return len(self._devices)


# 싱글턴 레지스트리 인스턴스
registry = DeviceRegistry()

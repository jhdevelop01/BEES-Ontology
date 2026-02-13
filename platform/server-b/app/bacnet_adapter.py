"""
BACnet/IP 시뮬레이션 어댑터.

실제 BMS 장비가 없는 환경에서 BACnet 프로토콜 인터페이스를 시뮬레이션한다.
인메모리 가상 BACnet 디바이스 목록을 관리하며, 온톨로지 장비와 1:1 매핑.

NOTE: bacpypes3/BAC0 라이브러리 미사용 (시뮬레이션 모드).
      실제 BACnet 연동 시 해당 라이브러리 추가 필요.
"""

from __future__ import annotations

import logging
import random
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional

logger = logging.getLogger("server-b.bacnet")


# ---------------------------------------------------------------------------
# BACnet 오브젝트 타입 (시뮬레이션용 축소 열거)
# ---------------------------------------------------------------------------
class BACnetObjectType(str, Enum):
    """BACnet 오브젝트 타입 — Brick 클래스 매핑에 사용."""
    ANALOG_INPUT = "analogInput"
    ANALOG_OUTPUT = "analogOutput"
    ANALOG_VALUE = "analogValue"
    BINARY_INPUT = "binaryInput"
    BINARY_OUTPUT = "binaryOutput"
    BINARY_VALUE = "binaryValue"
    MULTI_STATE_VALUE = "multiStateValue"


# Brick 포인트 타입 → BACnet 오브젝트 타입 매핑
BRICK_TO_BACNET: dict[str, BACnetObjectType] = {
    # Sensor 류 → analogInput
    "Temperature_Sensor": BACnetObjectType.ANALOG_INPUT,
    "Humidity_Sensor": BACnetObjectType.ANALOG_INPUT,
    "Pressure_Sensor": BACnetObjectType.ANALOG_INPUT,
    "Flow_Sensor": BACnetObjectType.ANALOG_INPUT,
    "CO2_Sensor": BACnetObjectType.ANALOG_INPUT,
    "Power_Sensor": BACnetObjectType.ANALOG_INPUT,
    "Current_Sensor": BACnetObjectType.ANALOG_INPUT,
    # Command 류 → binaryOutput
    "Command": BACnetObjectType.BINARY_OUTPUT,
    "On_Off_Command": BACnetObjectType.BINARY_OUTPUT,
    "Enable_Command": BACnetObjectType.BINARY_OUTPUT,
    "Run_Command": BACnetObjectType.BINARY_OUTPUT,
    # Setpoint 류 → analogValue
    "Setpoint": BACnetObjectType.ANALOG_VALUE,
    "Temperature_Setpoint": BACnetObjectType.ANALOG_VALUE,
    "Pressure_Setpoint": BACnetObjectType.ANALOG_VALUE,
    "Flow_Setpoint": BACnetObjectType.ANALOG_VALUE,
    # Status 류 → binaryInput
    "Status": BACnetObjectType.BINARY_INPUT,
    "On_Off_Status": BACnetObjectType.BINARY_INPUT,
    "Run_Status": BACnetObjectType.BINARY_INPUT,
    "Fault_Status": BACnetObjectType.BINARY_INPUT,
    # Alarm → binaryInput
    "Alarm": BACnetObjectType.BINARY_INPUT,
}


# ---------------------------------------------------------------------------
# 데이터 모델
# ---------------------------------------------------------------------------
@dataclass
class BACnetObject:
    """BACnet 오브젝트 (포인트 1개에 대응)."""
    object_id: str                  # 예: "AI:1"
    object_type: BACnetObjectType
    object_name: str                # 예: "AHU_5F_Supply_Air_Temp"
    brick_point_id: str             # 매핑된 온톨로지 포인트 ID
    present_value: Any = 0.0
    units: str = ""
    description: str = ""


@dataclass
class BACnetDevice:
    """BACnet 디바이스 (장비 1개에 대응)."""
    device_id: int                  # BACnet 디바이스 인스턴스 번호
    device_name: str                # 예: "AHU_5F"
    ontology_id: str                # 온톨로지 ID (bldg:AHU_5F)
    vendor: str = "Samsung C&T (시뮬레이션)"
    model: str = "BEES-SIM-v1"
    objects: dict[str, BACnetObject] = field(default_factory=dict)


# ---------------------------------------------------------------------------
# BACnet 시뮬레이터
# ---------------------------------------------------------------------------
class BACnetSimulator:
    """
    인메모리 BACnet 시뮬레이터.

    DeviceRegistry의 장비를 BACnet 디바이스로 매핑하고,
    read_property / write_property / who_is 인터페이스를 제공한다.
    """

    def __init__(self) -> None:
        self._devices: dict[int, BACnetDevice] = {}
        # ontology_id → device_id 역인덱스
        self._ontology_map: dict[str, int] = {}
        self._next_device_id = 1000
        self._next_object_counter: dict[str, int] = {}

    # ── 디바이스/오브젝트 등록 ──────────────────────────────────────────

    def register_device(self, ontology_id: str, device_name: str) -> BACnetDevice:
        """온톨로지 장비를 BACnet 디바이스로 등록한다."""
        if ontology_id in self._ontology_map:
            return self._devices[self._ontology_map[ontology_id]]

        device_id = self._next_device_id
        self._next_device_id += 1

        device = BACnetDevice(
            device_id=device_id,
            device_name=device_name,
            ontology_id=ontology_id,
        )
        self._devices[device_id] = device
        self._ontology_map[ontology_id] = device_id

        logger.debug("BACnet 디바이스 등록: %d → %s", device_id, ontology_id)
        return device

    def add_object(
        self,
        device_id: int,
        brick_point_id: str,
        brick_class: str,
        name: str = "",
        units: str = "",
    ) -> Optional[BACnetObject]:
        """디바이스에 BACnet 오브젝트를 추가한다."""
        device = self._devices.get(device_id)
        if device is None:
            logger.warning("존재하지 않는 디바이스: %d", device_id)
            return None

        obj_type = BRICK_TO_BACNET.get(brick_class, BACnetObjectType.ANALOG_VALUE)
        type_prefix = obj_type.value[:2].upper()

        # 오브젝트 ID 생성: "AI:1", "BO:2" ...
        counter_key = f"{device_id}:{type_prefix}"
        idx = self._next_object_counter.get(counter_key, 0) + 1
        self._next_object_counter[counter_key] = idx
        object_id = f"{type_prefix}:{idx}"

        obj = BACnetObject(
            object_id=object_id,
            object_type=obj_type,
            object_name=name or brick_point_id.replace("bldg:", ""),
            brick_point_id=brick_point_id,
            present_value=self._default_value(obj_type),
            units=units,
            description=f"Brick: {brick_class}",
        )
        device.objects[object_id] = obj
        return obj

    # ── BACnet 서비스 시뮬레이션 ────────────────────────────────────────

    def who_is(
        self,
        low_limit: Optional[int] = None,
        high_limit: Optional[int] = None,
    ) -> list[dict[str, Any]]:
        """Who-Is 탐색 시뮬레이션 — 등록된 디바이스 목록 반환."""
        results = []
        for dev in self._devices.values():
            if low_limit is not None and dev.device_id < low_limit:
                continue
            if high_limit is not None and dev.device_id > high_limit:
                continue
            results.append({
                "device_id": dev.device_id,
                "device_name": dev.device_name,
                "ontology_id": dev.ontology_id,
                "vendor": dev.vendor,
                "model": dev.model,
                "object_count": len(dev.objects),
            })
        logger.info("Who-Is 응답: %d개 디바이스", len(results))
        return results

    def read_property(
        self,
        device_id: int,
        object_id: str,
        property_id: str = "presentValue",
    ) -> dict[str, Any]:
        """ReadProperty 시뮬레이션 — 오브젝트 속성 읽기."""
        device = self._devices.get(device_id)
        if device is None:
            return {"error": f"디바이스 {device_id} 없음", "success": False}

        obj = device.objects.get(object_id)
        if obj is None:
            return {"error": f"오브젝트 {object_id} 없음 (디바이스 {device_id})", "success": False}

        prop_map = {
            "presentValue": obj.present_value,
            "objectName": obj.object_name,
            "objectType": obj.object_type.value,
            "units": obj.units,
            "description": obj.description,
        }

        if property_id not in prop_map:
            return {"error": f"미지원 프로퍼티: {property_id}", "success": False}

        return {
            "success": True,
            "device_id": device_id,
            "object_id": object_id,
            "property": property_id,
            "value": prop_map[property_id],
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    def write_property(
        self,
        device_id: int,
        object_id: str,
        property_id: str,
        value: Any,
    ) -> dict[str, Any]:
        """WriteProperty 시뮬레이션 — 오브젝트 속성 쓰기."""
        device = self._devices.get(device_id)
        if device is None:
            return {"error": f"디바이스 {device_id} 없음", "success": False}

        obj = device.objects.get(object_id)
        if obj is None:
            return {"error": f"오브젝트 {object_id} 없음 (디바이스 {device_id})", "success": False}

        # 쓰기 가능한 오브젝트 타입 확인
        writable_types = {
            BACnetObjectType.ANALOG_OUTPUT,
            BACnetObjectType.ANALOG_VALUE,
            BACnetObjectType.BINARY_OUTPUT,
            BACnetObjectType.BINARY_VALUE,
            BACnetObjectType.MULTI_STATE_VALUE,
        }
        if obj.object_type not in writable_types:
            return {
                "error": f"읽기 전용 오브젝트: {object_id} ({obj.object_type.value})",
                "success": False,
            }

        if property_id != "presentValue":
            return {"error": f"쓰기 불가 프로퍼티: {property_id}", "success": False}

        old_value = obj.present_value
        obj.present_value = value

        logger.info(
            "BACnet WriteProperty: 디바이스=%d 오브젝트=%s 값=%s→%s",
            device_id, object_id, old_value, value,
        )

        return {
            "success": True,
            "device_id": device_id,
            "object_id": object_id,
            "property": property_id,
            "old_value": old_value,
            "new_value": value,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    # ── 조회 헬퍼 ──────────────────────────────────────────────────────

    def get_device(self, device_id: int) -> Optional[BACnetDevice]:
        """디바이스 ID로 조회."""
        return self._devices.get(device_id)

    def get_device_by_ontology_id(self, ontology_id: str) -> Optional[BACnetDevice]:
        """온톨로지 ID로 디바이스 조회."""
        dev_id = self._ontology_map.get(ontology_id)
        if dev_id is None:
            return None
        return self._devices.get(dev_id)

    def list_objects(self, device_id: int) -> list[dict[str, Any]]:
        """디바이스의 BACnet 오브젝트 목록 반환."""
        device = self._devices.get(device_id)
        if device is None:
            return []

        return [
            {
                "object_id": obj.object_id,
                "object_type": obj.object_type.value,
                "object_name": obj.object_name,
                "brick_point_id": obj.brick_point_id,
                "present_value": obj.present_value,
                "units": obj.units,
            }
            for obj in device.objects.values()
        ]

    @property
    def device_count(self) -> int:
        return len(self._devices)

    @property
    def total_object_count(self) -> int:
        return sum(len(d.objects) for d in self._devices.values())

    # ── 내부 헬퍼 ──────────────────────────────────────────────────────

    @staticmethod
    def _default_value(obj_type: BACnetObjectType) -> Any:
        """오브젝트 타입에 따른 기본값."""
        if obj_type in (BACnetObjectType.BINARY_INPUT, BACnetObjectType.BINARY_OUTPUT, BACnetObjectType.BINARY_VALUE):
            return False
        if obj_type == BACnetObjectType.MULTI_STATE_VALUE:
            return 1
        return 0.0


# 싱글턴 인스턴스
bacnet_sim = BACnetSimulator()

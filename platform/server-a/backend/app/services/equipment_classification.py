"""
장비 카테고리 분류 서비스.
Brick Schema 클래스 기반 2단계 분류 체계를 제공한다.

1단계 대분류: HVAC / 전기·수송 / 부품
2단계 HVAC 서브분류: 냉방 / 난방 / 공조
"""

from __future__ import annotations

from typing import Optional

# ── 카테고리 매핑 ──
# Brick 클래스명 → (대분류, 서브분류)
_CATEGORY_MAP: dict[str, tuple[str, Optional[str]]] = {
    # HVAC - 냉방
    "Chiller": ("hvac", "cooling"),
    "Cooling_Tower": ("hvac", "cooling"),
    "Chilled_Water_Pump": ("hvac", "cooling"),
    "Condenser_Water_Pump": ("hvac", "cooling"),
    "Chilled_Ceiling_Panel": ("hvac", "cooling"),
    # HVAC - 난방
    "Boiler": ("hvac", "heating"),
    "Hot_Water_Pump": ("hvac", "heating"),
    # HVAC - 공조
    "AHU": ("hvac", "air_handling"),
    "Air_Handler_Unit": ("hvac", "air_handling"),
    "Supply_Fan": ("hvac", "air_handling"),
    "Return_Fan": ("hvac", "air_handling"),
    "Exhaust_Fan": ("hvac", "air_handling"),
    "Fan": ("hvac", "air_handling"),
    "Fan_Coil_Unit": ("hvac", "air_handling"),
    "Pump": ("hvac", "air_handling"),
    # 전기·수송
    "Elevator": ("electrical_transport", None),
    # 부품 (상위 장비 종속)
    "Valve": ("component", None),
    "Damper": ("component", None),
    "VFD": ("component", None),
    "Heat_Exchanger": ("component", None),
    "CRAC": ("component", None),
    "Condenser": ("component", None),
    "Compressor": ("component", None),
    # ── 전기 인프라 ──
    "Transformer": ("electrical", "power_distribution"),
    "UPS": ("electrical", "power_protection"),
    "Switchgear": ("electrical", "power_distribution"),
    "Emergency_Generator": ("electrical", "emergency_power"),
    "Electrical_Equipment": ("electrical", "power_distribution"),
    "Building_Electrical_Meter": ("electrical", "metering"),
    # ── 수자원 ──
    "Water_Pump": ("water", "pumping"),
    # ── 특수 HVAC ──
    "HVAC_Equipment": ("hvac", "special"),
    # ── 자동화/제어 ──
    "Controller": ("automation", "controller"),
    # ── 조명 ──
    "Lighting_Equipment": ("lighting", None),
    # ── 시스템 (논리적) ──
    "HVAC_System": ("hvac", None),
    "Electrical_System": ("electrical", None),
    "Lighting_System": ("lighting", None),
    "Water_System": ("water", None),
    "Equipment_System": ("system", None),
    # ── 서브시스템 (토폴로지 트리 노드) ──
    "Chilled_Ceiling_System": ("hvac", "cooling"),
    "Chiller_Plant": ("hvac", "cooling"),
    "DALI_Lighting_System": ("lighting", None),
    "Double_Skin_Facade_System": ("hvac", "special"),
    "Light_Shelf_System": ("lighting", None),
    "Night_Purge_System": ("hvac", "air_handling"),
    "Radiant_Heating_System": ("hvac", "heating"),
    "Rainwater_Harvesting_System": ("water", None),
    "UFAD_System": ("hvac", "air_handling"),
    "Wastewater_Treatment_System": ("water", None),
    # ── 토폴로지 장비 확장 ──
    "Floor_Diffuser": ("hvac", "air_handling"),
    "Distribution_Header": ("hvac", "distribution"),
    "Radiant_Heating_Panel": ("hvac", "heating"),
    "DSF_Louver": ("hvac", "special"),
    "Building_Automation_System": ("automation", "bms"),
    "Fire_Safety_System": ("safety", "fire"),
    "Security_System": ("safety", "security"),
    "Solar_PV_System": ("electrical", "renewable"),
}

# Server B CONTROLLABLE_EQUIPMENT과 동기화 (server-b/app/neo4j_loader.py:25-57)
CONTROLLABLE_TYPES: set[str] = {
    "AHU", "Chiller", "Boiler", "Cooling_Tower",
    "Fan_Coil_Unit", "Exhaust_Fan", "Supply_Fan",
    "Chilled_Water_Pump", "Condenser_Water_Pump",
    "Hot_Water_Pump", "Pump",
    "Chilled_Ceiling_Panel", "Elevator",
    "Valve", "Damper", "VFD", "Water_Pump",
    "Transformer", "UPS", "Emergency_Generator", "Switchgear",
    "HVAC_Equipment", "Controller", "Lighting_Equipment",
    "Floor_Diffuser", "Distribution_Header", "Radiant_Heating_Panel",
    "DSF_Louver", "Building_Automation_System",
    "Fire_Safety_System", "Security_System", "Solar_PV_System",
}


# ── 이름 기반 카테고리 매핑 (generic Equipment 노드용) ──
_NAME_CATEGORY_MAP: dict[str, tuple[str, Optional[str]]] = {
    # 소방/방재
    "Fire_Detection": ("safety", "fire"),
    "Sprinkler": ("safety", "fire"),
    "Smoke_Control": ("safety", "fire"),
    "Emergency_Broadcast": ("safety", "fire"),
    "Fire_Hydrant": ("safety", "fire"),
    # 보안/출입
    "Access_Control": ("safety", "security"),
    "CCTV": ("safety", "security"),
    "Parking_Management": ("safety", "security"),
    "Intercom": ("safety", "security"),
    # 비상통신
    "Emergency_Communication": ("safety", "emergency"),
    "Emergency_Phone": ("safety", "emergency"),
    # 전기/태양광/피뢰
    "PV_Inverter": ("electrical", "renewable"),
    "Solar_Panel": ("electrical", "renewable"),
    "Lightning": ("electrical", "protection"),
    "Ground_Electrode": ("electrical", "protection"),
    # 수자원
    "Rainwater": ("water", None),
    "Wastewater": ("water", None),
    "Grease_Trap": ("water", None),
    "Pressure_Tank": ("water", None),
    # BMS
    "BMS": ("automation", "bms"),
}


def classify_equipment(
    brick_labels: list[str],
    equipment_name: str = "",
) -> dict[str, Optional[str | bool]]:
    """
    Brick 라벨 목록에서 카테고리 분류를 반환한다.
    generic Equipment 노드는 이름 기반으로 추가 분류.

    Returns:
        {"category": "hvac", "subcategory": "cooling", "controllable": True}
    """
    for label in brick_labels:
        if label in _CATEGORY_MAP:
            cat, sub = _CATEGORY_MAP[label]
            return {
                "category": cat,
                "subcategory": sub,
                "controllable": label in CONTROLLABLE_TYPES,
            }
    # generic Equipment → 이름 기반 분류
    if equipment_name:
        for prefix, (cat, sub) in _NAME_CATEGORY_MAP.items():
            if prefix in equipment_name:
                return {
                    "category": cat,
                    "subcategory": sub,
                    "controllable": False,
                }
    return {
        "category": None,
        "subcategory": None,
        "controllable": False,
    }

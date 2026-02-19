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
}

# Server B CONTROLLABLE_EQUIPMENT과 동기화 (server-b/app/neo4j_loader.py:25-39)
CONTROLLABLE_TYPES: set[str] = {
    "AHU", "Chiller", "Boiler", "Cooling_Tower",
    "Fan_Coil_Unit", "Exhaust_Fan", "Supply_Fan",
    "Chilled_Water_Pump", "Condenser_Water_Pump",
    "Hot_Water_Pump", "Pump",
    "Chilled_Ceiling_Panel", "Elevator",
}


def classify_equipment(
    brick_labels: list[str],
) -> dict[str, Optional[str | bool]]:
    """
    Brick 라벨 목록에서 카테고리 분류를 반환한다.

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
    return {
        "category": None,
        "subcategory": None,
        "controllable": False,
    }

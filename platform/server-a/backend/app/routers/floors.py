"""
층별 상세 API 라우터

엔드포인트:
  GET /api/floors/{floor_key}/details — 층별 Room + 장비 목록 + 면적 합계
"""

from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

from app.services import neo4j_service

router = APIRouter(prefix="/api/floors", tags=["층별 상세"])


class FloorRoomResponse(BaseModel):
    id: str
    label: str | None = None
    spaceType: str | None = None
    area_m2: float | None = None
    zone_key: str | None = None
    sensor_ids: dict[str, str | None] = {}


class FloorEquipmentResponse(BaseModel):
    id: str
    name: str
    label: str | None = None
    type: str
    category: str | None = None
    subcategory: str | None = None
    controllable: bool = False
    location: str | None = None


class FloorDetailsResponse(BaseModel):
    floor_key: str
    rooms: list[FloorRoomResponse] = []
    equipment: list[FloorEquipmentResponse] = []
    total_area_m2: float = 0.0


@router.get("/{floor_key}/details", response_model=FloorDetailsResponse)
async def get_floor_details(floor_key: str) -> FloorDetailsResponse:
    """층별 상세 정보 — Room 목록, 장비 목록, 면적 합계."""
    rooms = await neo4j_service.get_floor_rooms(floor_key)
    equipment = await neo4j_service.get_floor_equipment(floor_key)
    total_area = sum(r.get("area_m2") or 0 for r in rooms)
    return FloorDetailsResponse(
        floor_key=floor_key,
        rooms=[FloorRoomResponse(**r) for r in rooms],
        equipment=[FloorEquipmentResponse(**e) for e in equipment],
        total_area_m2=total_area,
    )

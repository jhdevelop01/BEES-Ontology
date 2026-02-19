"""
Neo4j 비동기 로더 모듈.

Neo4j GraphDB에서 GEC B동 장비와 연결 포인트를 쿼리하여
시뮬레이션 엔진에서 사용할 수 있는 형태로 반환한다.

Phase 2: 845개 인스턴스 전체를 Neo4j에서 자동 로딩.
"""

import logging
from typing import Optional

from neo4j import AsyncGraphDatabase

from .config import settings

logger = logging.getLogger("server-c.neo4j_loader")


# ─────────────────────────────────────────────────────────────
# 상수
# ─────────────────────────────────────────────────────────────

BLDG_NS = "https://example.org/gec-b#"

# 시뮬레이션 대상 장비 라벨 (Neo4j 노드 라벨)
SIMULATABLE_EQUIPMENT_LABELS: set[str] = {
    "AHU",
    "Chiller",
    "Boiler",
    "Cooling_Tower",
    "Fan_Coil_Unit",
    "Exhaust_Fan",
    "Supply_Fan",
    "Chilled_Water_Pump",
    "Condenser_Water_Pump",
    "Hot_Water_Pump",
    "Pump",
    "Elevator",
    "Chilled_Ceiling_Panel",
    "Building_Electrical_Meter",
}

# 장비가 아닌 일반 노드 라벨 (필터링 대상)
_NON_SPECIFIC_LABELS: set[str] = {
    "Resource",
    "Equipment",
    "HVAC_Equipment",
    "Point",
    "Sensor",
    "Command",
    "Setpoint",
    "Status",
    "Alarm",
}


# ─────────────────────────────────────────────────────────────
# 유틸리티 함수
# ─────────────────────────────────────────────────────────────

def _uri_to_brick_id(uri: str) -> str:
    """
    전체 URI를 bldg:XXX 형식의 축약 ID로 변환.

    예시:
        'https://example.org/gec-b#AHU_5F' → 'bldg:AHU_5F'
        'AHU_5F' → 'bldg:AHU_5F'  (이미 로컬이름인 경우)
        'n4ind://bldg/AHU_5F' → 'bldg:AHU_5F'

    Parameters:
        uri: 전체 URI 또는 로컬 이름

    Returns:
        'bldg:' 접두사를 붙인 축약 ID
    """
    if uri.startswith(BLDG_NS):
        local_name = uri[len(BLDG_NS):]
        return f"bldg:{local_name}"

    # n10s MAP 모드의 경우 URI 형태가 다를 수 있음
    if "#" in uri:
        local_name = uri.rsplit("#", 1)[1]
        return f"bldg:{local_name}"

    if "/" in uri:
        local_name = uri.rsplit("/", 1)[1]
        return f"bldg:{local_name}"

    # 이미 로컬 이름인 경우
    if uri.startswith("bldg:"):
        return uri

    return f"bldg:{uri}"


def _extract_primary_class(labels: list[str]) -> str:
    """
    Neo4j 노드의 라벨 목록에서 가장 구체적인 Brick 클래스를 추출.

    Neo4j에서는 Brick 계층 전체가 라벨로 붙으므로
    (예: [Resource, Equipment, HVAC_Equipment, AHU])
    가장 구체적인 라벨을 선택해야 한다.

    Parameters:
        labels: Neo4j 노드의 라벨 목록

    Returns:
        가장 구체적인 Brick 클래스명 (예: 'AHU')
        매칭 실패 시 첫 번째 라벨 반환
    """
    # 일반적인 상위 라벨 제외하고 가장 구체적인 것 선택
    specific_labels = [lb for lb in labels if lb not in _NON_SPECIFIC_LABELS]

    if specific_labels:
        # 가장 긴 이름이 보통 가장 구체적 (예: 'Chilled_Water_Pump' > 'Pump')
        return max(specific_labels, key=len)

    # 모두 일반 라벨인 경우 마지막 것 반환 (보통 가장 구체적)
    return labels[-1] if labels else "Equipment"


# ─────────────────────────────────────────────────────────────
# Neo4j 로더
# ─────────────────────────────────────────────────────────────

async def load_equipment_from_neo4j() -> list[tuple[str, str, str, list[tuple[str, str]]]]:
    """
    Neo4j에서 시뮬레이션 대상 장비와 연결 포인트를 로딩.

    Returns:
        리스트 of (equipment_id, brick_class, location_id, points)
        - equipment_id: 'bldg:AHU_5F' 형식
        - brick_class: 'AHU' 등 Brick 클래스명
        - location_id: 'bldg:Floor_5F' 등 위치 ID (없으면 'unknown')
        - points: [(point_id, point_brick_class), ...] 튜플 리스트

        Neo4j 연결 실패 또는 데이터 없으면 빈 리스트 반환 (Phase 1 폴백용).
    """
    driver = None
    try:
        logger.info(f"Neo4j 연결 시도: {settings.NEO4J_URI}")
        driver = AsyncGraphDatabase.driver(
            settings.NEO4J_URI,
            auth=(settings.NEO4J_USER, settings.NEO4J_PASSWORD),
        )

        # 연결 테스트
        async with driver.session() as session:
            result = await session.run("RETURN 1 AS test")
            await result.single()
        logger.info("Neo4j 연결 성공")

        equipment_list = []

        # ── Step 1: 시뮬레이션 대상 장비 노드 쿼리 ──
        # SIMULATABLE_EQUIPMENT_LABELS에 해당하는 라벨을 가진 노드 조회
        equipment_query = """
        MATCH (e)
        WHERE any(label IN labels(e) WHERE label IN $target_labels)
        OPTIONAL MATCH (e)-[:hasLocation]->(loc)
        RETURN e.uri AS uri, labels(e) AS labels,
               loc.uri AS location_uri
        ORDER BY e.uri
        """

        async with driver.session() as session:
            result = await session.run(
                equipment_query,
                target_labels=list(SIMULATABLE_EQUIPMENT_LABELS),
            )
            equipment_records = await result.data()

        logger.info(f"장비 노드 {len(equipment_records)}개 발견")

        if not equipment_records:
            logger.warning("시뮬레이션 대상 장비가 없습니다")
            return []

        # ── Step 2: 각 장비에 연결된 포인트 쿼리 ──
        points_query = """
        MATCH (p)-[:isPointOf]->(e)
        WHERE e.uri = $equipment_uri
        RETURN p.uri AS uri, labels(p) AS labels
        ORDER BY p.uri
        """

        for record in equipment_records:
            eq_uri = record.get("uri")
            if not eq_uri:
                continue

            eq_labels = record.get("labels", [])
            loc_uri = record.get("location_uri")

            equipment_id = _uri_to_brick_id(eq_uri)
            brick_class = _extract_primary_class(eq_labels)
            location_id = _uri_to_brick_id(loc_uri) if loc_uri else "unknown"

            # 연결 포인트 조회
            points = []
            async with driver.session() as session:
                result = await session.run(points_query, equipment_uri=eq_uri)
                point_records = await result.data()

            for pt_record in point_records:
                pt_uri = pt_record.get("uri")
                pt_labels = pt_record.get("labels", [])
                if pt_uri:
                    point_id = _uri_to_brick_id(pt_uri)
                    point_class = _extract_primary_class(pt_labels)
                    points.append((point_id, point_class))

            equipment_list.append((equipment_id, brick_class, location_id, points))
            logger.debug(
                f"장비 로딩: {equipment_id} ({brick_class}) — "
                f"포인트 {len(points)}개, 위치: {location_id}"
            )

        logger.info(
            f"Neo4j 로딩 완료: 장비 {len(equipment_list)}개, "
            f"포인트 총 {sum(len(pts) for _, _, _, pts in equipment_list)}개"
        )
        return equipment_list

    except Exception as e:
        logger.warning(f"Neo4j 로딩 실패 (Phase 1 폴백 사용): {e}")
        return []

    finally:
        if driver:
            try:
                await driver.close()
            except Exception:
                pass

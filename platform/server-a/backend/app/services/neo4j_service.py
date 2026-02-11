"""
Neo4j 그래프 DB 서비스
온톨로지 기반 건물 토폴로지 조회 및 Brick 인스턴스 검색을 담당한다.
"""

import logging
from typing import Any

from neo4j import AsyncGraphDatabase, AsyncDriver

from app.config import NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD

logger = logging.getLogger(__name__)

_driver: AsyncDriver | None = None


async def connect() -> None:
    """Neo4j 드라이버 초기화"""
    global _driver
    _driver = AsyncGraphDatabase.driver(
        NEO4J_URI,
        auth=(NEO4J_USER, NEO4J_PASSWORD),
    )
    # 연결 확인
    try:
        async with _driver.session() as session:
            result = await session.run("RETURN 1 AS n")
            await result.single()
        logger.info("Neo4j 연결 성공: %s", NEO4J_URI)
    except Exception as e:
        logger.warning("Neo4j 연결 실패 (서비스는 계속 실행): %s", e)


async def disconnect() -> None:
    """Neo4j 드라이버 종료"""
    global _driver
    if _driver:
        await _driver.close()
        _driver = None
        logger.info("Neo4j 연결 종료")


async def get_topology_tree() -> list[dict[str, Any]]:
    """
    건물 계층 트리 조회.
    Site → Building → Floor → Zone → Equipment 순서로 트리 JSON 반환.
    """
    if not _driver:
        return _get_fallback_topology()

    try:
        async with _driver.session() as session:
            # 건물 계층 관계 조회 (isPartOf 역방향 = hasPart)
            result = await session.run("""
                MATCH (site)-[:hasPart]->(building)-[:hasPart]->(floor)
                WHERE site.uri CONTAINS 'Samsung_GEC'
                  AND building.uri CONTAINS 'GEC_Tower_B'
                OPTIONAL MATCH (floor)-[:hasPart]->(zone)
                OPTIONAL MATCH (zone)-[:hasPart]->(equip)
                RETURN
                    site.uri AS site,
                    building.uri AS building,
                    floor.uri AS floor,
                    labels(floor) AS floor_labels,
                    zone.uri AS zone,
                    labels(zone) AS zone_labels,
                    equip.uri AS equipment,
                    labels(equip) AS equip_labels
                ORDER BY floor.uri, zone.uri, equip.uri
            """)

            records = [record.data() async for record in result]

            if not records:
                return _get_fallback_topology()

            return _build_tree_from_records(records)

    except Exception as e:
        logger.warning("토폴로지 트리 조회 실패: %s", e)
        return _get_fallback_topology()


async def search_instances(query: str, limit: int = 20) -> list[dict[str, Any]]:
    """
    Brick 인스턴스 검색.
    URI, 라벨, 클래스명으로 검색 가능.
    """
    if not _driver:
        return _get_fallback_search(query)

    try:
        async with _driver.session() as session:
            result = await session.run("""
                MATCH (n)
                WHERE n.uri CONTAINS $query
                   OR any(label IN labels(n) WHERE label CONTAINS $query)
                RETURN n.uri AS uri, labels(n) AS labels
                LIMIT $limit
            """, query=query, limit=limit)

            records = [record.data() async for record in result]

            if not records:
                return _get_fallback_search(query)

            return [
                {
                    "uri": r["uri"],
                    "labels": r["labels"],
                    "name": r["uri"].split("/")[-1] if r["uri"] else "",
                }
                for r in records
            ]

    except Exception as e:
        logger.warning("인스턴스 검색 실패: %s", e)
        return _get_fallback_search(query)


async def get_equipment_count() -> int:
    """전체 장비 수 조회"""
    if not _driver:
        return 42  # fallback

    try:
        async with _driver.session() as session:
            result = await session.run("""
                MATCH (n)
                WHERE any(label IN labels(n) WHERE
                    label = 'Equipment' OR
                    label CONTAINS 'AHU' OR
                    label CONTAINS 'Chiller' OR
                    label CONTAINS 'Boiler' OR
                    label CONTAINS 'Pump' OR
                    label CONTAINS 'Fan'
                )
                RETURN count(n) AS cnt
            """)
            record = await result.single()
            return record["cnt"] if record else 42
    except Exception:
        return 42


def _build_tree_from_records(records: list[dict]) -> list[dict]:
    """Neo4j 레코드를 트리 구조 JSON으로 변환"""
    tree: dict[str, Any] = {}

    for r in records:
        building_uri = r.get("building", "")
        floor_uri = r.get("floor", "")
        zone_uri = r.get("zone", "")
        equip_uri = r.get("equipment", "")

        if building_uri and building_uri not in tree:
            tree[building_uri] = {
                "id": building_uri,
                "name": _extract_name(building_uri),
                "type": "Building",
                "children": {},
            }

        if floor_uri and floor_uri not in tree.get(building_uri, {}).get("children", {}):
            tree.setdefault(building_uri, {"children": {}})["children"][floor_uri] = {
                "id": floor_uri,
                "name": _extract_name(floor_uri),
                "type": "Floor",
                "labels": r.get("floor_labels", []),
                "children": {},
            }

        if zone_uri:
            floor_node = tree.get(building_uri, {}).get("children", {}).get(floor_uri, {"children": {}})
            if zone_uri not in floor_node.get("children", {}):
                floor_node.setdefault("children", {})[zone_uri] = {
                    "id": zone_uri,
                    "name": _extract_name(zone_uri),
                    "type": "Zone",
                    "labels": r.get("zone_labels", []),
                    "children": [],
                }

            if equip_uri:
                zone_node = floor_node["children"][zone_uri]
                zone_node["children"].append({
                    "id": equip_uri,
                    "name": _extract_name(equip_uri),
                    "type": "Equipment",
                    "labels": r.get("equip_labels", []),
                })

    # dict를 list로 변환
    result = []
    for b_key, b_val in tree.items():
        building = {**b_val, "children": []}
        for f_key, f_val in b_val.get("children", {}).items():
            floor = {**f_val, "children": []}
            for z_key, z_val in f_val.get("children", {}).items():
                floor["children"].append(z_val)
            building["children"].append(floor)
        result.append(building)

    return result


def _extract_name(uri: str) -> str:
    """URI에서 이름 추출"""
    if not uri:
        return ""
    # 일반적으로 # 또는 / 뒤의 마지막 부분
    for sep in ("#", "/"):
        if sep in uri:
            return uri.rsplit(sep, 1)[-1]
    return uri


def _get_fallback_topology() -> list[dict]:
    """Neo4j 미연결 시 폴백 토폴로지 (GEC B동 구조 기반)"""
    floors = []
    floor_map = {
        "B4F": "지하4층 (주차장)",
        "B3F": "지하3층 (주차장)",
        "B2F": "지하2층 (주차장/기계실)",
        "B1F": "지하1층 (기계실/MDF)",
        "1F": "1층 (로비)",
        "2F": "2층 (사무실)",
        "3F": "3층 (사무실)",
        "4F": "4층 (사무실)",
        "5F": "5층 (사무실)",
        "6F": "6층 (사무실)",
        "7F": "7층 (사무실)",
        "8F": "8층 (사무실)",
        "9F": "9층 (사무실)",
        "10F": "10층 (사무실)",
        "RF": "옥상 (기계실)",
    }
    for floor_id, desc in floor_map.items():
        floors.append({
            "id": f"bldg:Floor_{floor_id}",
            "name": f"Floor_{floor_id}",
            "type": "Floor",
            "description": desc,
            "children": [],
        })

    return [{
        "id": "bldg:GEC_Tower_B",
        "name": "GEC_Tower_B",
        "type": "Building",
        "children": floors,
    }]


def _get_fallback_search(query: str) -> list[dict]:
    """Neo4j 미연결 시 폴백 검색 결과"""
    # AHU_5F 관련 기본 데이터 제공
    all_items = [
        {"uri": "bldg:AHU_5F", "labels": ["AHU", "Equipment"], "name": "AHU_5F"},
        {"uri": "bldg:AHU_5F_SAT", "labels": ["Supply_Air_Temperature_Sensor", "Point"], "name": "AHU_5F_SAT"},
        {"uri": "bldg:AHU_5F_RAT", "labels": ["Return_Air_Temperature_Sensor", "Point"], "name": "AHU_5F_RAT"},
        {"uri": "bldg:AHU_5F_MAT", "labels": ["Mixed_Air_Temperature_Sensor", "Point"], "name": "AHU_5F_MAT"},
        {"uri": "bldg:AHU_5F_Filter_DP", "labels": ["Filter_Differential_Pressure_Sensor", "Point"], "name": "AHU_5F_Filter_DP"},
        {"uri": "bldg:AHU_5F_Fan_Speed", "labels": ["Fan_Speed_Sensor", "Point"], "name": "AHU_5F_Fan_Speed"},
        {"uri": "bldg:Zone_Air_Temp_5F_Interior", "labels": ["Zone_Air_Temperature_Sensor", "Point"], "name": "Zone_Air_Temp_5F_Interior"},
        {"uri": "bldg:GEC_Tower_B", "labels": ["Building"], "name": "GEC_Tower_B"},
        {"uri": "bldg:Floor_5F", "labels": ["Floor"], "name": "Floor_5F"},
        {"uri": "bldg:Chiller_1", "labels": ["Chiller", "Equipment"], "name": "Chiller_1"},
    ]
    query_lower = query.lower()
    return [
        item for item in all_items
        if query_lower in item["name"].lower() or query_lower in str(item["labels"]).lower()
    ]

"""
Neo4j 그래프 DB 서비스
온톨로지 기반 건물 토폴로지 조회 및 Brick 인스턴스 검색을 담당한다.
"""

import logging
import re
import time
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


async def get_equipment_list(
    equipment_type: str | None = None, floor: str | None = None,
) -> list[dict[str, Any]]:
    """장비 목록 조회 — Equipment 라벨을 가진 모든 인스턴스."""
    if not _driver:
        return []
    try:
        async with _driver.session() as session:
            # Equipment 계열 라벨을 가진 노드 + 위치 정보
            result = await session.run("""
                MATCH (n)
                WHERE n.uri STARTS WITH 'https://example.org/gec-b#'
                  AND any(label IN labels(n) WHERE label IN [
                    'AHU', 'Chiller', 'Boiler', 'Pump', 'Fan', 'Cooling_Tower',
                    'FCU', 'Elevator', 'VFD', 'Heat_Exchanger', 'Valve',
                    'CRAC', 'Condenser', 'Compressor', 'Damper',
                    'Air_Handler_Unit', 'Cooling_Coil', 'Heating_Coil',
                    'Supply_Fan', 'Return_Fan', 'Exhaust_Fan'
                  ])
                OPTIONAL MATCH (n)-[:hasLocation]->(loc)
                WHERE loc.uri STARTS WITH 'https://example.org/gec-b#'
                RETURN n.uri AS uri, labels(n) AS labels,
                       loc.uri AS location_uri
                ORDER BY n.uri
            """)
            records = [record.data() async for record in result]
            # 응답 빌드
            equipment_list = []
            for rec in records:
                uri = rec.get("uri", "")
                labels = [l for l in rec.get("labels", []) if l != "Resource"]
                name = uri.rsplit("#", 1)[-1] if "#" in uri else uri
                brick_id = "bldg:" + name
                loc_uri = rec.get("location_uri")
                location = loc_uri.rsplit("#", 1)[-1] if loc_uri and "#" in loc_uri else None

                # type 필터
                if equipment_type:
                    if not any(equipment_type.lower() in l.lower() for l in labels):
                        continue
                # floor 필터
                if floor:
                    if not location or floor.lower() not in location.lower():
                        continue

                equipment_list.append({
                    "id": brick_id,
                    "name": name,
                    "brick_class": labels,
                    "location": location,
                    "type": next(
                        (l for l in labels if l not in ("Equipment", "Resource")),
                        "Equipment",
                    ),
                })
            return equipment_list
    except Exception as e:
        logger.warning("장비 목록 조회 실패: %s", e)
        return []


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


def _uri_to_brick_id(uri: str) -> str:
    """URI를 bldg:XXX 형태의 Brick ID로 변환"""
    if not uri:
        return ""
    if "https://example.org/gec-b#" in uri:
        return "bldg:" + uri.replace("https://example.org/gec-b#", "")
    return "bldg:" + _extract_name(uri)


def _classify_node_type(labels: list[str]) -> str:
    """Neo4j 라벨을 기반으로 노드 타입 분류 (Cytoscape.js 시각화용)"""
    if not labels:
        return "Other"

    # n10s 공통 라벨 제거 후 분류
    meaningful = [l for l in labels if l not in ("Resource", "Class", "Property")]
    if not meaningful:
        return "Other"

    labels_set = set(meaningful)

    # Location (먼저 체크 — Building, Floor, Site, Zone)
    if "Building" in labels_set:
        return "Building"
    if "Floor" in labels_set or "Storey" in labels_set:
        return "Floor"
    if "Site" in labels_set:
        return "Site"
    if any("Zone" in lbl for lbl in meaningful):
        return "Zone"
    if "Location" in labels_set or "Room" in labels_set:
        return "Location"
    location_keywords = ["Space", "Mechanical_Room", "Office", "Lobby", "Corridor"]
    for lk in location_keywords:
        if any(lk in lbl for lbl in meaningful):
            return "Location"

    # System
    if "System" in labels_set or any("System" in lbl for lbl in meaningful):
        return "System"

    # Equipment 하위 클래스 (구체적인 것 우선)
    equipment_types = [
        "AHU", "Chiller", "Boiler", "Pump", "Fan", "Cooling_Tower",
        "Heat_Exchanger", "VAV", "FCU", "PAC", "MAU", "HEX",
        "Damper", "Valve", "VFD", "Actuator", "Filter",
        "Diffuser", "Meter", "Panel", "Transformer",
        "Controller", "Server", "Header", "Pipe",
    ]
    for et in equipment_types:
        if et in labels_set or any(et in lbl for lbl in meaningful):
            return "Equipment"

    if "Equipment" in labels_set:
        return "Equipment"

    # Sensor / Point
    sensor_keywords = ["Sensor", "Setpoint", "Command", "Status", "Alarm", "Parameter", "Limit"]
    for sk in sensor_keywords:
        if sk in labels_set or any(sk in lbl for lbl in meaningful):
            return "Point"

    if "Point" in labels_set:
        return "Point"

    # Loop
    if any("Loop" in lbl for lbl in meaningful):
        return "System"

    return "Other"


_WRITE_KEYWORDS = re.compile(
    r"\b(CREATE|DELETE|SET|REMOVE|MERGE|DROP|DETACH)\b",
    re.IGNORECASE,
)

_DANGEROUS_PROCS = re.compile(
    r"\bCALL\s+(apoc\.(export|trigger)|dbms\.(security|cluster))",
    re.IGNORECASE,
)

# 공통 관계 타입 리스트 (Brick Schema 주요 관계)
_REL_TYPES = [
    "feeds", "isFedBy", "hasPart", "isPartOf",
    "hasLocation", "isLocationOf",
    "isPointOf", "hasPoint",
    "controls", "isControlledBy",
    "meters", "isMeteredBy",
    "regulates", "isRegulatedBy",
    "serves", "isServedBy",
    "hasAssociatedTag",
]


def sanitize_cypher(cypher: str) -> str | None:
    """
    Cypher 쿼리 안전성 검증.
    쓰기 작업 및 위험 프로시저 호출 차단, LIMIT 자동 추가.
    CALL은 읽기 전용 프로시저(db.labels 등)를 허용하되 위험 프로시저만 차단.
    Returns: 정제된 쿼리, 또는 None (차단 시).
    """
    if _WRITE_KEYWORDS.search(cypher):
        return None
    if _DANGEROUS_PROCS.search(cypher):
        return None
    if not re.search(r"\bLIMIT\b", cypher, re.IGNORECASE):
        cypher = cypher.rstrip().rstrip(";") + " LIMIT 200"
    return cypher


async def run_cypher_graph(cypher: str) -> dict[str, Any]:
    """
    Cypher 실행 후 결과를 Cytoscape.js 호환 그래프 포맷으로 변환.
    record.data()로 딕셔너리 변환 후 uri 필드를 기반으로 노드를 감지한다.
    """
    if not _driver:
        return {"nodes": [], "edges": [], "raw_results": [], "stats": {
            "node_count": 0, "edge_count": 0, "execution_ms": 0,
        }, "cypher": cypher}

    t0 = time.time()
    nodes_map: dict[str, dict] = {}
    edges_set: set[tuple[str, str, str]] = set()
    edges_list: list[dict] = []
    raw_results: list[dict] = []

    def _add_node(uri: str, labels: list[str] | None = None) -> None:
        if not uri or uri in nodes_map:
            return
        lbls = labels or []
        nodes_map[uri] = {
            "data": {
                "id": _uri_to_brick_id(uri),
                "label": _extract_name(uri),
                "type": _classify_node_type(lbls),
                "labels": lbls,
                "uri": uri,
            }
        }

    def _add_edge(src_uri: str, tgt_uri: str, rel_type: str) -> None:
        if not src_uri or not tgt_uri:
            return
        key = (src_uri, tgt_uri, rel_type)
        if key in edges_set:
            return
        edges_set.add(key)
        edges_list.append({
            "data": {
                "id": f"ce{len(edges_list)}",
                "source": _uri_to_brick_id(src_uri),
                "target": _uri_to_brick_id(tgt_uri),
                "label": rel_type,
                "type": rel_type,
            }
        })

    try:
        async with _driver.session() as session:
            result = await session.run(cypher)
            records = [record.data() async for record in result]
            raw_results = records

            # 레코드에서 노드 감지 (uri 필드가 있는 dict)
            for row in records:
                node_uris: list[str] = []
                for key, val in row.items():
                    if isinstance(val, dict) and "uri" in val:
                        uri = val["uri"]
                        lbls = [l for l in val.get("labels", []) if l != "Resource"] if "labels" in val else []
                        _add_node(uri, lbls)
                        node_uris.append(uri)
                    elif isinstance(val, str) and val.startswith("https://example.org/gec-b#"):
                        _add_node(val)
                        node_uris.append(val)

                # 같은 행에 2개 이상 노드가 있으면 엣지를 추론
                # (RETURN n, r, m 패턴에서 r이 관계 타입 문자열 또는 관계 딕셔너리)
                if len(node_uris) >= 2:
                    # 관계 타입 추출 시도
                    rel_type = "related"
                    for key, val in row.items():
                        if isinstance(val, dict) and "type" in val and not val.get("uri"):
                            rel_type = val.get("type", "related")
                            break
                        elif isinstance(val, str) and val not in node_uris and not val.startswith("http"):
                            rel_type = val
                            break

            # 노드가 없으면 URI 패턴으로 재시도
            if not nodes_map:
                for row in records:
                    for key, val in row.items():
                        if isinstance(val, str) and "example.org/gec-b#" in val:
                            _add_node(val)

            # labels가 비어있는 노드에 labels 보강
            need_labels = [uri for uri, n in nodes_map.items() if not n["data"]["labels"]]
            if need_labels:
                lbl_result = await session.run("""
                    MATCH (n) WHERE n.uri IN $uris
                    RETURN n.uri AS uri, labels(n) AS labels
                """, parameters={"uris": need_labels})
                lbl_records = [rec.data() async for rec in lbl_result]
                for lr in lbl_records:
                    uri = lr.get("uri", "")
                    if uri in nodes_map:
                        lbls = [l for l in lr.get("labels", []) if l != "Resource"]
                        nodes_map[uri]["data"]["labels"] = lbls
                        nodes_map[uri]["data"]["type"] = _classify_node_type(lbls)

            # 별도 엣지 조회: 감지된 노드들 사이의 실제 관계
            if nodes_map and len(nodes_map) <= 500:
                uri_list = list(nodes_map.keys())
                edge_result = await session.run("""
                    MATCH (a)-[r]->(b)
                    WHERE a.uri IN $uris AND b.uri IN $uris
                      AND type(r) IN $rel_types
                    RETURN a.uri AS source, b.uri AS target, type(r) AS rel_type
                """, parameters={"uris": uri_list, "rel_types": _REL_TYPES})
                edge_records = [rec.data() async for rec in edge_result]
                for er in edge_records:
                    _add_edge(er["source"], er["target"], er["rel_type"])

    except Exception as e:
        logger.warning("Cypher 그래프 실행 실패: %s — %s", cypher[:100], e)
        return {"nodes": [], "edges": [], "raw_results": [{"error": str(e)}],
                "stats": {"node_count": 0, "edge_count": 0, "execution_ms": 0},
                "cypher": cypher}

    elapsed_ms = round((time.time() - t0) * 1000, 1)
    nodes = list(nodes_map.values())

    return {
        "nodes": nodes,
        "edges": edges_list,
        "raw_results": raw_results,
        "stats": {
            "node_count": len(nodes),
            "edge_count": len(edges_list),
            "execution_ms": elapsed_ms,
        },
        "cypher": cypher,
    }


async def run_cypher(cypher: str, params: dict | None = None) -> list[dict[str, Any]]:
    """
    범용 Cypher 실행 — LLM 채팅 등에서 사용.
    Returns:
        list[dict]: 결과 레코드 리스트, 또는 [{"error": str}] on failure.
    """
    if not _driver:
        return [{"error": "Neo4j 연결이 설정되지 않았습니다."}]

    try:
        async with _driver.session() as session:
            result = await session.run(cypher, parameters=params or {})
            records = [record.data() async for record in result]
            return records
    except Exception as e:
        logger.warning("Cypher 실행 실패: %s — %s", cypher[:100], e)
        return [{"error": str(e)}]


async def get_graph_data(
    node_type: str | None = None,
    floor: str | None = None,
    limit: int = 1500,
) -> dict[str, Any]:
    """
    Cytoscape.js 호환 그래프 데이터 반환.
    nodes와 edges를 포함하며, 필터링 지원.
    """
    if not _driver:
        return _get_fallback_graph_data(node_type, floor, limit)

    try:
        async with _driver.session() as session:
            # --- 1) 노드 조회 ---
            where_clauses = []
            params: dict[str, Any] = {"limit": limit}

            if node_type:
                where_clauses.append(
                    "any(label IN labels(n) WHERE label CONTAINS $node_type)"
                )
                params["node_type"] = node_type

            if floor:
                where_clauses.append("n.uri CONTAINS $floor")
                params["floor"] = floor

            where_str = "WHERE " + " AND ".join(where_clauses) if where_clauses else ""

            # n10s 내부/스키마 노드 제외: URI 필수 + 스키마 노드 제외
            schema_exclude = (
                "n.uri IS NOT NULL "
                "AND n.uri STARTS WITH 'https://example.org/gec-b#' "
                "AND NOT any(l IN labels(n) WHERE l IN "
                "['DatatypeProperty', 'ObjectProperty', 'Class', 'Relationship', 'Property'])"
            )
            if where_clauses:
                full_where = f"WHERE {schema_exclude} AND " + " AND ".join(where_clauses)
            else:
                full_where = f"WHERE {schema_exclude}"

            node_query = f"""
                MATCH (n)
                {full_where}
                WITH n, size([(n)-[]-() | 1]) AS degree
                ORDER BY degree DESC
                RETURN n.uri AS uri, labels(n) AS labels
                LIMIT $limit
            """
            result = await session.run(node_query, parameters=params)
            node_records = [record.data() async for record in result]

            if not node_records:
                return _get_fallback_graph_data(node_type, floor, limit)

            # URI 집합 (엣지 필터링용)
            uri_set = {r["uri"] for r in node_records if r.get("uri")}
            primary_uris = set(uri_set)

            # 노드 생성
            nodes = []
            for r in node_records:
                uri = r.get("uri", "")
                lbls = r.get("labels", [])
                brick_id = _uri_to_brick_id(uri)
                nodes.append({
                    "data": {
                        "id": brick_id,
                        "label": _extract_name(uri),
                        "type": _classify_node_type(lbls),
                        "labels": lbls,
                        "uri": uri,
                        "secondary": False,
                    }
                })

            # --- 1-2) 타입 필터 시 이웃 노드 추가 ---
            if node_type:
                neighbor_query = """
                    MATCH (n)-[r]-(m)
                    WHERE n.uri IN $uris
                      AND m.uri IS NOT NULL
                      AND m.uri STARTS WITH 'https://example.org/gec-b#'
                      AND NOT any(l IN labels(m) WHERE l IN
                          ['DatatypeProperty','ObjectProperty','Class','Relationship','Property'])
                      AND NOT m.uri IN $uris
                      AND type(r) IN $rel_types
                    RETURN DISTINCT m.uri AS uri, labels(m) AS labels
                """
                result = await session.run(
                    neighbor_query,
                    parameters={"uris": list(uri_set), "rel_types": _REL_TYPES},
                )
                neighbor_records = [record.data() async for record in result]

                for r in neighbor_records:
                    uri = r.get("uri", "")
                    if uri and uri not in uri_set:
                        lbls = r.get("labels", [])
                        brick_id = _uri_to_brick_id(uri)
                        nodes.append({
                            "data": {
                                "id": brick_id,
                                "label": _extract_name(uri),
                                "type": _classify_node_type(lbls),
                                "labels": lbls,
                                "uri": uri,
                                "secondary": True,
                            }
                        })
                        uri_set.add(uri)

            # --- 2) 엣지 조회 ---
            edge_query = """
                MATCH (a)-[r]->(b)
                WHERE a.uri IN $uris AND b.uri IN $uris
                  AND type(r) IN $rel_types
                RETURN a.uri AS source, b.uri AS target, type(r) AS rel_type
            """
            result = await session.run(
                edge_query,
                parameters={"uris": list(uri_set), "rel_types": _REL_TYPES},
            )
            edge_records = [record.data() async for record in result]

            edges = []
            for idx, r in enumerate(edge_records):
                src_id = _uri_to_brick_id(r.get("source", ""))
                tgt_id = _uri_to_brick_id(r.get("target", ""))
                rel = r.get("rel_type", "")
                edges.append({
                    "data": {
                        "id": f"e{idx}",
                        "source": src_id,
                        "target": tgt_id,
                        "label": rel,
                        "type": rel,
                    }
                })

            # 통계 (primary 노드만 카운트)
            type_counts: dict[str, int] = {}
            primary_count = 0
            for n in nodes:
                if not n["data"].get("secondary"):
                    t = n["data"]["type"]
                    type_counts[t] = type_counts.get(t, 0) + 1
                    primary_count += 1

            return {
                "nodes": nodes,
                "edges": edges,
                "stats": {
                    "node_count": len(nodes),
                    "edge_count": len(edges),
                    "type_counts": type_counts,
                    "primary_count": primary_count,
                },
            }

    except Exception as e:
        logger.warning("그래프 데이터 조회 실패: %s", e)
        return _get_fallback_graph_data(node_type, floor, limit)


async def get_node_detail(node_id: str) -> dict[str, Any]:
    """
    노드 상세 정보 조회.
    URI, 이름, 라벨, 타입, 속성, 연결 목록을 반환.
    """
    if not _driver:
        return _get_fallback_node_detail(node_id)

    # node_id를 URI로 변환 (bldg:XXX → 전체 URI)
    if node_id.startswith("bldg:"):
        uri = "https://example.org/gec-b#" + node_id.replace("bldg:", "")
    else:
        uri = node_id

    try:
        async with _driver.session() as session:
            # 노드 속성 조회
            node_result = await session.run("""
                MATCH (n {uri: $uri})
                RETURN n.uri AS uri, labels(n) AS labels, properties(n) AS props
            """, uri=uri)
            node_record = await node_result.single()

            if not node_record:
                return _get_fallback_node_detail(node_id)

            node_data = node_record.data()
            lbls = node_data.get("labels", [])
            props = node_data.get("props", {})

            # 연결 관계 조회 (나가는 방향)
            out_result = await session.run("""
                MATCH (n {uri: $uri})-[r]->(m)
                RETURN type(r) AS rel_type, m.uri AS target_uri, labels(m) AS target_labels
            """, uri=uri)
            out_records = [record.data() async for record in out_result]

            # 연결 관계 조회 (들어오는 방향)
            in_result = await session.run("""
                MATCH (m)-[r]->(n {uri: $uri})
                RETURN type(r) AS rel_type, m.uri AS source_uri, labels(m) AS source_labels
            """, uri=uri)
            in_records = [record.data() async for record in in_result]

            connections = []
            for r in out_records:
                target_uri = r.get("target_uri", "")
                connections.append({
                    "direction": "outgoing",
                    "rel": r.get("rel_type", ""),
                    "target_uri": _uri_to_brick_id(target_uri),
                    "target_labels": r.get("target_labels", []),
                })

            for r in in_records:
                source_uri = r.get("source_uri", "")
                connections.append({
                    "direction": "incoming",
                    "rel": r.get("rel_type", ""),
                    "target_uri": _uri_to_brick_id(source_uri),
                    "target_labels": r.get("source_labels", []),
                })

            return {
                "uri": uri,
                "brick_id": _uri_to_brick_id(uri),
                "name": _extract_name(uri),
                "labels": lbls,
                "type": _classify_node_type(lbls),
                "properties": {k: v for k, v in props.items() if k != "uri"},
                "connections": connections,
                "stats": {
                    "outgoing": len(out_records),
                    "incoming": len(in_records),
                    "total": len(connections),
                },
            }

    except Exception as e:
        logger.warning("노드 상세 조회 실패: %s — %s", node_id, e)
        return _get_fallback_node_detail(node_id)


def _get_fallback_graph_data(
    node_type: str | None = None,
    floor: str | None = None,
    limit: int = 200,
) -> dict[str, Any]:
    """Neo4j 미연결 시 폴백 그래프 데이터"""
    fallback_nodes = [
        {"data": {"id": "bldg:GEC_Tower_B", "label": "GEC_Tower_B", "type": "Building", "labels": ["Building"], "uri": ""}},
        {"data": {"id": "bldg:Floor_5F", "label": "Floor_5F", "type": "Floor", "labels": ["Floor"], "uri": ""}},
        {"data": {"id": "bldg:AHU_5F", "label": "AHU_5F", "type": "Equipment", "labels": ["AHU", "Equipment"], "uri": ""}},
        {"data": {"id": "bldg:AHU_5F_SAT", "label": "AHU_5F_SAT", "type": "Point", "labels": ["Supply_Air_Temperature_Sensor", "Point"], "uri": ""}},
        {"data": {"id": "bldg:AHU_5F_RAT", "label": "AHU_5F_RAT", "type": "Point", "labels": ["Return_Air_Temperature_Sensor", "Point"], "uri": ""}},
        {"data": {"id": "bldg:Zone_5F_Interior", "label": "Zone_5F_Interior", "type": "Zone", "labels": ["HVAC_Zone"], "uri": ""}},
        {"data": {"id": "bldg:Chiller_1", "label": "Chiller_1", "type": "Equipment", "labels": ["Chiller", "Equipment"], "uri": ""}},
    ]
    fallback_edges = [
        {"data": {"id": "e0", "source": "bldg:GEC_Tower_B", "target": "bldg:Floor_5F", "label": "hasPart", "type": "hasPart"}},
        {"data": {"id": "e1", "source": "bldg:Floor_5F", "target": "bldg:Zone_5F_Interior", "label": "hasPart", "type": "hasPart"}},
        {"data": {"id": "e2", "source": "bldg:AHU_5F", "target": "bldg:AHU_5F_SAT", "label": "hasPoint", "type": "hasPoint"}},
        {"data": {"id": "e3", "source": "bldg:AHU_5F", "target": "bldg:AHU_5F_RAT", "label": "hasPoint", "type": "hasPoint"}},
        {"data": {"id": "e4", "source": "bldg:AHU_5F", "target": "bldg:Zone_5F_Interior", "label": "feeds", "type": "feeds"}},
    ]

    # 필터링 적용
    if node_type:
        fallback_nodes = [
            n for n in fallback_nodes
            if node_type.lower() in str(n["data"]["labels"]).lower()
               or node_type.lower() in n["data"]["type"].lower()
        ]

    return {
        "nodes": fallback_nodes[:limit],
        "edges": fallback_edges,
        "stats": {
            "node_count": len(fallback_nodes),
            "edge_count": len(fallback_edges),
            "type_counts": {"Building": 1, "Floor": 1, "Equipment": 2, "Point": 2, "Zone": 1},
        },
    }


def _get_fallback_node_detail(node_id: str) -> dict[str, Any]:
    """Neo4j 미연결 시 폴백 노드 상세"""
    name = node_id.replace("bldg:", "") if node_id.startswith("bldg:") else node_id
    return {
        "uri": "",
        "brick_id": node_id if node_id.startswith("bldg:") else f"bldg:{node_id}",
        "name": name,
        "labels": ["Unknown"],
        "type": "Other",
        "properties": {},
        "connections": [],
        "stats": {"outgoing": 0, "incoming": 0, "total": 0},
        "fallback": True,
    }


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

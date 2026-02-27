"""
온톨로지 API 라우터
Neo4j를 통한 Brick Schema 인스턴스 검색 및 건물 토폴로지 트리 조회.
"""

from typing import Any

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.services import neo4j_service


class CypherRequest(BaseModel):
    cypher: str

router = APIRouter(prefix="/api", tags=["온톨로지"])


@router.get("/ontology/search")
async def search_ontology(
    q: str = Query(..., description="검색어 (장비명, 클래스명, URI 일부)"),
    limit: int = Query(20, ge=1, le=100, description="최대 결과 수"),
) -> dict[str, Any]:
    """
    Brick 인스턴스 검색.
    URI, 라벨, 클래스명으로 검색 가능.
    """
    results = await neo4j_service.search_instances(q, limit=limit)
    return {
        "query": q,
        "count": len(results),
        "results": results,
    }


@router.get("/ontology/graph")
async def get_ontology_graph(
    node_type: str | None = Query(None, description="노드 타입 필터 (Equipment, Point, System 등)"),
    floor: str | None = Query(None, description="층 필터 (예: 5F, B1F)"),
    limit: int = Query(1500, ge=1, le=2000, description="최대 노드 수"),
) -> dict[str, Any]:
    """
    Cytoscape.js 호환 그래프 데이터 반환.
    온톨로지 그래프 시각화를 위한 노드/엣지 데이터.
    """
    data = await neo4j_service.get_graph_data(
        node_type=node_type,
        floor=floor,
        limit=limit,
    )
    return data


@router.post("/ontology/cypher")
async def run_cypher_query(body: CypherRequest) -> dict[str, Any]:
    """
    Cypher 쿼리 실행 (읽기 전용).
    결과를 Cytoscape.js 호환 그래프 포맷으로 반환.
    """
    sanitized = neo4j_service.sanitize_cypher(body.cypher)
    if sanitized is None:
        raise HTTPException(
            status_code=400,
            detail="쓰기 작업(CREATE/DELETE/SET/MERGE/DROP 등)은 허용되지 않습니다.",
        )
    return await neo4j_service.run_cypher_graph(sanitized)


@router.get("/ontology/node/{node_id:path}")
async def get_ontology_node(node_id: str) -> dict[str, Any]:
    """
    노드 상세 정보 조회.
    URI, 이름, 라벨, 타입, 속성, 연결 목록을 반환.
    """
    detail = await neo4j_service.get_node_detail(node_id)
    return detail


@router.get("/topology/tree")
async def get_topology_tree() -> dict[str, Any]:
    """
    건물 계층 트리 JSON 반환.
    Site → Building → Floor → Zone → Equipment 순서.
    """
    tree = await neo4j_service.get_topology_tree()
    return {
        "tree": tree,
        "source": "neo4j",
    }


@router.get("/topology/connections")
async def get_topology_connections() -> dict[str, Any]:
    """
    건물 내 장비 간 연결 관계(feeds) 조회.
    토폴로지 플로우 다이어그램 엣지용.
    """
    connections = await neo4j_service.get_topology_connections()
    return {
        "connections": connections,
        "count": len(connections),
    }


@router.get("/topology/zone-connections")
async def get_zone_connections() -> dict[str, Any]:
    """Zone과 장비 간 feeds 연결 관계."""
    result = await neo4j_service.get_zone_feeds()
    return result


# ── Fault Impact Models ──

class FaultImpactEquipment(BaseModel):
    name: str
    labels: list[str]
    depth: int
    impact_level: str  # "direct" | "indirect" | "extended"
    paths: list[list[str]] = []

class FaultImpactZone(BaseModel):
    name: str
    labels: list[str]
    depth: int
    impact_level: str  # "zone-affected"
    paths: list[list[str]] = []

class FaultImpactStats(BaseModel):
    total: int
    direct: int
    indirect: int
    extended: int

class FaultImpactResponse(BaseModel):
    source: str
    affected_equipment: list[FaultImpactEquipment]
    affected_zones: list[FaultImpactZone]
    stats: FaultImpactStats


@router.get("/topology/fault-impact", response_model=FaultImpactResponse)
async def get_fault_impact(
    equipment: str = Query(..., description="장비 이름 (예: Chiller_1)"),
    max_depth: int = Query(5, ge=1, le=5, description="최대 추적 깊이"),
) -> FaultImpactResponse:
    """
    장애 파급 효과 분석.
    지정된 장비에서 feeds 관계를 따라 영향받는 장비와 Zone을 추적.
    """
    result = await neo4j_service.get_fault_impact(equipment, max_depth=max_depth)
    return FaultImpactResponse(**result)

"""
온톨로지 API 라우터
Neo4j를 통한 Brick Schema 인스턴스 검색 및 건물 토폴로지 트리 조회.
"""

from typing import Any

from fastapi import APIRouter, Query

from app.services import neo4j_service

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
    limit: int = Query(200, ge=1, le=1000, description="최대 노드 수"),
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

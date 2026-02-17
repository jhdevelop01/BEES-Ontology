"""
장비 상세 API 라우터

엔드포인트:
  GET /api/equipment/{equipment_id}             — 장비 상세 (Neo4j + InfluxDB + PostgreSQL)
  GET /api/equipment/{equipment_id}/performance  — 성능 지표 (일/주/월 집계)
  GET /api/equipment/{equipment_id}/alarms       — 장비별 알람 이력
"""

import logging
from typing import Any, Optional

import httpx
from fastapi import APIRouter, HTTPException, Query

from app.config import SERVER_D_URL
from app.services import neo4j_service, mqtt_service, influxdb_service, postgres_service

logger = logging.getLogger("server-a.equipment")
router = APIRouter(prefix="/api/equipment", tags=["장비 상세"])


# ── 헬퍼 ─────────────────────────────────────────────────────────────────

def _get_pool():
    """PostgreSQL 풀 가져오기."""
    pool = postgres_service.get_pool()
    if pool is None:
        raise HTTPException(status_code=503, detail="PostgreSQL 미연결")
    return pool


def _extract_name(uri: str) -> str:
    """URI에서 이름 추출."""
    if not uri:
        return ""
    for sep in ("#", "/"):
        if sep in uri:
            return uri.rsplit(sep, 1)[-1]
    return uri


def _uri_to_brick_id(uri: str) -> str:
    """URI → bldg:XXX 변환."""
    if not uri:
        return ""
    if "https://example.org/gec-b#" in uri:
        return "bldg:" + uri.replace("https://example.org/gec-b#", "")
    return "bldg:" + _extract_name(uri)


def _brick_id_to_uri(brick_id: str) -> str:
    """bldg:XXX → URI 변환."""
    if brick_id.startswith("bldg:"):
        return "https://example.org/gec-b#" + brick_id.replace("bldg:", "")
    return "https://example.org/gec-b#" + brick_id


# ── API 엔드포인트 ────────────────────────────────────────────────────────

@router.get("/{equipment_id}")
async def get_equipment_detail(equipment_id: str) -> dict[str, Any]:
    """
    장비 상세 정보 조회.
    Neo4j(온톨로지) + InfluxDB(최신 센서값) + PostgreSQL(메타데이터) 통합.
    """
    uri = _brick_id_to_uri(equipment_id)

    # 1) Neo4j — 장비 정보 및 연결 관계
    neo4j_data = await neo4j_service.run_cypher(
        """
        MATCH (n) WHERE n.uri = $uri
        OPTIONAL MATCH (n)-[r]-(m)
        WHERE m.uri IS NOT NULL
          AND m.uri STARTS WITH 'https://example.org/gec-b#'
        RETURN n.uri AS uri, labels(n) AS labels, properties(n) AS props,
               type(r) AS rel_type,
               CASE WHEN startNode(r) = n THEN 'outgoing' ELSE 'incoming' END AS direction,
               m.uri AS connected_uri, labels(m) AS connected_labels
        """,
        {"uri": uri},
    )

    if not neo4j_data or "error" in neo4j_data[0]:
        raise HTTPException(status_code=404, detail=f"장비 '{equipment_id}' 을(를) 찾을 수 없습니다")

    # 노드 기본 정보
    first = neo4j_data[0]
    labels = first.get("labels", [])
    props = first.get("props", {})

    # 연결 관계 정리
    connections = []
    point_ids = []
    seen_connections = set()
    for rec in neo4j_data:
        conn_uri = rec.get("connected_uri")
        rel = rec.get("rel_type")
        direction = rec.get("direction")
        if conn_uri and rel:
            key = (conn_uri, rel, direction)
            if key not in seen_connections:
                seen_connections.add(key)
                conn_labels = rec.get("connected_labels", [])
                conn_brick_id = _uri_to_brick_id(conn_uri)
                connections.append({
                    "direction": direction,
                    "rel": rel,
                    "target_id": conn_brick_id,
                    "target_name": _extract_name(conn_uri),
                    "target_labels": conn_labels,
                })
                # 포인트(센서) 수집
                if any(lbl in str(conn_labels) for lbl in ["Sensor", "Setpoint", "Command", "Status", "Point"]):
                    point_ids.append(_extract_name(conn_uri))

    # 디바이스 상태 (MQTT 캐시)
    device_state = mqtt_service.get_latest_device(equipment_id)
    is_active = device_state.get("is_active", False) if device_state else None

    # 2) InfluxDB — 포인트 최신 센서값
    sensors = []
    point_cache = mqtt_service.get_point_cache()
    for pid in point_ids:
        cached = point_cache.get(pid)
        if cached:
            sensors.append(cached)
        else:
            # InfluxDB 직접 조회 시도
            latest = await influxdb_service.get_point_latest(pid)
            if latest:
                sensors.append(latest)

    # 3) PostgreSQL — 장비 메타데이터
    metadata = {}
    try:
        pool = postgres_service.get_pool()
        if pool:
            ontology_id = f"bldg:{equipment_id}" if not equipment_id.startswith("bldg:") else equipment_id
            async with pool.acquire() as conn:
                row = await conn.fetchrow(
                    "SELECT * FROM equipment_metadata WHERE ontology_id = $1",
                    ontology_id,
                )
                if row:
                    metadata = {
                        k: (v.isoformat() if hasattr(v, "isoformat") else v)
                        for k, v in dict(row).items()
                        if k not in ("id",)
                    }
    except Exception as e:
        logger.warning("장비 메타데이터 조회 실패: %s", e)

    # Location 추출
    location = None
    for conn in connections:
        if conn["rel"] == "hasLocation":
            location = conn["target_name"]
            break

    return {
        "id": equipment_id,
        "name": _extract_name(uri),
        "brick_class": [l for l in labels if l not in ("Resource",)],
        "location": location,
        "is_active": is_active,
        "sensors": sensors,
        "connections": connections,
        "metadata": metadata,
        "properties": {k: v for k, v in props.items() if k != "uri"},
    }


@router.get("/{equipment_id}/performance")
async def get_equipment_performance(
    equipment_id: str,
    period: str = Query("7d", description="분석 기간 (1d, 7d, 30d)"),
) -> dict[str, Any]:
    """
    장비 성능 지표 조회.
    InfluxDB 집계 쿼리로 평균/최소/최대값 및 가동률 계산.
    """
    uri = _brick_id_to_uri(equipment_id)

    # 장비의 포인트 목록 조회
    point_records = await neo4j_service.run_cypher(
        """
        MATCH (n {uri: $uri})-[:hasPoint|isPointOf*1]-(p)
        WHERE p.uri IS NOT NULL
          AND p.uri STARTS WITH 'https://example.org/gec-b#'
        RETURN p.uri AS point_uri, labels(p) AS point_labels
        """,
        {"uri": uri},
    )

    # 윈도우 설정
    window_map = {"1d": "1h", "7d": "6h", "30d": "1d"}
    window = window_map.get(period, "6h")

    sensor_stats = []
    for rec in point_records:
        if "error" in rec:
            continue
        point_uri = rec.get("point_uri", "")
        point_id = _extract_name(point_uri)

        data = await influxdb_service.query_point_history(
            point_id, f"-{period}", "now()", "mean", window,
        )
        if not data:
            continue

        values = [d["value"] for d in data if d.get("value") is not None]
        if values:
            sensor_stats.append({
                "id": point_id,
                "labels": rec.get("point_labels", []),
                "avg": round(sum(values) / len(values), 2),
                "min": round(min(values), 2),
                "max": round(max(values), 2),
                "data_points": len(values),
            })

    # 가동률 계산 (디바이스 상태 MQTT 캐시에서 추정)
    device_state = mqtt_service.get_latest_device(equipment_id)
    uptime_pct = 100.0 if device_state and device_state.get("is_active") else None

    return {
        "equipment_id": equipment_id,
        "period": period,
        "sensors": sensor_stats,
        "uptime_pct": uptime_pct,
    }


@router.get("/{equipment_id}/alarms")
async def get_equipment_alarms(
    equipment_id: str,
    days: int = Query(30, ge=1, le=365, description="조회 일수"),
) -> dict[str, Any]:
    """
    장비별 알람 이력 조회 — Server D 프록시.
    """
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{SERVER_D_URL}/alarm-history",
                params={"equipment": equipment_id, "limit": 100},
            )
            resp.raise_for_status()
            return resp.json()
    except httpx.HTTPStatusError as e:
        logger.error("장비 알람 이력 조회 실패: %s", e)
        raise HTTPException(status_code=e.response.status_code, detail=str(e))
    except httpx.RequestError as e:
        logger.warning("Server D 연결 실패 — 빈 결과 반환: %s", e)
        return {"total": 0, "items": []}

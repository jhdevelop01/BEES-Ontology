"""
Server B Neo4j 디바이스 로더.

Neo4j에서 GEC B동 장비를 조회하여 DeviceRegistry에 자동 등록한다.
Phase 2: 279개 전체 장비 자동 로딩.
Phase 4.5: Neo4j 연결 재시도 로직 추가 — 컨테이너 기동 순서 문제 해결.
"""

import asyncio
import logging
from typing import Optional

from neo4j import AsyncGraphDatabase

from .config import settings
from .device_registry import DeviceInfo, registry

logger = logging.getLogger("server-b.neo4j_loader")


# Neo4j URI에서 bldg: 접두사 ID로 변환
BLDG_NS = "https://example.org/gec-b#"

# 장비 유형별 제어 가능 여부 및 허용 명령
CONTROLLABLE_EQUIPMENT: dict[str, list[str]] = {
    "AHU": ["ON", "OFF", "setpoint"],
    "Fan_Coil_Unit": ["ON", "OFF", "setpoint"],
    "Chiller": ["ON", "OFF", "setpoint"],
    "Boiler": ["ON", "OFF", "setpoint"],
    "Cooling_Tower": ["ON", "OFF"],
    "Exhaust_Fan": ["ON", "OFF"],
    "Supply_Fan": ["ON", "OFF"],
    "Chilled_Water_Pump": ["ON", "OFF"],
    "Condenser_Water_Pump": ["ON", "OFF"],
    "Hot_Water_Pump": ["ON", "OFF"],
    "Pump": ["ON", "OFF"],
    "Chilled_Ceiling_Panel": ["ON", "OFF"],
    "Elevator": ["ON", "OFF"],
}

# 일반적인 상위 라벨 (필터링 대상)
_NON_SPECIFIC_LABELS: set[str] = {
    "Resource", "Equipment", "HVAC_Equipment",
    "Point", "Sensor", "Command", "Setpoint", "Status", "Alarm",
}


def _uri_to_brick_id(uri: str) -> str:
    """전체 URI → bldg:XXX 형식 변환."""
    if uri.startswith(BLDG_NS):
        return f"bldg:{uri[len(BLDG_NS):]}"
    if "#" in uri:
        return f"bldg:{uri.rsplit('#', 1)[1]}"
    if "/" in uri:
        return f"bldg:{uri.rsplit('/', 1)[1]}"
    if uri.startswith("bldg:"):
        return uri
    return f"bldg:{uri}"


def _extract_primary_class(labels: list[str]) -> str:
    """Neo4j 라벨에서 가장 구체적인 Brick 클래스를 추출."""
    specific = [lb for lb in labels if lb not in _NON_SPECIFIC_LABELS]
    if specific:
        return max(specific, key=len)
    return labels[-1] if labels else "Equipment"


def _extract_name(uri: str) -> str:
    """URI에서 사람이 읽기 좋은 이름 추출."""
    brick_id = _uri_to_brick_id(uri)
    local_name = brick_id.replace("bldg:", "")
    return local_name.replace("_", " ")


async def load_devices_from_neo4j() -> int:
    """
    Neo4j에서 장비를 조회하여 DeviceRegistry에 자동 등록.

    Returns:
        등록된 장비 수. Neo4j 실패 시 0 반환 (Phase 1 폴백 유지).
    """
    driver = None
    try:
        logger.info("Neo4j 연결 시도: %s", settings.NEO4J_URI)
        driver = AsyncGraphDatabase.driver(
            settings.NEO4J_URI,
            auth=(settings.NEO4J_USER, settings.NEO4J_PASSWORD),
        )

        # 연결 테스트
        async with driver.session() as session:
            result = await session.run("RETURN 1 AS test")
            await result.single()
        logger.info("Neo4j 연결 성공")

        # 장비 노드 조회 (제어 가능한 유형)
        target_labels = list(CONTROLLABLE_EQUIPMENT.keys())
        query = """
        MATCH (e)
        WHERE any(label IN labels(e) WHERE label IN $target_labels)
        OPTIONAL MATCH (e)-[:hasLocation]->(loc)
        RETURN e.uri AS uri, labels(e) AS labels, loc.uri AS location_uri
        ORDER BY e.uri
        """

        async with driver.session() as session:
            result = await session.run(query, target_labels=target_labels)
            records = await result.data()

        if not records:
            logger.warning("Neo4j에서 제어 가능 장비를 찾지 못했습니다")
            return 0

        count = 0
        for record in records:
            eq_uri = record.get("uri")
            if not eq_uri:
                continue

            eq_labels = record.get("labels", [])
            loc_uri = record.get("location_uri")

            equipment_id = _uri_to_brick_id(eq_uri)
            brick_class = _extract_primary_class(eq_labels)
            location = _uri_to_brick_id(loc_uri) if loc_uri else "unknown"
            name = _extract_name(eq_uri)

            # 이미 등록된 장비는 스킵 (Phase 1 하드코딩 유지)
            if registry.exists(equipment_id):
                continue

            # 제어 가능 여부 및 허용 명령 결정
            allowed_commands = CONTROLLABLE_EQUIPMENT.get(brick_class, [])
            controllable = len(allowed_commands) > 0

            registry.register(DeviceInfo(
                ontology_id=equipment_id,
                name=name,
                device_type=brick_class,
                location=location,
                controllable=controllable,
                allowed_commands=allowed_commands,
            ))
            count += 1

        logger.info(
            "Neo4j 디바이스 로딩 완료: %d개 신규 등록 (전체 %d개)",
            count, registry.count,
        )
        return count

    except Exception as e:
        logger.warning("Neo4j 디바이스 로딩 실패 (Phase 1 폴백 유지): %s", e)
        return 0

    finally:
        if driver:
            try:
                await driver.close()
            except Exception:
                pass


async def load_devices_with_retry(
    max_retries: int = 5,
    delay: float = 10.0,
) -> int:
    """
    Neo4j 연결 재시도 래퍼.

    컨테이너 기동 순서에 의해 Neo4j가 아직 준비되지 않았을 때
    고정 간격으로 재시도하여 장비 로딩을 보장한다.

    Args:
        max_retries: 최대 재시도 횟수 (기본 5회)
        delay: 재시도 간격 초 (기본 10초)

    Returns:
        등록된 장비 수. 모든 재시도 실패 시 0 반환 (Phase 1 폴백 유지).
    """
    for attempt in range(1, max_retries + 1):
        count = await load_devices_from_neo4j()
        if count > 0:
            logger.info(
                "Neo4j 디바이스 로딩 성공 (시도 %d/%d): %d개 장비 등록",
                attempt, max_retries, count,
            )
            return count

        if attempt < max_retries:
            logger.warning(
                "Neo4j 디바이스 로딩 실패 (시도 %d/%d) — %g초 후 재시도",
                attempt, max_retries, delay,
            )
            await asyncio.sleep(delay)

    logger.error(
        "Neo4j 디바이스 로딩 %d회 모두 실패 — Phase 1 폴백(AHU_5F 1대)으로 유지",
        max_retries,
    )
    return 0

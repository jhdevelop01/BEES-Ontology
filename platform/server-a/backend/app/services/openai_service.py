"""
OpenAI GPT Function Calling 서비스
LLM 채팅을 통한 건물 온톨로지 자연어 질의 처리.

기능:
- 자연어 → Cypher 변환 (GPT Function Calling)
- Neo4j 그래프 질의 실행
- 결과를 한국어 자연어로 응답
"""

import json
import logging
import re
from typing import Any

from app.config import OPENAI_API_KEY, OPENAI_MODEL
from app.services import neo4j_service

logger = logging.getLogger(__name__)

_client = None


def init() -> None:
    """OpenAI 클라이언트 초기화"""
    global _client
    if not OPENAI_API_KEY:
        logger.warning("OPENAI_API_KEY가 설정되지 않았습니다. LLM 채팅 비활성화.")
        return

    try:
        from openai import AsyncOpenAI
        _client = AsyncOpenAI(api_key=OPENAI_API_KEY)
        logger.info("OpenAI 클라이언트 초기화 완료 (모델: %s)", OPENAI_MODEL)
    except ImportError:
        logger.warning("openai 패키지가 설치되지 않았습니다. pip install openai")
    except Exception as e:
        logger.warning("OpenAI 클라이언트 초기화 실패: %s", e)


def is_available() -> bool:
    """OpenAI 서비스 사용 가능 여부"""
    return _client is not None


# ─── 시스템 프롬프트 ───────────────────────────────────────────

SYSTEM_PROMPT = """당신은 삼성물산 GEC(Green Energy Center) B동 건물의 디지털 트윈 AI 어시스턴트입니다.

## 건물 정보
- **건물**: 삼성물산 GEC B동 (Tower B), 지하4층~지상10층+옥상
- **온톨로지**: Brick Schema 1.3+ 기반, 845개 인스턴스, 5,756 트리플
- **데이터 저장소**: Neo4j 그래프 데이터베이스 (n10s 플러그인)

## Neo4j 그래프 구조
- 노드에는 `uri` 속성이 있으며, 형식: `https://example.org/gec-b#엔티티명`
- 노드 라벨은 Brick 클래스: Building, Floor, AHU, Chiller, Pump, Fan, Boiler, VAV, FCU, Sensor, Point 등
- 주요 관계: `hasPart`, `isPartOf`, `feeds`, `isFedBy`, `hasLocation`, `isLocationOf`, `hasPoint`, `isPointOf`

## Cypher 규칙
- URI 필터링: `n.uri CONTAINS '엔티티명'`
- 라벨 필터링: `MATCH (n:AHU)` 또는 `any(label IN labels(n) WHERE label = '타입')`
- 층 필터: URI에 층 정보 포함 (예: '5F', 'B1F', 'RF')
- 항상 LIMIT 사용 (최대 50)
- 읽기 전용 (SELECT/MATCH만 가능)

## 층 구조
- 지하: B4F(주차장), B3F(주차장), B2F(주차장/기계실), B1F(기계실/MDF)
- 지상: 1F(로비), 2F~10F(사무실)
- 옥상: RF(기계실)
- URI 형식: `B_B4F`, `B_B1F`, `B_1F`, `B_5F`, `B_RF` 등

## 주요 시스템 (Neo4j 시스템 노드)
- HVAC_System: Chiller_Plant, CC_System, RH_System, UFAD_System, FCU, AHU 등 포함
- Chiller_Plant: Chiller_1~4 + CHW_Pump + Cooling_Tower (냉수/냉방 루프)
- CC_System(Chilled_Ceiling): 층별 CC_Panel, Distribution_Header, Three_Way_Valve
- RH_System(Radiant_Heating): 층별 RH_Panel, Distribution_Header (난방/온수)
- Electrical_System: 변압기, UPS, 비상발전기, 배전반
- Lighting_System, Fire_Safety_System, Water_System, BAS 등
- 에너지 흐름: Chiller → CHW_Pump → AHU/CC_Panel (feeds 관계로 연결)
- **CHW/CW/HW는 별도 시스템 노드가 아님** — get_system_info에서 '냉수','CHW','냉방' 등으로 검색 가능

## 응답 형식 (반드시 준수)
마크다운 기호를 절대 사용하지 마세요. **, ##, -, *, `, ```, > 등 마크다운 서식 문자를 쓰지 마세요.
대신 아래 구조로 응답하세요:

[요약]
질문에 대한 핵심 답변을 2~3문장으로 요약합니다.

[상세]
조회된 데이터를 기반으로 상세하게 설명합니다.
항목을 나열할 때는 "1) 2) 3)" 또는 "가. 나. 다." 형식을 사용하세요.
표가 필요한 경우 각 행을 "항목명: 값" 형태로 나열하세요.

[종합]
전체 내용을 한 문장으로 정리합니다.

## 응답 규칙
1. 한국어로 응답
2. 기술 용어는 영문 병기 (예: 공조기(AHU))
3. 마크다운 기호(**, ##, -, *, `, ```, >) 절대 사용 금지 — 순수 텍스트만 사용
4. 모르면 솔직히 모른다고 답변
5. Cypher 쿼리 결과가 비어 있으면 해당 데이터가 없다고 안내
6. 짧은 인사나 간단한 질문에는 [요약]/[상세]/[종합] 구조 없이 자연스럽게 답변
"""


# ─── Function Calling 도구 정의 ─────────────────────────────

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "query_building_ontology",
            "description": "Neo4j 그래프 DB에 Cypher 쿼리를 실행하여 건물 온톨로지 데이터를 조회합니다. 읽기 전용 쿼리만 가능합니다.",
            "parameters": {
                "type": "object",
                "properties": {
                    "cypher": {
                        "type": "string",
                        "description": "실행할 Cypher 쿼리. MATCH/RETURN만 사용 가능. 예: MATCH (n:AHU) RETURN n.uri, labels(n) LIMIT 10",
                    }
                },
                "required": ["cypher"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_equipment_on_floor",
            "description": "특정 층의 장비 목록을 조회합니다.",
            "parameters": {
                "type": "object",
                "properties": {
                    "floor": {
                        "type": "string",
                        "description": "층 이름. 예: '5층', '지하1층', '옥상', '3F', 'B2F', 'RF'",
                    }
                },
                "required": ["floor"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_equipment_sensors",
            "description": "특정 장비에 연결된 센서/포인트 목록을 조회합니다.",
            "parameters": {
                "type": "object",
                "properties": {
                    "equipment_name": {
                        "type": "string",
                        "description": "장비 이름 또는 URI 일부. 예: 'AHU_5F', 'Chiller_1', 'Boiler_1'",
                    }
                },
                "required": ["equipment_name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_system_info",
            "description": "특정 시스템의 구성 정보와 하위 장비 목록을 조회합니다. 냉방/냉수/CHW, 난방/온수/HW, HVAC, 전력, 소방, 조명, 급수, BAS 등 키워드로 검색 가능합니다. 에너지 흐름을 알고 싶으면 get_energy_flow를 사용하세요.",
            "parameters": {
                "type": "object",
                "properties": {
                    "system_name": {
                        "type": "string",
                        "description": "시스템 이름 또는 키워드. 예: '냉방', 'CHW', '냉수', 'HVAC', '난방', 'HW', '전력', '소방', '조명', '환기', 'BAS'",
                    }
                },
                "required": ["system_name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "count_by_type",
            "description": "특정 Brick 클래스의 인스턴스 수를 집계합니다.",
            "parameters": {
                "type": "object",
                "properties": {
                    "brick_type": {
                        "type": "string",
                        "description": "Brick 클래스명. 예: 'AHU', 'Chiller', 'Sensor', 'Floor', 'Equipment', 'Point'",
                    }
                },
                "required": ["brick_type"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_energy_flow",
            "description": "에너지 흐름(feeds/isFedBy 관계)을 추적합니다. 특정 장비가 어디에 에너지를 공급하거나 공급받는지 조회합니다. 한국어(냉방, 냉수, 난방 등)와 영문(Chiller_1, CHW 등) 모두 사용 가능합니다.",
            "parameters": {
                "type": "object",
                "properties": {
                    "equipment_name": {
                        "type": "string",
                        "description": "장비 이름 또는 시스템 키워드. 예: 'Chiller_1', '냉방', '냉수', 'CHW', '난방', 'Boiler_1', 'AHU_UFAD_1'",
                    },
                    "direction": {
                        "type": "string",
                        "enum": ["feeds", "isFedBy", "both"],
                        "description": "흐름 방향. feeds=공급, isFedBy=공급받음, both=양방향",
                    },
                },
                "required": ["equipment_name"],
            },
        },
    },
]


# ─── 층 이름 정규화 ──────────────────────────────────────────

def _normalize_floor(floor: str) -> str:
    """
    한국어 층 이름을 URI 형식으로 변환.
    예: '지하1층' → 'B_B1F', '5층' → 'B_5F', '옥상' → 'B_RF'
    """
    floor = floor.strip()

    # 이미 URI 형식이면 그대로 반환
    if re.match(r"^B_", floor):
        return floor

    # 이미 코드 형식이면 B_ 접두사 추가
    if re.match(r"^(B?\d+F|RF)$", floor, re.IGNORECASE):
        code = floor.upper()
        if not code.startswith("B") or code.startswith("B") and code[1:2].isdigit():
            # B1F 등 지하가 아닌 일반 층
            pass
        return f"B_{code}"

    # 한국어 변환
    floor_lower = floor.replace(" ", "")

    # 옥상
    if "옥상" in floor_lower or floor_lower.upper() == "RF":
        return "B_RF"

    # 지하
    m = re.search(r"지하\s*(\d+)", floor_lower)
    if m:
        return f"B_B{m.group(1)}F"

    # 지상 (숫자 + 층)
    m = re.search(r"(\d+)\s*층", floor_lower)
    if m:
        return f"B_{m.group(1)}F"

    # 숫자만
    m = re.match(r"^(\d+)$", floor_lower)
    if m:
        return f"B_{m.group(1)}F"

    # 변환 실패 시 원본 반환
    return floor


# ─── 안전성 검증 ─────────────────────────────────────────────

_WRITE_KEYWORDS = re.compile(
    r"\b(CREATE|DELETE|SET|REMOVE|MERGE|DROP|DETACH)\b",
    re.IGNORECASE,
)


def _sanitize_cypher(cypher: str) -> str | None:
    """
    Cypher 쿼리 안전성 검증.
    쓰기 작업 차단, LIMIT 자동 추가.
    Returns: 정제된 쿼리, 또는 None (차단 시).
    """
    if _WRITE_KEYWORDS.search(cypher):
        return None

    # LIMIT가 없으면 자동 추가
    if not re.search(r"\bLIMIT\b", cypher, re.IGNORECASE):
        cypher = cypher.rstrip().rstrip(";") + " LIMIT 50"

    return cypher


# ─── 도구 실행 함수들 ────────────────────────────────────────

async def _tool_query_building_ontology(cypher: str) -> dict[str, Any]:
    """범용 Cypher 쿼리 실행"""
    safe_cypher = _sanitize_cypher(cypher)
    if safe_cypher is None:
        return {"error": "쓰기 작업(CREATE/DELETE/SET 등)은 허용되지 않습니다."}

    results = await neo4j_service.run_cypher(safe_cypher)
    return {"cypher": safe_cypher, "results": results, "count": len(results)}


async def _tool_get_equipment_on_floor(floor: str) -> dict[str, Any]:
    """특정 층의 장비 목록 조회 (hasLocation 관계 + URI 패턴 병행)"""
    floor_code = _normalize_floor(floor)
    # floor_code에서 층 코드만 추출 (예: "B_5F" → "5F")
    short_code = floor_code.replace("B_", "", 1) if floor_code.startswith("B_") else floor_code

    EQUIP_LABELS = [
        "Equipment", "AHU", "VAV", "FCU", "Fan", "Pump",
        "Chiller", "Boiler", "PAC", "MAU", "Damper", "Valve",
        "Cooling_Tower", "VFD", "Controller", "Lighting_Equipment",
        "Elevator", "Transformer", "UPS", "Switchgear",
        "Emergency_Generator", "Water_Pump", "Fan_Coil_Unit",
        "Distribution_Header", "Chilled_Ceiling_Panel", "Floor_Diffuser",
        "Building_Electrical_Meter", "Electrical_Equipment", "Solar_PV_System",
        "HVAC_Equipment", "Radiant_Heating_Panel",
    ]

    # 두 가지 방법으로 장비를 조회하여 합침
    floor_uri = f"https://example.org/gec-b#{floor_code}"

    # 방법1: hasLocation으로 해당 층 또는 하위 Zone에 위치한 장비
    cypher1 = """
        MATCH (f {uri: $floor_uri})
        OPTIONAL MATCH (f)-[:hasPart*1..2]->(zone)
        WITH collect(DISTINCT zone.uri) + [$floor_uri] AS locs
        UNWIND locs AS loc_uri
        MATCH (equip)-[:hasLocation]->(loc {uri: loc_uri})
        WHERE any(l IN labels(equip) WHERE l IN $labels)
        RETURN DISTINCT equip.uri AS uri, labels(equip) AS labels
        LIMIT 50
    """
    results1 = await neo4j_service.run_cypher(cypher1, {
        "floor_uri": floor_uri,
        "labels": EQUIP_LABELS,
    })

    # 방법2: URI에 층 코드가 포함된 장비 (예: CC_Panel_5F_Int)
    cypher2 = """
        MATCH (n)
        WHERE n.uri STARTS WITH 'https://example.org/gec-b#'
          AND (n.uri CONTAINS ('_' + $short_code + '_') OR n.uri ENDS WITH ('_' + $short_code))
          AND any(l IN labels(n) WHERE l IN $labels)
        RETURN DISTINCT n.uri AS uri, labels(n) AS labels
        LIMIT 50
    """
    results2 = await neo4j_service.run_cypher(cypher2, {
        "short_code": short_code,
        "labels": EQUIP_LABELS,
    })

    results = (results1 if not (results1 and "error" in results1[0]) else []) + \
              (results2 if not (results2 and "error" in results2[0]) else [])
    equipment = []
    seen = set()
    for r in results:
        if "error" in r:
            return {"error": r["error"]}
        uri = r.get("uri", "")
        if not uri or uri in seen:
            continue
        seen.add(uri)
        labels = [l for l in r.get("labels", []) if l != "Resource"]
        equipment.append({
            "name": neo4j_service._extract_name(uri),
            "uri": uri,
            "labels": labels,
        })
    return {"floor": floor, "floor_code": floor_code, "equipment": equipment, "count": len(equipment)}


async def _tool_get_equipment_sensors(equipment_name: str) -> dict[str, Any]:
    """장비의 센서/포인트 목록 조회"""
    cypher = """
        MATCH (equip)-[:hasPoint]->(point)
        WHERE equip.uri CONTAINS $name
        RETURN equip.uri AS equipment_uri,
               point.uri AS point_uri,
               labels(point) AS point_labels
        LIMIT 50
    """
    results = await neo4j_service.run_cypher(cypher, {"name": equipment_name})
    points = []
    for r in results:
        if "error" in r:
            return {"error": r["error"]}
        point_uri = r.get("point_uri", "")
        points.append({
            "name": neo4j_service._extract_name(point_uri),
            "uri": point_uri,
            "labels": r.get("point_labels", []),
        })
    return {"equipment": equipment_name, "points": points, "count": len(points)}


async def _tool_get_system_info(system_name: str) -> dict[str, Any]:
    """시스템 구성 정보 조회 (이름 매핑 + 다단계 검색)"""

    # 사용자 질의어 → 실제 Neo4j URI/라벨 매핑
    SYSTEM_ALIASES: dict[str, list[str]] = {
        "CHW": ["HVAC_System", "Chiller_Plant", "CC_System"],
        "냉수": ["HVAC_System", "Chiller_Plant", "CC_System"],
        "냉방": ["HVAC_System", "Chiller_Plant", "CC_System"],
        "냉동": ["Chiller_Plant", "HVAC_System"],
        "CW": ["Cooling_Tower", "HVAC_System"],
        "냉각수": ["Cooling_Tower", "HVAC_System"],
        "HW": ["RH_System", "Boiler_Plant", "HVAC_System"],
        "온수": ["RH_System", "Boiler_Plant"],
        "난방": ["RH_System", "Boiler_Plant"],
        "HVAC": ["HVAC_System"],
        "공조": ["HVAC_System", "UFAD_System"],
        "전력": ["Electrical_System"],
        "Power": ["Electrical_System"],
        "소방": ["Fire_Safety_System"],
        "Fire": ["Fire_Safety_System"],
        "조명": ["Lighting_System", "DALI_System"],
        "급수": ["Domestic_Water_System", "Water_System"],
        "배수": ["Drainage_System", "Wastewater_Treatment"],
        "환기": ["Parking_Ventilation_System", "Exhaust_Ventilation_System", "NP_System"],
        "BAS": ["BAS"],
        "자동화": ["BAS"],
    }

    # 별칭 매핑으로 검색 키워드 확장
    search_names = SYSTEM_ALIASES.get(system_name, [])
    if not search_names:
        # 정확한 별칭이 없으면 원본 이름으로 검색
        for alias, targets in SYSTEM_ALIASES.items():
            if alias.lower() in system_name.lower() or system_name.lower() in alias.lower():
                search_names = targets
                break

    if search_names:
        # 별칭 매핑된 시스템 URI로 직접 검색
        cypher = """
            MATCH (sys)
            WHERE any(name IN $names WHERE sys.uri ENDS WITH ('#' + name))
            OPTIONAL MATCH (sys)-[:hasPart]->(part)
            RETURN sys.uri AS system_uri, labels(sys) AS system_labels,
                   collect(DISTINCT {uri: part.uri, labels: labels(part)}) AS parts
        """
        results = await neo4j_service.run_cypher(cypher, {"names": search_names})
    else:
        # 폴백: 기존 방식 (System 라벨 + 이름 매칭) + Plant 노드도 포함
        cypher = """
            MATCH (sys)
            WHERE (any(label IN labels(sys) WHERE label CONTAINS 'System' OR label CONTAINS 'Plant')
              AND (sys.uri CONTAINS $name OR any(label IN labels(sys) WHERE label CONTAINS $name)))
            OPTIONAL MATCH (sys)-[:hasPart]->(part)
            RETURN sys.uri AS system_uri, labels(sys) AS system_labels,
                   collect(DISTINCT {uri: part.uri, labels: labels(part)}) AS parts
            LIMIT 20
        """
        results = await neo4j_service.run_cypher(cypher, {"name": system_name})

    systems = []
    for r in results:
        if "error" in r:
            return {"error": r["error"]}
        sys_uri = r.get("system_uri", "")
        if not sys_uri:
            continue
        parts = r.get("parts", [])
        parts = [p for p in parts if p.get("uri")]
        sys_labels = [l for l in r.get("system_labels", []) if l != "Resource"]
        systems.append({
            "name": neo4j_service._extract_name(sys_uri),
            "uri": sys_uri,
            "labels": sys_labels,
            "parts_count": len(parts),
            "parts": [
                {
                    "name": neo4j_service._extract_name(p["uri"]),
                    "labels": [l for l in p.get("labels", []) if l != "Resource"],
                }
                for p in parts[:20]  # 최대 20개 파트만 반환
            ],
        })
    return {"system": system_name, "systems": systems, "count": len(systems)}


async def _tool_count_by_type(brick_type: str) -> dict[str, Any]:
    """Brick 클래스 인스턴스 수 집계"""
    cypher = """
        MATCH (n)
        WHERE any(label IN labels(n) WHERE label CONTAINS $type)
        RETURN count(n) AS count
    """
    results = await neo4j_service.run_cypher(cypher, {"type": brick_type})
    if results and "error" not in results[0]:
        count = results[0].get("count", 0)
    else:
        count = 0
    return {"type": brick_type, "count": count}


async def _tool_get_energy_flow(equipment_name: str, direction: str = "both") -> dict[str, Any]:
    """에너지 흐름 추적 (한국어/별칭 → 영문 장비명 매핑 포함)"""

    # 한국어/시스템명 → 실제 장비 URI 키워드 매핑
    EQUIP_ALIASES: dict[str, list[str]] = {
        "냉방": ["Chiller_1", "Chiller_2", "CHW_Pump"],
        "냉수": ["Chiller_1", "CHW_Pump_1"],
        "냉동기": ["Chiller_1", "Chiller_2"],
        "칠러": ["Chiller_1", "Chiller_2"],
        "CHW": ["Chiller_1", "CHW_Pump_1"],
        "냉각탑": ["Cooling_Tower_1", "Cooling_Tower_2"],
        "난방": ["Boiler_1", "HW_Pump_1"],
        "보일러": ["Boiler_1", "Boiler_2"],
        "온수": ["Boiler_1", "HW_Pump_1"],
        "HW": ["Boiler_1", "HW_Pump_1"],
        "냉방 시스템": ["Chiller_1", "Chiller_2", "CHW_Pump_1", "CHW_Pump_Group"],
        "난방 시스템": ["Boiler_1", "Boiler_2", "HW_Pump_1"],
        "HVAC": ["Chiller_1", "Boiler_1", "AHU_UFAD_1"],
        "공조": ["AHU_UFAD_1", "DOAS_1"],
    }

    # 별칭 매핑
    search_names = [equipment_name]
    for alias, names in EQUIP_ALIASES.items():
        if alias in equipment_name or equipment_name in alias:
            search_names = names
            break

    results_data: dict[str, Any] = {"equipment": equipment_name, "direction": direction}
    all_feeds_to: list[dict] = []
    all_fed_by: list[dict] = []
    seen_feeds: set[str] = set()
    seen_fedby: set[str] = set()

    for name in search_names:
        if direction in ("feeds", "both"):
            cypher = """
                MATCH (equip)-[:feeds]->(target)
                WHERE equip.uri CONTAINS $name
                RETURN equip.uri AS source, target.uri AS target_uri, labels(target) AS target_labels
                LIMIT 50
            """
            results = await neo4j_service.run_cypher(cypher, {"name": name})
            for r in results:
                if "error" not in r:
                    target_uri = r.get("target_uri", "")
                    key = f"{r.get('source', '')}>{target_uri}"
                    if key not in seen_feeds:
                        seen_feeds.add(key)
                        all_feeds_to.append({
                            "source": neo4j_service._extract_name(r.get("source", "")),
                            "name": neo4j_service._extract_name(target_uri),
                            "labels": [l for l in r.get("target_labels", []) if l != "Resource"],
                        })

        if direction in ("isFedBy", "both"):
            cypher = """
                MATCH (equip)-[:isFedBy]->(source)
                WHERE equip.uri CONTAINS $name
                RETURN equip.uri AS target, source.uri AS source_uri, labels(source) AS source_labels
                LIMIT 50
            """
            results = await neo4j_service.run_cypher(cypher, {"name": name})
            for r in results:
                if "error" not in r:
                    source_uri = r.get("source_uri", "")
                    key = f"{source_uri}>{r.get('target', '')}"
                    if key not in seen_fedby:
                        seen_fedby.add(key)
                        all_fed_by.append({
                            "target": neo4j_service._extract_name(r.get("target", "")),
                            "name": neo4j_service._extract_name(source_uri),
                            "labels": [l for l in r.get("source_labels", []) if l != "Resource"],
                        })

    results_data["feeds_to"] = all_feeds_to[:50]
    results_data["fed_by"] = all_fed_by[:50]
    results_data["count"] = len(all_feeds_to) + len(all_fed_by)

    return results_data


# ─── 마크다운 기호 제거 (후처리 안전장치) ────────────────────

def _strip_markdown(text: str) -> str:
    """GPT 응답에서 마크다운 서식 문자를 제거"""
    # 코드 블록 ```...``` 제거 (내용은 유지)
    text = re.sub(r"```[\w]*\n?", "", text)
    # 볼드/이탤릭: **text** → text, *text* → text, __text__ → text
    text = re.sub(r"\*{1,3}([^*]+)\*{1,3}", r"\1", text)
    text = re.sub(r"_{1,3}([^_]+)_{1,3}", r"\1", text)
    # 인라인 코드: `text` → text
    text = re.sub(r"`([^`]+)`", r"\1", text)
    # 헤딩: ### text → text
    text = re.sub(r"^#{1,6}\s*", "", text, flags=re.MULTILINE)
    # 리스트 마커: "- item" → "item", "* item" → "item"
    text = re.sub(r"^[\s]*[-*]\s+", "", text, flags=re.MULTILINE)
    # 인용: > text → text
    text = re.sub(r"^>\s*", "", text, flags=re.MULTILINE)
    return text.strip()


# ─── 도구 디스패처 ───────────────────────────────────────────

async def _execute_tool(name: str, arguments: dict[str, Any]) -> dict[str, Any]:
    """Function Calling 도구 실행 디스패처"""
    try:
        if name == "query_building_ontology":
            return await _tool_query_building_ontology(arguments["cypher"])
        elif name == "get_equipment_on_floor":
            return await _tool_get_equipment_on_floor(arguments["floor"])
        elif name == "get_equipment_sensors":
            return await _tool_get_equipment_sensors(arguments["equipment_name"])
        elif name == "get_system_info":
            return await _tool_get_system_info(arguments["system_name"])
        elif name == "count_by_type":
            return await _tool_count_by_type(arguments["brick_type"])
        elif name == "get_energy_flow":
            return await _tool_get_energy_flow(
                arguments["equipment_name"],
                arguments.get("direction", "both"),
            )
        else:
            return {"error": f"알 수 없는 도구: {name}"}
    except Exception as e:
        logger.warning("도구 실행 실패 (%s): %s", name, e)
        return {"error": f"도구 실행 오류: {str(e)}"}


# ─── 메인 채팅 함수 ──────────────────────────────────────────

async def chat(
    message: str,
    history: list[dict[str, str]] | None = None,
) -> dict[str, Any]:
    """
    LLM 채팅 메인 함수.
    자연어 질문 → GPT Function Calling → Neo4j 조회 → 자연어 응답.

    Returns:
        {
            "response": str,
            "cypher_queries": list[str],
            "sources": list[dict],
            "tool_calls": list[dict],
        }
    """
    if not _client:
        return {
            "response": "OpenAI API 키가 설정되지 않아 LLM 채팅을 사용할 수 없습니다. "
                        "환경변수 OPENAI_API_KEY를 설정해 주세요.",
            "cypher_queries": [],
            "sources": [],
            "tool_calls": [],
        }

    # 메시지 구성
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]

    if history:
        for h in history[-10:]:  # 최근 10개만 유지
            messages.append({
                "role": h.get("role", "user"),
                "content": h.get("content", ""),
            })

    messages.append({"role": "user", "content": message})

    cypher_queries: list[str] = []
    sources: list[dict] = []
    tool_calls_log: list[dict] = []

    # Function Calling 루프 (최대 3회 반복)
    max_iterations = 3
    for iteration in range(max_iterations):
        try:
            response = await _client.chat.completions.create(
                model=OPENAI_MODEL,
                messages=messages,
                tools=TOOLS,
                tool_choice="auto",
            )
        except Exception as e:
            logger.error("OpenAI API 호출 실패: %s", e)
            return {
                "response": f"LLM 응답 생성 중 오류가 발생했습니다: {str(e)}",
                "cypher_queries": cypher_queries,
                "sources": sources,
                "tool_calls": tool_calls_log,
            }

        choice = response.choices[0]
        assistant_message = choice.message

        # Function Call이 없으면 최종 응답
        if not assistant_message.tool_calls:
            return {
                "response": _strip_markdown(assistant_message.content or ""),
                "cypher_queries": cypher_queries,
                "sources": sources,
                "tool_calls": tool_calls_log,
            }

        # Function Call 처리
        messages.append(assistant_message)

        for tool_call in assistant_message.tool_calls:
            func_name = tool_call.function.name
            try:
                func_args = json.loads(tool_call.function.arguments)
            except json.JSONDecodeError:
                func_args = {}

            logger.info(
                "Function Call [%d/%d]: %s(%s)",
                iteration + 1, max_iterations, func_name, json.dumps(func_args, ensure_ascii=False)[:200],
            )

            # 도구 실행
            result = await _execute_tool(func_name, func_args)

            # Cypher 쿼리 수집
            if "cypher" in result:
                cypher_queries.append(result["cypher"])

            # 소스 정보 수집
            sources.append({
                "tool": func_name,
                "arguments": func_args,
                "result_count": result.get("count", len(result.get("results", []))),
            })

            tool_calls_log.append({
                "name": func_name,
                "arguments": func_args,
                "result": result,
            })

            # 결과를 메시지에 추가
            messages.append({
                "role": "tool",
                "tool_call_id": tool_call.id,
                "content": json.dumps(result, ensure_ascii=False, default=str),
            })

    # 최대 반복 초과 시 마지막 응답 시도
    try:
        response = await _client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=messages,
        )
        final_content = _strip_markdown(response.choices[0].message.content or "")
    except Exception as e:
        logger.error("최종 응답 생성 실패: %s", e)
        final_content = "응답 생성 중 오류가 발생했습니다."

    return {
        "response": final_content,
        "cypher_queries": cypher_queries,
        "sources": sources,
        "tool_calls": tool_calls_log,
    }

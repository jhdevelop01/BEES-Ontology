# Neo4j GraphDB 구축 정보

> **구축일:** 2026-02-11
> **온톨로지 버전:** v2.0.1 (5,756 트리플, 845 인스턴스)

---

## 1. 접속 정보

| 항목 | 값 |
|------|-----|
| 컨테이너명 | `neo4j-bees` |
| Docker 이미지 | `neo4j:5.26.0-community` |
| n10s 플러그인 | neosemantics (n10s.jar) |
| Browser (HTTP) | http://localhost:7476 |
| Bolt (Driver) | bolt://localhost:7689 |
| 사용자 | `neo4j` |
| 비밀번호 | `bees2024` |

### Python 접속 예시

```python
from neo4j import GraphDatabase

driver = GraphDatabase.driver("bolt://localhost:7689", auth=("neo4j", "bees2024"))

with driver.session() as session:
    result = session.run("MATCH (n) RETURN count(n) AS cnt")
    print(result.single()["cnt"])

driver.close()
```

---

## 2. Docker 관리 명령

```bash
# 컨테이너 시작/중지/재시작
docker start neo4j-bees
docker stop neo4j-bees
docker restart neo4j-bees

# 상태 확인
docker ps | grep neo4j-bees

# 로그 확인
docker logs neo4j-bees --tail 20

# Cypher 실행
docker exec neo4j-bees cypher-shell -u neo4j -p bees2024 "MATCH (n) RETURN count(n);"
```

---

## 3. n10s 설정 (graphconfig)

| 파라미터 | 값 | 설명 |
|---------|-----|------|
| handleVocabUris | `MAP` | URI를 접두어 기반 짧은 이름으로 변환 |
| handleMultival | `ARRAY` | 다중값을 배열로 보존 |
| handleRDFTypes | `LABELS` | rdf:type → Neo4j 노드 라벨 |
| keepLangTag | `false` | 언어 태그(@ko) 제거 |
| keepCustomDataTypes | `true` | 커스텀 데이터타입 보존 |
| applyNeo4jNaming | `false` | Brick 원본 관계명 유지 (feeds, isPartOf 등) |

### 등록된 네임스페이스 (11개)

| Prefix | URI |
|--------|-----|
| `brick` | `https://brickschema.org/schema/Brick#` |
| `bldg` | `https://example.org/gec-b#` |
| `bees` | `https://example.org/bees#` |
| `rdf` | `http://www.w3.org/1999/02/22-rdf-syntax-ns#` |
| `rdfs` | `http://www.w3.org/2000/01/rdf-schema#` |
| `owl` | `http://www.w3.org/2002/07/owl#` |
| `xsd` | `http://www.w3.org/2001/XMLSchema#` |
| `unit` | `http://qudt.org/vocab/unit/` |
| `sch` | `http://schema.org/` |
| `ref` | `https://brickschema.org/schema/Brick/ref#` |
| `tag` | `https://brickschema.org/schema/BrickTag#` |

---

## 4. 임포트 결과

| 항목 | 값 |
|------|-----|
| terminationStatus | OK |
| triplesLoaded | 5,756 (최초 임포트 기준) |
| triplesParsed | 5,756 (최초 임포트 기준) |
| 전체 노드 | 1,732 |
| 한글 라벨 노드 | 1,711 |

> 노드/관계 수치는 2026-07-09 라이브 `neo4j-bees` cypher-shell 직접 실측. `triplesLoaded/triplesParsed`(5,756)는 최초 n10s 임포트 시점 값으로, 이후 증분 임포트가 반영된 현재 노드/관계 수와는 별개다.

### 관계별 수 (TTL과 완전 일치)

| 관계 | 수량 |
|------|:----:|
| feeds | 272 |
| isFedBy | 272 |
| hasPart | 844 |
| isPartOf | 844 |
| hasLocation | 644 |
| isPointOf | 996 |
| hasPoint | 304 |
| subClassOf | 40 |

### 주요 노드 라벨 (상위 20)

| 라벨 | 수량 |
|------|:----:|
| Resource | 1,731 |
| On_Off_Status | 246 |
| Room | 169 |
| Electrical_Power_Sensor | 89 |
| DatatypeProperty | 73 |
| HVAC_Zone | 60 |
| Valve_Command | 51 |
| Floor_Diffuser | 48 |
| Class | 40 |
| Equipment | 27 |
| Fan_Speed_Command | 25 |
| Zone_Air_Temperature_Sensor | 25 |
| CO2_Sensor | 25 |
| Zone_Air_Humidity_Sensor | 25 |
| Energy_Sensor | 24 |
| Water_Flow_Sensor | 24 |
| Valve | 22 |
| Duct_Static_Pressure_Sensor | 21 |
| On_Off_Command | 21 |
| Distribution_Header | 20 |

---

## 5. TTL → Neo4j 매핑 규칙

```
[RDF/TTL]                          [Neo4j Property Graph]
─────────────────────────          ─────────────────────────
rdf:type brick:AHU              → (:AHU) 노드 라벨
rdfs:label "B동 5층 AHU #1"     → node.label 프로퍼티
brick:feeds                     → -[:feeds]-> 관계
brick:isPartOf                  → -[:isPartOf]-> 관계
brick:hasLocation               → -[:hasLocation]-> 관계
bees:hasConfidence "confirmed"  → node.hasConfidence 프로퍼티
bees:capacity "800"             → node.capacity 프로퍼티
```

---

## 6. 재임포트 절차

온톨로지 TTL 변경 후 Neo4j 동기화가 필요할 때:

```bash
# 1. TTL 파일 복사
cp ontology/GEC_B_Ontology.ttl ~/neo4j-bees/import/

# 2. 기존 데이터 삭제 + 재임포트 (Cypher)
docker exec neo4j-bees cypher-shell -u neo4j -p bees2024 "
MATCH (n) DETACH DELETE n;
"
docker exec neo4j-bees cypher-shell -u neo4j -p bees2024 "
CALL n10s.graphconfig.init({
  handleVocabUris: 'MAP', handleMultival: 'ARRAY',
  handleRDFTypes: 'LABELS', keepLangTag: false,
  keepCustomDataTypes: true, applyNeo4jNaming: false
});
"
docker exec neo4j-bees cypher-shell -u neo4j -p bees2024 "
CALL n10s.rdf.import.fetch('file:///var/lib/neo4j/import/GEC_B_Ontology.ttl', 'Turtle');
"

# 3. 검증
python3 scripts/verify_neo4j.py
```

---

## 7. 샘플 Cypher 쿼리

```cypher
-- 칠러 → 냉각탑 → 펌프 에너지 흐름 추적
MATCH path = (c:Chiller)-[:feeds*1..3]->(target)
RETURN [n IN nodes(path) | n.label] AS flow LIMIT 10;

-- 5층 설비 목록
MATCH (f:Floor)-[:hasPart|hasLocation*1..2]-(equip)
WHERE f.label CONTAINS '5층'
RETURN equip.label, labels(equip) LIMIT 20;

-- AHU가 공급하는 Zone
MATCH (a:AHU)-[:feeds]->(z:HVAC_Zone)
RETURN a.label AS ahu, collect(z.label) AS zones;

-- 특정 시스템의 구성 장비
MATCH (s)-[:hasPart]->(e)
WHERE s.label CONTAINS 'UFAD'
RETURN s.label AS system, e.label AS equipment;
```

---

## 8. 볼륨 경로

| Docker 경로 | 호스트 경로 |
|-------------|-----------|
| `/data` | `~/neo4j-bees/data` |
| `/logs` | `~/neo4j-bees/logs` |
| `/var/lib/neo4j/import` | `~/neo4j-bees/import` |
| `/plugins` | `~/neo4j-bees/plugins` |

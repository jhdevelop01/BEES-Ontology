# BEES Ontology — 삼성물산 GEC B동 Brick Schema 온톨로지

## 프로젝트 개요
삼성물산 GEC(Green Energy Center) **B동(Tower B)**에 대한 **Brick Schema 기반 건물 온톨로지** 구축 프로젝트.
스마트빌딩 데이터 통합 플랫폼 "BEES"를 위한 시맨틱 모델링.

## 범위 (필수 준수)
- **삼성물산 GEC B동에만 한정** — Tower A, Tower C, Podium, 전사 ESG 데이터는 범위 밖
- `bldg:Samsung_GEC` (Site)는 최소 컨텍스트(상위 노드)로만 유지
- 새 인스턴스는 반드시 `bldg:GEC_Tower_B` 또는 그 하위에 연결

## 핵심 파일
| 파일 | 위치 | 설명 |
|------|------|------|
| GEC_B_Ontology.ttl | `ontology/` | 메인 온톨로지 (v2.0.1, ~6,830줄, 5,756 트리플, 845 인스턴스) |
| GEC_B_SHACL.ttl | `ontology/` | SHACL 검증 Shape (v2.0, 19개) |
| docker-compose.yml | 루트 | 디지털 트윈 플랫폼 8서비스 Docker 오케스트레이션 |
| .env | 루트 | 환경변수 (Neo4j, MQTT, InfluxDB, PostgreSQL, 서버 간 URL) |
| history.md | `_docs/` | **★ 전체 프로젝트 히스토리 (Phase 1~9 상세, 플랫폼 작업 이어가려면 필수 참조)** |
| 08_개발_원칙.md | `_docs/` | **TTL-First 원칙, 변경 워크플로우, Neo4j 동기화 규칙** (모든 세션 필수 참조) |
| 10_디지털트윈_플랫폼_설계.md | `_docs/` | 플랫폼 전체 아키텍처 설계서 |

## 온톨로지 규칙
- **Brick Schema 1.3+** 준수: Location → System → Equipment → Point 위계
- **네임스페이스**: `brick:` (스키마), `bldg:` (인스턴스), `bees:` (커스텀 28클래스+45속성)
- **신뢰도 태깅 필수**: `bees:hasConfidence` — "confirmed" / "estimated" / "inferred"
- **추정 범위**: `bees:estimatedRange` — 정밀 수량 미확정 시 사용
- **TTL 수정 후 반드시 rdflib 파싱 검증** (구문 오류 방지)
- **SHACL Shape 동기화**: 새 클래스 추가 시 해당 Shape도 검토

## Neo4j GraphDB
- **컨테이너**: `neo4j-bees` (Docker, neo4j:5.26.0-community + n10s)
- **Browser**: http://localhost:7476
- **Bolt**: bolt://localhost:7689
- **인증**: neo4j / bees2024
- **검증**: `python3 scripts/verify_neo4j.py`
- **graphconfig**: MAP 모드, LABELS, applyNeo4jNaming=false (Brick 원본 관계명 유지)

## 검증 명령
```bash
# TTL 구문 검증
python3 -c "from rdflib import Graph; g=Graph(); g.parse('ontology/GEC_B_Ontology.ttl', format='turtle'); print(f'트리플: {len(g)}')"

# SHACL 유효성 검증
pyshacl -s ontology/GEC_B_SHACL.ttl -d ontology/GEC_B_Ontology.ttl

# 범위 검증 (Site 참조 ~12개 허용 - 최소 컨텍스트 + 에너지 실측)
grep -c "Samsung_GEC" ontology/GEC_B_Ontology.ttl
# v2.0.1: ~6,830줄, 5,756 트리플, 845 인스턴스, 전층 모델 (지하~옥상)
```

## 디지털 트윈 IoT 시뮬레이션 플랫폼 (Phase 9)

### 개요
Brick Schema 온톨로지(845 인스턴스)를 기반으로 4개 독립 서버 구성의 디지털 트윈 플랫폼. Phase 1 MVP 완료.

### 아키텍처
```
[Frontend :3000] → [Server A Backend :8010] → [Neo4j :7689] (온톨로지)
                                             → [MQTT :1885] (실시간)
                                             → [Server B :8011] (제어)
                                                    ↓
                                              [Server C :8012] (에뮬레이터)
                                                    ↓ MQTT
                                              [Server D :8013] (시계열 저장)
```

### 서버 구성
| 서버 | 역할 | 기술스택 | 호스트 포트 |
|------|------|----------|:----------:|
| Server A Backend | REST API, SSE, Neo4j 연동 | FastAPI | 8010 |
| Server A Frontend | 대시보드, 모니터링, 제어 UI | Next.js 14, Tailwind, shadcn/ui | 3000 |
| Server B | BAS Adapter (프로토콜 게이트웨이) | FastAPI | 8011 |
| Server C | 가상 건물 에뮬레이터 (센서 데이터 생성) | FastAPI, AsyncIO | 8012 |
| Server D | Data Historian (시계열 수집/조회) | FastAPI, InfluxDB | 8013 |

### 인프라 (Docker Compose)
| 서비스 | 호스트 포트 | 인증 |
|--------|:----------:|------|
| Mosquitto MQTT | 1885 | 없음 |
| InfluxDB | 8088 | bees-dev-token |
| PostgreSQL | 5434 | bees / bees2024 |
| Neo4j (외부 컨테이너) | 7476/7689 | neo4j / bees2024 |

### Phase 1 MVP 현재 상태
- ✅ AHU_5F 1대 + 5개 센서 실시간 시뮬레이션 (5초 간격)
- ✅ SSE 실시간 스트림 (polling 방식, `_event_counter` + `threading.Lock`)
- ✅ 대시보드 KPI + 모니터링 차트 + 장비 제어 (ON/OFF)
- ✅ E2E 제어: Frontend → A → B → C → MQTT → A(SSE) → Frontend
- ✅ Data Historian: MQTT → InfluxDB 배치 저장 + 시계열 조회 API

### Phase 2 미구현 (다음 작업)
1. **845개 전체 인스턴스 시뮬레이션** — Neo4j에서 자동 로딩 → 프로파일 자동 생성
2. **온톨로지 그래프 뷰** — Cytoscape.js (`/ontology` 페이지)
3. **토폴로지 뷰** — 트리뷰 + 층별 레이아웃 (`/topology` 페이지)
4. **LLM 채팅** — OpenAI GPT Function Calling → Neo4j Cypher (`/chat` 페이지)

### 기동 방법
```bash
docker compose up -d                                    # 전체 기동
curl -s http://localhost:8010/api/stream/snapshot        # 데이터 확인
open http://localhost:3000                               # 프론트엔드
```

### 주요 기술 결정 사항
- **MQTT 타임스탬프**: Server C는 ISO 8601 발행, Server A `_parse_ts()`가 Unix로 변환
- **SSE**: `asyncio.Event` 크로스스레드 불가 → polling 방식 사용 (Python 3.12+)
- **Neo4j**: docker-compose에서 제거, 기존 `neo4j-bees` 외부 컨테이너 사용 (`host.docker.internal`)
- **NEXT_PUBLIC_* 환경변수**: 빌드 시 bake됨, 런타임 변경 불가

### 상세 참조
- **전체 구현 상세/디버깅 이력/다음 작업 가이드**: `_docs/history.md` (섹션 12)
- **전체 아키텍처 설계서**: `_docs/10_디지털트윈_플랫폼_설계.md`

## 작업 시작 전
1. **`_docs/08_개발_원칙.md`를 반드시 읽을 것** — TTL-First 원칙, 변경 워크플로우, Neo4j 동기화 규칙
2. **플랫폼 작업 시 `_docs/history.md` 섹션 12를 반드시 읽을 것** — 서버별 API/구현 상세, 디버깅 이력, 미구현 목록
3. 온톨로지 맥락이 필요하면 `_docs/history.md` 섹션 1~11을 읽을 것

## 언어
사용자와의 대화 및 문서 작성은 **한국어**. 온톨로지(TTL) 내 식별자와 기술 용어는 영어.

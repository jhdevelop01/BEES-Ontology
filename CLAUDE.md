# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# BEES Ontology — 삼성물산 GEC B동 Brick Schema 온톨로지

## 프로젝트 개요
삼성물산 GEC(Green Energy Center) **B동(Tower B)**에 대한 **Brick Schema 기반 건물 온톨로지** 구축 프로젝트.
스마트빌딩 데이터 통합 플랫폼 "BEES"를 위한 시맨틱 모델링 + 디지털 트윈 IoT 시뮬레이션 플랫폼.

## 범위 (필수 준수)
- **삼성물산 GEC B동에만 한정** — Tower A, Tower C, Podium, 전사 ESG 데이터는 범위 밖
- `bldg:Samsung_GEC` (Site)는 최소 컨텍스트(상위 노드)로만 유지
- 새 인스턴스는 반드시 `bldg:GEC_Tower_B` 또는 그 하위에 연결

## 언어
사용자와의 대화 및 문서 작성은 **한국어**. 온톨로지(TTL) 내 식별자와 기술 용어는 영어.

## 핵심 파일
| 파일 | 위치 | 설명 |
|------|------|------|
| GEC_B_Ontology.ttl | `ontology/` | 메인 온톨로지 (Brick 1.3+, v2.2.2) — 통계는 검증 명령으로 확인 |
| GEC_B_SHACL.ttl | `ontology/` | SHACL 검증 Shape (v2.0, 24개) |
| docker-compose.yml | 루트 | 디지털 트윈 플랫폼 9서비스 Docker 오케스트레이션 |
| .env | 루트 | 환경변수 — Neo4j, MQTT, InfluxDB, PostgreSQL, OpenAI, 서버 간 URL |
| history.md | `_docs/` | **★ 전체 프로젝트 히스토리 — 플랫폼 작업 시 필수 참조** |
| 08_개발_원칙.md | `_docs/` | TTL-First 원칙, 변경 워크플로우, Neo4j 동기화 규칙 |
| 10_디지털트윈_플랫폼_설계.md | `_docs/` | 플랫폼 전체 아키텍처 설계서 |

## 작업 시작 전
1. **`_docs/08_개발_원칙.md`를 반드시 읽을 것** — TTL-First 원칙, 변경 워크플로우
2. **플랫폼 작업 시 `_docs/history.md`를 반드시 읽을 것** — 서버별 API/구현 상세, 디버깅 이력
3. 온톨로지 맥락이 필요하면 `_docs/history.md` 초반 섹션 참조
4. **`.env`의 `OPENAI_API_KEY`에 실제 키 설정 필요** (AI 채팅용)

## 온톨로지 규칙
- **Brick Schema 1.3+** 준수: Location → System → Equipment → Point 위계
- **네임스페이스**: `brick:` (스키마), `bldg:` (인스턴스), `bees:` (커스텀 40클래스+73속성)
- **신뢰도 태깅 필수**: `bees:hasConfidence` — "confirmed" / "estimated" / "inferred"
- **추정 범위**: `bees:estimatedRange` — 정밀 수량 미확정 시 사용
- **TTL 수정 후 반드시 rdflib 파싱 검증** (구문 오류 방지)
- **SHACL Shape 동기화**: 새 클래스 추가 시 해당 Shape도 검토
- **feeds 관계 규칙 (Brick Schema)**:
  - `feeds` = 물질(물/공기/전기)의 물리적 흐름만 표현. 구성 관계는 `isPartOf/hasPart`, 제어 관계는 `controls`
  - 개별 장비→그룹: `isPartOf` 사용 (Pump_1 isPartOf Pump_Group). `feeds` 아님
  - skip connection 금지: Chiller→CC_Panel 직접 연결 금지 (Chiller→Pump→Header→Panel 경로 필수)
  - feeds/isFedBy 양방향 대칭 필수

## 온톨로지 변경 시 플랫폼 연쇄 업데이트 (필수)
온톨로지(TTL)에서 `feeds`, `isPartOf`, `hasPart` 등 관계를 변경할 때 아래 체크리스트를 **반드시** 수행:
1. **rdflib 파싱 검증** — 구문 오류 확인
2. **Neo4j 동기화** — `docker cp` + `n10s.rdf.import.fetch`
3. **Server A 재시작** — `docker compose restart server-a-backend` (Neo4j `_graph_cache` 5분 TTL 초기화)
4. **LLM SYSTEM_PROMPT 동기화** — `openai_service.py`의 에너지 흐름 설명이 하드코딩 → 수동 업데이트
5. **토폴로지 프론트엔드** — `equip-topology-data.ts`의 `EXCLUDE_RE` / `PRIMARY_EQUIP_RE` 확인
6. **Docker 프론트엔드 재빌드** — `docker compose up -d --build server-a-frontend`
7. **DAG 검증** — L999 고립 장비 0건 확인

## 검증 명령
```bash
# TTL 구문 검증 + 트리플 수 확인
python3 -c "from rdflib import Graph; g=Graph(); g.parse('ontology/GEC_B_Ontology.ttl', format='turtle'); print(f'트리플: {len(g)}')"

# SHACL 유효성 검증
pyshacl -s ontology/GEC_B_SHACL.ttl -d ontology/GEC_B_Ontology.ttl

# 범위 검증 (Samsung_GEC 참조 수 확인 — 최소 컨텍스트만 허용)
grep -c "Samsung_GEC" ontology/GEC_B_Ontology.ttl
```

## Neo4j GraphDB
- **컨테이너**: `neo4j-bees` (외부, neo4j:5.26.0-community + n10s) — Bolt :7689 | Browser :7476 | 인증: neo4j / bees2024
- **graphconfig**: MAP 모드, LABELS, applyNeo4jNaming=false (Brick 원본 관계명 유지)
- **검증**: `python3 scripts/verify_neo4j.py`

## 디지털 트윈 플랫폼
4개 독립 서버 + 5개 인프라 서비스 구성. 상세: `_docs/10_디지털트윈_플랫폼_설계.md`

| 서버 | 역할 | 포트 |
|------|------|:----:|
| Server A Backend | REST API, SSE, Neo4j 연동 (FastAPI) | 8010 |
| Server A Frontend | 20개 페이지 UI (19 라우트 + 404) (Next.js 14, Tailwind, shadcn/ui, ReactFlow, Cytoscape.js) | 3000 |
| Server B | BAS Adapter — 프로토콜 게이트웨이 (FastAPI) | 8011 |
| Server C | 가상 건물 에뮬레이터 — 284장비, 691포인트 시뮬레이션 (FastAPI) | 8012 |
| Server D | Data Historian — 시계열 수집/조회 (FastAPI, InfluxDB) | 8013 |

**인프라**: Mosquitto(:1885), InfluxDB(:8088), PostgreSQL(:5434), Grafana(:3001), Neo4j(외부 :7476/:7689)

### 기동 방법
```bash
docker start neo4j-bees                                 # Neo4j 시작
docker compose up -d                                    # 전체 기동 (9서비스)
curl -s http://localhost:8010/health                     # Server A 헬스 확인 (경로: /health, NOT /api/health)
curl -s http://localhost:8010/api/platform/health        # 플랫폼 통합 상태 (Server A~D + 인프라 집계)
curl -s http://localhost:8010/api/stream/snapshot        # 데이터 확인 (691포인트)
open http://localhost:3000                               # 프론트엔드
```

### 데이터 흐름 아키텍처 (서버 간 연동 — 핵심)
플랫폼은 단방향 시뮬레이션 파이프라인 + 그래프 조회의 2개 경로로 동작한다:

1. **시뮬레이션 경로 (1초 주기)**: Server C(에뮬레이터, `engine.py`+`thermodynamics.py`)가 284장비/691포인트 값을 생성 →
   MQTT(`bees/points/*`, `bees/devices/*/state`, `bees/alarms/*`)로 발행 →
   **Server A**(`mqtt_service.py`)가 메모리 캐시(`_point_cache`/`_device_cache`/`_alarm_cache`)에 수집하고 SSE(0.5초 배치)로 프론트엔드에 푸시,
   동시에 **Server D**(`mqtt_worker.py`)가 InfluxDB에 시계열로 영속화(배치 write, `batch_flush_size=500`).
2. **그래프 조회 경로**: 프론트엔드 → Server A REST → `neo4j_service.py`(`_graph_cache` 5분 TTL) → Neo4j(`neo4j-bees`).
   토폴로지·Fault Impact·온톨로지 그래프·장비 상세가 이 경로를 사용.
3. **AI 채팅**: 프론트엔드 → `routers/chat.py` → `openai_service.py`(SYSTEM_PROMPT에 에너지 흐름 **하드코딩**, Neo4j 교차 조회) → OpenAI.
4. **제어/BAS**: Server B(`bacnet_adapter.py`)는 BACnet 프로토콜 게이트웨이(`command_queue.py`로 명령 큐잉). 현재 시뮬레이션은 Server C가 담당.

**Server A 백엔드 구조**: `routers/`(19개 엔드포인트 그룹) + `services/`(11개 통합 서비스)로 분리.
온톨로지 변경의 파급 지점은 거의 항상 `neo4j_service.py`(그래프), `openai_service.py`(LLM 프롬프트), 프론트엔드 토폴로지 3곳 — 위 "연쇄 업데이트" 체크리스트 참조.

## 개발 명령
```bash
# 프론트엔드 (server-a/frontend) — 로컬 개발
cd platform/server-a/frontend && npm install
npm run dev            # 개발 서버 (next dev)
npm run lint           # ESLint (next lint)
npm run build          # 프로덕션 빌드 — 타입 오류 사전 검증용으로 활용

# 백엔드 단일 서버 로컬 실행 (예: Server A) — uvicorn 직접 기동
cd platform/server-a/backend && pip install -r requirements.txt
uvicorn app.main:app --reload --port 8010

# Docker — 단일 서비스 재빌드/재시작/로그 (전체 재기동 불필요)
docker compose up -d --build server-a-frontend
docker compose restart server-a-backend     # Neo4j _graph_cache 초기화 시 필수
docker compose logs -f server-c              # 특정 서버 로그 추적

# 온톨로지 품질 종합 점검 (orphan/asymmetry/confidence)
python3 scripts/ontology_quality_check.py

# 07 통계 문서 자동 갱신 (TTL 실측값 → _docs/07 의 AUTOGEN 마커 블록·파생행 갱신)
python3 scripts/gen_stats_doc.py            # 문서 갱신
python3 scripts/gen_stats_doc.py --check    # drift 검출만(CI용, stale 있으면 exit 1)
```
> **온톨로지 변경 후엔 `gen_stats_doc.py`를 실행**해 `_docs/07_온톨로지_통계_요약.md`의 canonical 수치(트리플/클래스/속성/인스턴스/관계 카운트)를 재생성한다. 이 값들은 수동 수정 대상이 아니다(§1·§7 AUTOGEN 마커 블록 + §11 파생행).
> 자동화 테스트 스위트는 아직 없음 — 검증은 위 `검증 명령`(TTL/SHACL/Neo4j) + `npm run build`(프론트 타입) + API 수동 curl로 수행.

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
| GEC_B_SHACL.ttl | `ontology/` | SHACL 검증 Shape (v2.0, 24개) |
| docker-compose.yml | 루트 | 디지털 트윈 플랫폼 9서비스 Docker 오케스트레이션 |
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
Brick Schema 온톨로지(845 인스턴스)를 기반으로 4개 독립 서버 구성의 디지털 트윈 플랫폼. Phase 3 완료.

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
| Grafana | 3001 | admin / bees2024 |
| Neo4j (외부 컨테이너) | 7476/7689 | neo4j / bees2024 |

### Phase 3 현재 상태 (2026.02.13) — ✅ 전체 완료
**Phase 2 (유지)**:
- ✅ **84개 장비 + 164개 포인트** 실시간 시뮬레이션 (Neo4j 자동 로딩, 5초 간격)
- ✅ **온톨로지 그래프 뷰** — Cytoscape.js, 노드 클릭 하이라이트, 더블클릭 이웃 확장, 검색+포커스 (`/ontology`)
- ✅ **토폴로지 뷰** — 18층 건물 트리 + SSE 실시간 장비 상태 + 반응형 디자인 (`/topology`)
- ✅ **LLM 채팅** — OpenAI GPT-4o Function Calling × 6도구 → Neo4j Cypher (`/chat`)
- ✅ **InfluxDB 직접 연동** — 3단계 폴백: InfluxDB 직접 → Server D 프록시 → MQTT 캐시

**Phase 3 (신규)**:
- ✅ **시뮬레이션 자동 시작** — Server C 기동 시 자동 시작 (수동 POST 불필요)
- ✅ **알람 시스템** — Server C 임계값 체크 → MQTT 발행 → Server A 캐시 → Server D PostgreSQL 저장
- ✅ **Grafana 대시보드** — InfluxDB 자동 연동, 4패널 오버뷰 (포트 3001)
- ✅ **시계열 이력 페이지** — recharts 멀티라인 차트, 기간/집계 선택, CSV 다운로드 (`/history`)
- ✅ **반응형 디자인** — 모바일/태블릿/데스크탑 3단계 전 페이지 적용
- ✅ **BACnet/IP 어댑터** — Brick→BACnet 매핑, 시뮬레이션 모드, 5개 REST API
- ✅ **데이터 보존 정책** — InfluxDB 3단계 다운샘플링 (7d→30d→365d)
- ✅ **스케줄 관리 API** — PostgreSQL 기반 CRUD 5개 엔드포인트
- ✅ **JWT 인증** — 로그인/등록/역할 기반 접근 제어, 프론트엔드 로그인 페이지
- ✅ **알람 UI** — SSE 알람 배너 + 대시보드 알람 카드
- ✅ **온톨로지 품질 스크립트** — 5가지 자동 구조 검증 (`scripts/ontology_quality_check.py`)
- ⚠️ **OpenAI API 키**: `.env`의 `OPENAI_API_KEY`에 실제 키 설정 필요

### 프론트엔드 8개 페이지
| 경로 | 기능 |
|------|------|
| `/` | 대시보드 — KPI, 장비 상태, 알람 카드, 최근 데이터 |
| `/monitoring` | 모니터링 — 실시간 차트 |
| `/control` | 제어 — ON/OFF, 모드 변경 (JWT 인증 필요) |
| `/ontology` | 온톨로지 그래프 — 클릭 하이라이트, 더블클릭 확장, 검색+포커스 |
| `/topology` | 토폴로지 — 건물 계층 트리 + SSE 실시간 장비 상태 |
| `/chat` | AI 채팅 — LLM 자연어 질의 |
| `/history` | 시계열 이력 — recharts 멀티라인, 기간/집계, CSV 다운로드 |
| `/login` | 로그인 — JWT 인증 |

### 기동 방법
```bash
docker start neo4j-bees                                 # Neo4j 시작
docker compose up -d                                    # 전체 기동 (9서비스 + 시뮬레이션 자동 시작)
curl -s http://localhost:8010/api/stream/snapshot        # 데이터 확인 (164포인트 기대)
open http://localhost:3000                               # 프론트엔드
```

### 주요 기술 결정 사항
- **MQTT 타임스탬프**: Server C는 ISO 8601 발행, Server A `_parse_ts()`가 Unix로 변환
- **SSE**: `asyncio.Event` 크로스스레드 불가 → polling 방식 사용 (Python 3.12+)
- **Neo4j**: docker-compose에서 제거, 외부 `neo4j-bees` 컨테이너 사용 (`host.docker.internal:7689`)
- **NEXT_PUBLIC_* 환경변수**: 빌드 시 bake됨, 런타임 변경 불가
- **Cytoscape.js**: dynamic import (SSR 회피), `as any` 타입 캐스팅으로 strict 타입 우회
- **n10s 노드 필터**: `n.uri STARTS WITH 'https://example.org/gec-b#'`로 스키마 노드 제외

### 상세 참조
- **전체 구현 상세/디버깅 이력/다음 작업 가이드**: `_docs/history.md` (섹션 10~14)
- **전체 아키텍처 설계서**: `_docs/10_디지털트윈_플랫폼_설계.md`

## 작업 시작 전
1. **`_docs/08_개발_원칙.md`를 반드시 읽을 것** — TTL-First 원칙, 변경 워크플로우, Neo4j 동기화 규칙
2. **플랫폼 작업 시 `_docs/history.md` 섹션 10~14을 반드시 읽을 것** — 서버별 API/구현 상세, Phase 3 완료 내역, 다음 작업 가이드
3. 온톨로지 맥락이 필요하면 `_docs/history.md` 섹션 1~11을 읽을 것

## 언어
사용자와의 대화 및 문서 작성은 **한국어**. 온톨로지(TTL) 내 식별자와 기술 용어는 영어.

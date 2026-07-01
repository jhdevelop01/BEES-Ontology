# Server A 최적화 방향

> 분석 대상: `platform/server-a` (Backend FastAPI 8010 + Frontend Next.js 14, 3000)
> 분석 방식: 실제 코드 Read/Grep 직접 확인. 미확인/없는 항목은 그대로 명시.
> 작성일 기준 코드 상태 (2026-06-30).

## 1. 현황 요약 (구조·규모)

### Backend (`backend/app`)
- **routers/ 19개 그룹**: auth, alarm, audit, dashboard, control, stream, ontology, history, chat, schedule, equipment, energy, floors, maintenance, reports, users, settings, notification, platform.
- **services/ 11개**: neo4j_service(56KB, 최대), openai_service(79KB, 최대), mqtt_service, influxdb_service, postgres_service, energy_service, notification_service, report_service, audit_service, auth_service, equipment_classification.
- **외부 연동**: Neo4j(AsyncGraphDatabase), MQTT(paho, 백그라운드 스레드), InfluxDB, PostgreSQL(asyncpg pool), OpenAI(AsyncOpenAI), Server B/C/D(httpx 프록시).
- **실시간 경로**: MQTT 콜백(별도 스레드) → 메모리 캐시(`_point_cache`/`_device_cache`/`_alarm_cache`) + `_event_queue`(deque maxlen=500) → SSE(0.5초 폴링 배치) / WebSocket(push).
- **캐시**: `neo4j_service._graph_cache`(5분 TTL, `get_graph_data`에만 적용).

### Frontend (`frontend`)
- **app/ 19개 페이지** + components(topology, dashboard, floors, monitoring, charts, ui).
- **무거운 의존성**: cytoscape + cytoscape-cose-bilkent, reactflow, recharts, react-grid-layout, @dagrejs/dagre 동시 사용.
- **데이터 계층**: `lib/api.ts`(1478줄 단일 파일, 모든 REST 래퍼), `lib/sse.ts`, `lib/ws.ts`(`useRealtimeData`가 WS+SSE 통합).
- **코드 스플리팅**: `next/dynamic`은 `app/page.tsx`의 DashboardGrid 1곳만 사용.
- **최대 파일**: `app/ontology/page.tsx`(1358줄), `app/alarms/page.tsx`(837), `app/control/page.tsx`(793).

---

## 2. 발견된 이슈 (우선순위별)

### P0 — 보안/정합성 (즉시 조치 권장)

- **[P0-1] 대부분의 REST 엔드포인트에 인증 부재**
  `backend/app/dependencies.py`에 `get_current_user`/`require_role`이 정의되어 있으나, 실제 적용은 auth/control/maintenance/notification/settings/users 6개 라우터뿐. **alarm, audit, dashboard, energy, equipment, floors, history, ontology, platform, reports, schedule, stream, chat 13개 라우터는 인증 없음**. 특히:
  - `routers/audit.py` — 감사 로그가 무인증 노출.
  - `routers/chat.py:52` `POST /api/chat` — 무인증. OpenAI 비용이 발생하는 엔드포인트가 외부에 그대로 열림(비용 폭주/남용 위험).

- **[P0-2] 무인증 임의 Cypher 실행 엔드포인트**
  `routers/ontology.py:55` `POST /api/ontology/cypher` → `neo4j_service.sanitize_cypher` → `run_cypher_graph`. 인증이 없고, 누구나 그래프 전체를 임의 read Cypher로 조회 가능(데이터 전량 exfiltration). `_sanitize_cypher`(openai_service.py:688)는 `CREATE|DELETE|SET|REMOVE|MERGE|DROP|DETACH`만 정규식 차단 → **`CALL apoc.*`, `CALL dbms.*`, `LOAD CSV` 등 절차/메타 호출은 미차단**. 무인증과 결합 시 위험.

- **[P0-3] JWT 시크릿 하드코딩 기본값**
  `config.py:44` `JWT_SECRET = "bees-dev-secret-key-change-in-production"`. 환경변수 미주입 시 이 기본값으로 토큰 서명 → 토큰 위조 가능. `.env` 강제 + 부재 시 기동 실패하도록 검증 필요.

### P1 — 성능/효율

- **[P1-1] 실시간 데이터 이중 연결 (WS + SSE 동시 오픈)**
  `lib/sse.ts:198-208` `useRealtimeData`가 `useWebSocket()`과 `useSSE()`를 **항상 둘 다 호출**(React 훅 규칙상 조건부 불가). WS가 성공해도 SSE EventSource 연결이 동시에 열려 서버에서 0.5초 폴링 제너레이터가 계속 돈다. 실시간 페이지마다 연결/서버 루프가 2배.

- **[P1-2] SSE 이벤트 큐 크기 < 한 주기 이벤트 수 → 데이터 손실**
  `mqtt_service.py:30` `_event_queue = deque(maxlen=500)`인데 시뮬레이션 1주기(5초)에 **670개 포인트** 발행. `event_generator`(297행)는 `new_count = current_counter - last_counter`로 큐 끝에서 잘라내는데, 큐 maxlen(500)이 burst(670)보다 작아 **매 주기 약 170개 포인트 이벤트가 배치에서 누락**. (최신값은 `_point_cache`에 있으나 SSE로는 다음 변경 전까지 미전달 → UI stale.)

- **[P1-3] Neo4j 조회 대부분 캐시 미적용**
  `_graph_cache`(5분 TTL)는 `get_graph_data`에만 적용. `get_topology_tree`, `get_topology_connections`, `get_equipment_list`, `search_instances`, `get_node_detail`, `get_floor_*` 등은 **요청마다 Neo4j 세션 신규 생성·쿼리**. 온톨로지는 거의 불변이므로 토폴로지/장비목록 류는 캐시 가치가 큼.

- **[P1-4] 에너지 프로파일의 순차 InfluxDB 쿼리 (N+1)**
  `energy_service.py:209` `for pid in power_points[:20]: await influxdb_service.query_point_history(...)` — 최대 20개 포인트를 **직렬 await**. `asyncio.gather`로 병렬화 시 지연 대폭 단축.

- **[P1-5] OpenAI 호출에 타임아웃·토큰 상한 없음**
  `openai_service.py:1619` `_client.chat.completions.create(...)`에 `timeout`/`max_tokens` 미지정. 툴 호출용 httpx에는 timeout(10~15초)이 있으나 **LLM 호출 자체는 무한 대기 가능**. 또한 Function Calling 루프 최대 5회 × 매회 전체 `TOOLS` + 거대한 하드코딩 `SYSTEM_PROMPT` 전송 → 토큰/지연/비용 큼. 프롬프트 캐싱 미사용.

### P2 — 코드 품질/유지보수

- **[P2-1] 채팅 응답 페이로드 비대**
  `chat()`이 `tool_calls_log`에 각 도구의 **전체 result(dict)** 를 담아 응답에 그대로 반환(openai_service.py:1694). Cypher 결과가 큰 경우 응답 크기 폭증. UI에 필요한 요약만 반환 권장.

- **[P2-2] 시작 시 비결정적 시드 데이터**
  `main.py:_seed_equipment_metadata`가 유지보수 일정을 `random`으로 생성하여 PostgreSQL에 시드(매 환경 상이). 데모용으로는 무방하나 운영/재현성 측면에서 별도 시드 스크립트 분리가 바람직.

- **[P2-3] `run_cypher_graph`의 라벨/엣지 보강 추가 쿼리**
  neo4j_service.py:687/702 — 노드 라벨 보강·엣지 조회를 위해 본 쿼리 외 최대 2회 추가 세션 쿼리. 노드≤500 가드는 있으나, 같은 세션 내에서 본 쿼리 한 번에 라벨까지 RETURN하도록 유도(프롬프트/쿼리 규약)하면 왕복 절감.

- **[P2-4] 프론트엔드 코드 스플리팅 미흡**
  cytoscape/reactflow/recharts가 topology·ontology 페이지에서 정적 import. Next.js 라우트 단위 분할은 되지만, 무거운 그래프 캔버스 컴포넌트는 `next/dynamic`(ssr:false)로 지연 로드 시 초기 진입 비용 절감. 현재 dynamic 사용은 대시보드 1곳뿐.

- **[P2-5] `lib/api.ts` 단일 1478줄**
  모든 도메인 API 래퍼가 한 파일. 도메인별 분할 시 트리셰이킹·가독성 개선(번들에는 큰 영향 없으나 유지보수성↑).

- **[P2-6] CORS 와일드카드 + credentials**
  `main.py:167` `allow_credentials=True`에 `allow_methods=["*"]`, `allow_headers=["*"]`. origin은 화이트리스트라 큰 문제는 아니나 메서드/헤더는 필요한 것만 명시 권장.

---

## 3. 최적화 방향 (이슈별 개선안 + 예상 효과)

| ID | 개선안 | 예상 효과 |
|----|--------|-----------|
| P0-1 | 공통 라우터 의존성으로 `Depends(get_current_user)` 일괄 적용(읽기 전용은 viewer 이상, 쓰기/제어는 `require_role`). `/api/chat`은 인증+레이트리밋 필수 | 무단 접근·OpenAI 비용 남용 차단 |
| P0-2 | `/api/ontology/cypher`에 인증 부여 + `_sanitize_cypher`에 `CALL`/`apoc`/`LOAD CSV`/`dbms` 차단 추가, 또는 화이트리스트 방식 전환 | 그래프 데이터 무단 조회·절차 호출 차단 |
| P0-3 | 기동 시 `JWT_SECRET` 기본값이면 경고/실패. `.env` 강제 주입 | 토큰 위조 위험 제거 |
| P1-1 | `useRealtimeData`를 WS 단일 채널로 정리(WS 우선, 실패 시에만 SSE를 lazy 생성). 두 훅 동시 상시 연결 제거 | 클라이언트당 실시간 연결 절반, 서버 SSE 폴링 루프 감소 |
| P1-2 | `_event_queue` maxlen을 한 주기 이벤트 수(≥1000) 이상으로 상향, 또는 카운터 기반 슬라이싱 대신 클라이언트별 오프셋/스냅샷 diff 방식 | 주기적 포인트 누락 해소, UI 최신성 보장 |
| P1-3 | 토폴로지/장비목록/검색 결과에 `_graph_cache`와 동일한 TTL 캐시 적용(온톨로지 변경 시 무효화 훅 연동) | 반복 조회 Neo4j 부하·지연 대폭 감소 |
| P1-4 | `energy_service.get_energy_profile`의 포인트별 InfluxDB 조회를 `asyncio.gather`로 병렬화 | 프로파일 API 응답시간 수배 단축 |
| P1-5 | `chat.completions.create`에 `timeout`(예 30초)·`max_tokens` 지정, OpenAI prompt caching/시스템 프롬프트 외부화 | 무한 대기 방지, 토큰·비용·지연 절감 |
| P2-1 | 채팅 응답에서 `tool_calls.result` 전체 대신 요약(count/key 일부)만 반환 | 응답 페이로드·직렬화 비용 감소 |
| P2-4 | topology/ontology의 cytoscape·reactflow 캔버스 컴포넌트를 `dynamic(ssr:false)`로 지연 로드 | 초기 진입 JS 번들·TTI 개선 |

---

## 4. 리스크 / 주의사항

- **인증 일괄 적용(P0-1)은 프론트엔드 회귀 위험**: `lib/api.ts`의 `fetchJSON`은 401 시 자동 로그아웃·`/login` 리다이렉트하므로, 토큰 미보유 상태의 공개 페이지(예: 헬스/대시보드 초기 로드)가 깨질 수 있음. 적용 전 각 페이지의 토큰 요구 여부 매핑 필요.
- **`_event_queue` 크기 상향(P1-2)은 메모리 증가**: deque 항목은 작지만 다중 SSE/WS 연결 시 누적 고려. 근본 해법은 카운터-슬라이스 방식 자체를 스냅샷 diff로 바꾸는 것이나 변경 범위가 큼.
- **Neo4j 캐시 확대(P1-3)는 정합성 주의**: CLAUDE.md의 "온톨로지 변경 → Server A 재시작으로 `_graph_cache` 초기화" 규칙과 충돌하지 않도록, 신규 캐시도 동일하게 재시작/무효화 경로에 포함해야 함.
- **WS 단일화(P1-1)는 폴백 경로 검증 필수**: WebSocket이 프록시(nginx 등) 환경에서 끊길 수 있으므로 SSE 폴백이 실제로 동작하는지 확인 후 적용.
- **본 분석은 정적 코드 리뷰만 수행**(실행/프로파일링 없음). 실제 병목은 부하 테스트로 재확인 권장. 자동화 테스트 스위트가 없어(README 명시) 변경 시 회귀 검증은 `npm run build` + 수동 curl에 의존.
- 코드는 수정하지 않았으며 분석/문서화만 수행함.

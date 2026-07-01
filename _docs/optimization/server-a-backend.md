# Server A Backend 최적화 분석

> 대상: `platform/server-a/backend` (FastAPI, 포트 8010)
> 분석 범위: `app/main.py`, `app/config.py`, `app/dependencies.py`, `app/routers/*`(19), `app/services/*`(11)
> 작성 기준: 실제 소스 코드 정독 (file:line 근거). 읽기 분석 전용 — 소스 미수정.

## 1. 현행 구조 요약

- **앱 부트스트랩** (`main.py`): `lifespan`에서 Neo4j / MQTT / InfluxDB / PostgreSQL 연결 + OpenAI 초기화 후, Neo4j→PostgreSQL `equipment_metadata` 시드(`_seed_equipment_metadata`). 19개 라우터 등록, CORS 고정 오리진 3개.
- **데이터 경로 3종**:
  1. *실시간*: MQTT(`mqtt_service`) → 메모리 캐시(`_point_cache`/`_device_cache`/`_alarm_cache`) → SSE 0.5초 폴링 배치(`event_generator`) / WebSocket 브로드캐스트.
  2. *그래프 조회*: REST → `neo4j_service`(AsyncDriver) → Neo4j. `get_graph_data`만 5분 TTL 캐시(`_graph_cache`).
  3. *AI 채팅*: `chat.py` → `openai_service`(SYSTEM_PROMPT 하드코딩 ~280줄 + 15개 Function Tool) → OpenAI + Neo4j/InfluxDB(Server D)/PostgreSQL 교차 조회.
- **프록시 경로**: 제어→Server B, 시뮬레이션 제어/이력→Server C·D (모두 `httpx.AsyncClient` per-request 생성).
- **인증**: `dependencies.py`의 `get_current_user`(JWT Bearer) + `require_role`. 제어·사용자·설정·알림 라우터만 보호. 조회·스트림·채팅·온톨로지·대시보드는 대부분 **무인증**.
- **영속화 서비스**: `postgres_service`(asyncpg 풀 min1/max5), `influxdb_service`(async client, 대부분은 Server D 경유라 이중 경로), `audit_service`/`notification_service`(PostgreSQL 기록).

## 2. 발견된 병목/이슈

### [P0-A] `/api/ontology/cypher` 무인증 + 정규식 기반 Cypher 필터 (보안)
- **근거**: `routers/ontology.py:55-67` — `run_cypher_query`에 인증 의존성 없음. `neo4j_service.py:582-595` `sanitize_cypher`는 `_WRITE_KEYWORDS` 정규식(`CREATE|DELETE|SET|REMOVE|MERGE|DROP|DETACH`)과 일부 위험 프로시저(`apoc.export`, `dbms.security`)만 차단하고 그 외 `CALL`은 허용.
- **영향**: 인증 없이 임의의 읽기 Cypher 실행 가능 → 전체 그래프 덤프(데이터 유출). 정규식 블록리스트는 우회 가능(`LOAD CSV`, 차단 목록에 없는 APOC 읽기 프로시저, 문자열 리터럴 내 키워드 등). LLM 도구 `query_building_ontology`(`openai_service.py:712-719`)도 동일한 약한 필터를 공유.

### [P0-B] 하드코딩 기본 시크릿 + 시크릿 소스 이원화 (보안)
- **근거**: `config.py:44` `JWT_SECRET = "bees-dev-secret-key-change-in-production"`, `:15` `NEO4J_PASSWORD="bees2024"`, `:32` `INFLUXDB_TOKEN="bees-dev-token"` 등 평문 기본값. 게다가 `auth_service.py:17`은 `os.getenv("JWT_SECRET", ...)`로 **config를 거치지 않고** 직접 읽음.
- **영향**: 환경변수 누락 시 공개된 dev 시크릿으로 JWT 서명 → 토큰 위조/권한 상승. 두 군데서 시크릿을 읽어 기본값이 어긋나면 토큰 검증 실패(드리프트).

### [P0-C] `/api/chat` 무인증 → 비용 DoS + 약한 Cypher 노출 (보안/비용)
- **근거**: `routers/chat.py:52` `chat_with_llm`에 인증 없음. `openai_service.chat`은 호출당 최대 5회 OpenAI 왕복(`openai_service.py:1616-1624`).
- **영향**: 외부 누구나 GPT-4o 호출을 유발 → OpenAI 과금 폭증, 동시에 LLM을 통한 임의 읽기 Cypher 노출.

### [P1-D] per-request `httpx.AsyncClient` 생성 — 커넥션 풀 없음 (성능)
- **근거**: 18개 지점에서 `async with httpx.AsyncClient(...)` (control.py, history.py, alarm.py, equipment.py, platform.py, notification_service.py, `openai_service.py`의 거의 모든 `_tool_*`). 예: `openai_service.py:1073, 1153, 1249, 1289, 1409, 1430, 1460`.
- **영향**: 호출마다 TCP/TLS 핸드셰이크·소켓 생성. 한 번의 채팅에서 도구가 병렬·반복 호출되며 Server D로 수십 회 신규 연결 → 지연·소켓 낭비. 공유 모듈 레벨 클라이언트 대비 RTT/CPU 손해.

### [P1-E] `event_generator` SSE 스케일·데이터 유실 위험 (성능/정합성)
- **근거**: `mqtt_service.py:297-336`. 전역 `_event_counter`와 공유 `_event_queue`(deque maxlen=500). 각 클라이언트가 로컬 `last_counter`로 차이를 계산해 **공유 deque 꼬리**에서 `queue_list[-min(new_count, len):]`로 추출.
- **영향**: 670포인트가 5초 주기 버스트로 들어오면 짧은 시간에 수백 이벤트 → maxlen=500 초과 시 앞부분 소실. 클라이언트가 0.5초 사이 누적분을 따라잡지 못하면 이벤트 누락. 모든 연결 클라이언트가 동일 deque를 공유해 클라이언트 수 증가 시 슬라이스 계산이 부정확해질 수 있음. heartbeat/배치는 견고하나 다중 클라이언트·고부하에서 취약.

### [P1-F] `/api/devices/status` 매 요청 전체 장비 풀스캔 + 루프 내 import (성능)
- **근거**: `routers/control.py:136` → `neo4j_service.get_equipment_list()` 호출(캐시 없음). `get_equipment_list`는 전체 Equipment 라벨 노드를 Cypher 스캔하고 **루프 내부**에서 매 반복 `from ...equipment_classification import classify_equipment`(`neo4j_service.py:350`).
- **영향**: 폴링성 엔드포인트가 매번 200+ 노드 Neo4j 조회 + 분류 연산. `get_graph_data`와 달리 캐시 미적용. 프론트가 주기적으로 호출하면 Neo4j 부하 가중.

### [P1-G] 동기 블로킹 호출이 async 이벤트 루프 점유 (동시성)
- **근거**:
  - 보고서: `report_service.py`의 `_to_xlsx`(openpyxl)/`_to_pdf`(FPDF)를 async `generate_report` 경로에서 직접 호출(`report_service.py:98-104`). CPU 바운드·동기.
  - 이메일: `notification_service.py:105-139` `_send_email`이 동기 `smtplib`를 `dispatch`(async)에서 직접 호출.
  - 설정 파일: `notification_service.py:60`, `routers/settings.py:56/67`, `routers/notification.py:44/54`의 동기 `open()`.
- **영향**: XLSX/PDF 생성·SMTP 송신·파일 IO 동안 이벤트 루프 블로킹 → 동시 요청 전체 지연. 코드베이스에 `run_in_executor`/`to_thread` 사용 0건(grep 확인).

### [P1-H] 비캐시 Neo4j 조회 다수 + 멀티 라운드트립 (성능)
- **근거**: `get_graph_data`만 캐시(`neo4j_service.py:754-755`). `get_topology_tree`/`get_topology_connections`/`get_zone_feeds`/`get_node_detail`/`get_fault_impact`/`search_instances`는 매 요청 Neo4j 직격. `get_graph_data`는 노드 정렬용 `size([(n)-[]-() | 1]) AS degree` 전수 계산(`:811`) + 이웃·엣지 별도 쿼리. `run_cypher_graph`는 라벨 보강 쿼리 + 엣지 쿼리로 3+ 라운드트립(`:687-710`).
- **영향**: 토폴로지/그래프 페이지 진입 시 무거운 그래프 연산 반복. 온톨로지는 거의 불변이라 캐시 이득 큼.

### [P2-I] 시작 시 `equipment_metadata` 행단위 INSERT 루프 (성능)
- **근거**: `main.py:68-91` — `for rec in records: await conn.execute(INSERT ... ON CONFLICT DO NOTHING)` 행마다 1회. `random`으로 정비일 생성(`:78-80`) → 비결정적 시드.
- **영향**: 매 부팅마다 200+ 왕복. `executemany`/`COPY` 또는 단일 멀티밸류 INSERT로 대체 가능. 랜덤 시드는 재현성 저해.

### [P2-J] 무한 증가 인메모리 캐시 — 메모리 누수 (리소스)
- **근거**: `report_service.py:50` `_report_cache: dict`(이력 + **binary_content** XLSX/PDF 바이트 보관, `report_service.py` 저장부), `neo4j_service.py:754` `_graph_cache`(TTL 검사만 있고 만료 항목 제거·크기 상한 없음).
- **영향**: 보고서 캐시는 바이너리 blob 누적으로 장기 구동 시 메모리 증가. `_graph_cache`는 키 조합(node_type×floor×limit)만큼 무한 성장 가능.

### [P2-K] 중복·드리프트 코드 (코드품질)
- **근거**:
  - `sanitize_cypher`가 `neo4j_service.py:582`(LIMIT 200)와 `openai_service.py:694`(`_sanitize_cypher`, LIMIT 50, 위험 프로시저 미검사)로 **2개** 존재, `_WRITE_KEYWORDS` 정규식도 양쪽 중복.
  - 장비 라벨 리스트가 `neo4j_service`(`get_topology_tree`, `get_equipment_count`, `get_equipment_list`, `get_floor_equipment`)·`openai_service`(`_tool_get_equipment_on_floor`)·`main.py` 시드에서 5회 이상 하드코딩 반복.
  - `config.py:67-97` 모든 설정을 모듈 변수로 재노출(하이브리드) — 유지보수 부담.
  - `run_cypher_graph:666-675`의 `rel_type` 추론 루프는 계산만 하고 엣지에 사용 안 함(데드코드) — 엣지는 별도 쿼리로만 생성.
- **영향**: 규칙 변경 시 일부만 수정되어 동작 불일치(특히 두 Cypher 필터의 LIMIT/위험검사 차이).

### [P2-L] SYSTEM_PROMPT 하드코딩 + 통계 드리프트 (코드품질)
- **근거**: `openai_service.py:53-331` ~280줄 프롬프트. `:57` "845개 인스턴스, 5,756 트리플", `:59` "691개 센서 포인트", "1초 주기" 표기. MEMORY.md 실측은 11,502 트리플 / 670 포인트 / 5초 주기.
- **영향**: 온톨로지·시뮬레이션 변경 시 수동 동기화 누락 → LLM이 잘못된 수치/주기로 답변. CLAUDE.md "연쇄 업데이트" 체크리스트의 상시 리스크.

## 3. 최적화 권고

### P0 (보안 — 즉시)
1. **Cypher 엔드포인트/도구 인증·강화**: `/api/ontology/cypher`, `/api/chat`에 `Depends(get_current_user)`(최소 viewer) 부여. 정규식 블록리스트 대신 (a) Neo4j **읽기 전용 DB 사용자/롤**로 드라이버 연결 또는 (b) 세션을 `default_access_mode=READ`로 강제하고 허용 프로시저 화이트리스트화. 정규식은 보조 방어로만.
2. **시크릿 정리**: 기본 시크릿 제거하고 부팅 시 `JWT_SECRET` 등 미설정이면 **기동 실패(fail-fast)**. `auth_service.py`는 `os.getenv`가 아니라 `app.config`(또는 pydantic Settings)에서 단일 소스로 읽도록 통일.
3. **채팅 비용 가드**: 인증 + 사용자/IP별 rate limit, OpenAI 호출 타임아웃·최대 토큰·일일 호출 상한.

### P1 (성능/동시성 — 단기)
4. **공유 httpx 클라이언트**: `lifespan`에서 `httpx.AsyncClient`(keep-alive, limits) 1개 생성 후 `app.state`/모듈 싱글톤으로 재사용. 최소한 Server D 호출이 잦은 `openai_service` 도구들부터 적용.
5. **블로킹 호출 오프로드**: `_to_xlsx`/`_to_pdf`, `_send_email`, 설정 파일 IO를 `await asyncio.to_thread(...)`로 이동.
6. **`/devices/status` 캐시**: `get_equipment_list` 결과를 TTL 캐시(온톨로지 불변 가정, `_graph_cache`와 동일 패턴) 또는 시작 시 1회 로드. `classify_equipment` import는 모듈 최상단으로 이동.
7. **SSE 재설계**: 클라이언트별 `asyncio.Queue` 등록 방식으로 전환(브로드캐스터가 각 큐에 push)하여 공유 deque 슬라이스 의존 제거 → 다중 클라이언트 정합성·유실 방지. 최소 보완: maxlen 상향 + 클라이언트 lag 감지 시 스냅샷 재동기 신호.
8. **Neo4j 조회 캐시 확대**: 토폴로지/zone-connections/fault-impact 등 준불변 결과에 `get_graph_data`식 TTL 캐시 적용. `get_graph_data`의 degree 정렬은 limit 도달이 드물면 생략 가능.

### P2 (품질/리소스 — 중기)
9. **시드 배치화**: `equipment_metadata` 시드를 단일 멀티밸류 INSERT 또는 `executemany`로. 랜덤 정비일은 결정적 규칙 또는 일회성 마이그레이션으로 분리.
10. **캐시 상한/만료**: `_report_cache`·`_graph_cache`에 LRU/크기 상한·만료 GC 도입. 보고서 바이너리는 디스크/객체스토리지로 이전 검토.
11. **중복 제거**: Cypher 필터를 단일 모듈로 통합(LIMIT/위험검사 일원화), 장비 라벨 리스트·관계 타입을 공유 상수 모듈로. `run_cypher_graph` 데드 `rel_type` 루프 제거.
12. **SYSTEM_PROMPT 외부화**: 통계 수치를 기동 시 Neo4j/스냅샷에서 주입하거나 별도 설정 파일/템플릿으로 분리해 드리프트 차단.

## 4. Impact × Effort 랭킹

| 항목 | Impact | Effort | 우선순위 |
|------|:------:|:------:|:--------:|
| A. `/ontology/cypher` 무인증 + 약한 Cypher 필터 | 높음(데이터유출) | 중 | **P0** |
| B. 하드코딩 시크릿 + JWT 소스 이원화 | 높음(권한상승) | 낮음 | **P0** |
| C. `/chat` 무인증 → OpenAI 비용 DoS | 높음(과금/노출) | 낮음 | **P0** |
| D. per-request httpx 클라이언트(풀 없음) | 중 | 낮음 | **P1** |
| G. 동기 blocking(xlsx/pdf/smtp/file) 루프 점유 | 중~높음 | 낮음 | **P1** |
| F. `/devices/status` 전체 풀스캔+루프내 import | 중 | 낮음 | **P1** |
| E. SSE 공유 deque 스케일·유실 | 중~높음 | 중~높음 | **P1** |
| H. 비캐시 Neo4j 조회 + 멀티 라운드트립 | 중 | 중 | **P1** |
| J. 무한증가 캐시(report/graph) 메모리 누수 | 중 | 낮음 | **P2** |
| I. 시작 시 행단위 INSERT 루프 | 낮음(기동만) | 낮음 | **P2** |
| K. Cypher필터/라벨 중복·데드코드 | 낮음(유지보수) | 중 | **P2** |
| L. SYSTEM_PROMPT 통계 드리프트 | 낮음~중(정확도) | 중 | **P2** |

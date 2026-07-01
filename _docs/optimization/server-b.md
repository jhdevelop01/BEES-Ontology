# Server B (BAS Adapter) 최적화 분석

> 대상: `platform/server-b` (FastAPI, 포트 8011 / 컨테이너 내부 8001, BACnet 프로토콜 게이트웨이)
> 분석 범위: `app/main.py`, `app/config.py`, `app/bacnet_adapter.py`, `app/command_queue.py`, `app/device_registry.py`, `app/neo4j_loader.py`
> 방식: 실제 소스 정독 기반(추측 없음). 모든 항목에 `파일:라인` 근거 명시.

---

## 1. 현행 구조 요약

Server B는 **Server A → Server C 사이의 REST 패스스루 게이트웨이**다. 4개 경로로 동작한다.

1. **제어 명령 경로** (`main.py:423` `POST /command`)
   - `registry.exists` / `registry.is_command_allowed`로 검증 (`main.py:440`, `455`)
   - `_http_client.post(/devices/{id}/command)`로 Server C 인라인 호출 (`main.py:478`)
   - 성공 시 MQTT `bees/commands/{device_id}` 발행 (`main.py:532`, `_publish_mqtt` `main.py:193`) + PostgreSQL `audit_log` 기록 (`main.py:535`)
   - 호출 실패(timeout/connect/status) 시 **명령 큐에 적재**하고 즉시 200 응답 (`main.py:497`)

2. **재시도 큐** (`command_queue.py`)
   - `asyncio.Queue` FIFO 단일 컨슈머 (`_process_queue` `command_queue.py:117`)
   - 최대 5회, 지수 백오프 `2**retry_count` (1·2·4·8·16초, `command_queue.py:146`)
   - TTL 1800초 만료 처리 (`command_queue.py:124`)
   - 실패 시 `retry_count++` 후 큐 뒤로 재삽입 (`command_queue.py:164`)

3. **디바이스 레지스트리** (`device_registry.py`)
   - 인메모리 `dict[ontology_id → DeviceInfo]` 싱글턴 (`device_registry.py:33`, `96`)
   - Phase 1 하드코딩 1대(AHU_5F) + 기동 시 Neo4j 자동 로딩 (`device_registry.py:36`, `neo4j_loader.py:103`)

4. **BACnet 시뮬레이터** (`bacnet_adapter.py`)
   - 순수 인메모리. `register_device`/`add_object`/`who_is`/`read_property`/`write_property` 동기 함수 (`bacnet_adapter.py:96`~)
   - 실제 BACnet I/O 없음(bacpypes 미사용, `bacnet_adapter.py:7`). 기동 시 레지스트리 장비를 BACnet 디바이스로 등록 (`main.py:702` `_init_bacnet_devices`)

**기동 시퀀스** (`lifespan` `main.py:341`): Neo4j 로딩(재시도) → BACnet 등록 → MQTT 연결 → PG 풀 → httpx 클라이언트 → 큐 프로세서 시작. 전역 리소스는 `_mqtt_client` / `_pg_pool` / `_http_client` (`main.py:62`).

---

## 2. 발견된 병목/이슈

### [P0-1] 재시도 큐의 head-of-line blocking — 단일 컨슈머가 백오프 sleep을 직렬 처리
- **위치**: `command_queue.py:117-171` (`_process_queue`), 특히 `command_queue.py:151` `await asyncio.sleep(delay)`
- **근거**: 컨슈머가 1개이고, 큐에서 명령을 꺼낸 뒤 **전송 전에** `await asyncio.sleep(delay)`를 호출한다. sleep 동안 다른 명령은 디큐되지 않는다. 실패한 명령은 `retry_count++` 후 큐 **뒤로** 재삽입되지만(`command_queue.py:164`), 처리 자체가 직렬이라 백오프 지연이 누적된다.
- **영향**: Server C 장애 시 N개 명령이 큐에 쌓이면, 각 명령이 자기 백오프(최소 1초)를 직렬로 소비 → 처리량이 `1/delay`로 붕괴. 한 장비의 16초 대기가 그 뒤 모든 명령을 막는다. 5회 모두 실패하는 명령 1건은 최소 1+2+4+8+16=31초의 컨슈머 점유를 유발하며, 다수가 섞이면 정상 복구된 Server C에도 명령 반영이 수십 초~수 분 지연된다.

### [P0-2] 무제한 큐 — 백프레셔 부재
- **위치**: `command_queue.py:58` `asyncio.Queue()` (maxsize 미지정), 적재부 `main.py:497` / `command_queue.py:94`
- **근거**: `asyncio.Queue()`는 maxsize=0(무제한). `POST /command`는 Server C 호출 실패 시 **무조건** enqueue하고 성공(200)으로 응답한다(`main.py:497-522`). 만료/실패 명령은 디큐 시점에야 정리된다(`command_queue.py:124`,`135`).
- **영향**: Server C 장기 장애 + 명령 폭주 시 큐가 메모리에서 무한 증가(OOM 위험). 또한 클라이언트는 항상 "성공" 응답을 받아 실제 미반영 상태를 알 수 없다(거짓 성공).

### [P1-1] 기동 시 Neo4j 로딩이 lifespan을 최대 50초 블로킹
- **위치**: `main.py:354` `await load_devices_with_retry(max_retries=5, delay=10.0)`, 구현 `neo4j_loader.py:192-229`
- **근거**: `yield`(`main.py:381`) 이전에 호출되며, 실패 시 10초 고정 간격 × 최대 5회 = 최대 50초 동안 startup이 블로킹된다. 이 구간에서는 MQTT/PG/httpx/큐 프로세서가 아직 초기화되지 않아 헬스체크조차 정상 응답 불가.
- **영향**: 컨테이너 기동 순서가 어긋나면 Server B 준비까지 최대 ~50초 지연. Docker healthcheck/오케스트레이션에서 unhealthy로 판정될 수 있음.

### [P1-2] Neo4j 조회가 라벨 인덱스를 못 쓰는 AllNodesScan
- **위치**: `neo4j_loader.py:126-132`
- **근거**: 쿼리가 `MATCH (e) WHERE any(label IN labels(e) WHERE label IN $target_labels)` 형태. 시작 패턴에 라벨이 없어 **전체 노드 스캔** 후 `labels()` 필터링한다. Neo4j 그래프는 11,000+ 노드(메모리 기준).
- **영향**: 기동 시 1회(및 `/devices/reload` 호출마다) 전체 노드 스캔. 라벨별 `MATCH (e:Label)` 또는 `UNWIND $labels AS l MATCH (e:??)` 패턴 대비 느림. 현재는 기동 1회라 체감은 작지만 reload 남발 시 비용 증가.

### [P1-3] 재시도마다 Neo4j 드라이버 생성/종료 반복
- **위치**: `neo4j_loader.py:110-189` (`load_devices_from_neo4j`가 매 호출 `AsyncGraphDatabase.driver(...)` 생성 후 `finally` 종료), 호출부 `neo4j_loader.py:209-210`
- **근거**: `load_devices_with_retry`가 이 함수를 최대 5회 호출 → 드라이버 생성/연결풀 초기화/종료를 최대 5회 반복. 드라이버 생성은 비용이 큰 작업.
- **영향**: 기동 지연 가중. 드라이버를 1회 생성해 재시도 루프에서 재사용하면 절감 가능.

### [P1-4] 감사 로그 DB 쓰기가 명령 응답 핫패스에 직렬 포함
- **위치**: `main.py:535` (`await _save_audit_log` — 성공 경로), 구현 `main.py:255-293`
- **근거**: 정상 명령마다 PostgreSQL INSERT를 `await`로 응답 전에 동기 수행. 거부/큐잉 경로에서도 동일(`main.py:442`,`459`,`503`).
- **영향**: DB 지연이 그대로 명령 응답 지연에 가산. 감사 로그는 비동기 fire-and-forget(`asyncio.create_task`) 또는 배치로 분리 가능. (단, 신뢰성 vs 지연 트레이드오프 명시 필요)

### [P2-1] 로컬 감사 로그 폴백이 list + `pop(0)` — O(n)
- **위치**: `main.py:67` `_local_audit_log: list`, `main.py:291-292` `pop(0)`
- **근거**: 500건 상한 유지를 위해 매 추가 시 `list.pop(0)`(선두 제거) 호출 → O(n) 시프트. `_fetch_audit_logs`의 `reversed(_local_audit_log[-limit:])`도 슬라이스 복사.
- **영향**: 저빈도라 실측 영향은 작으나, `collections.deque(maxlen=500)`로 바꾸면 O(1) + 상한 자동 관리.

### [P2-2] 명령 전송 로직 중복
- **위치**: 인라인 `main.py:478-486` vs 큐용 `_send_to_server_c` `main.py:322-335`
- **근거**: 둘 다 `POST /devices/{id}/command`로 동일 호출. 인라인 경로는 예외를 세분류(`main.py:490`)하지만 본질 동작은 같음.
- **영향**: 유지보수 부담(타임아웃/경로 변경 시 2곳 수정). 단일 헬퍼로 통합 권장.

### [P2-3] 미사용/죽은 코드
- **위치**:
  - `bacnet_adapter.py:14` `import random` — 파일 내 사용처 없음(grep 확인).
  - `config.py:37` `AUDIT_LOG_LIMIT` — 정의만 있고 참조 없음. 실제 상한은 `main.py:68` `MAX_LOCAL_AUDIT=500` 사용.
  - `bacnet_adapter.py:284` `get_device_by_ontology_id` — 호출처 없음.
  - `device_registry.py:61` `is_controllable` — 호출처 없음(명령 검증은 `is_command_allowed` 사용).
- **영향**: 기능 영향 없음. 정리 시 가독성/혼동 감소.

### [P2-4] BACnet read/write가 sync 함수인데 async 엔드포인트에서 직접 호출
- **위치**: `main.py:809` `bacnet_sim.read_property(...)`, `main.py:819` `write_property(...)` (둘 다 동기), 구현 `bacnet_adapter.py:192`,`227`
- **근거**: 현재는 순수 인메모리 dict 조회라 즉시 반환 → 이벤트 루프 블로킹 무시 가능. 단, 향후 실제 BACnet I/O(bacpypes) 연동 시(`bacnet_adapter.py:7-8` 주석) **이 동기 호출이 이벤트 루프를 블로킹**하게 된다.
- **영향**: 현재 무해. 실 BACnet 전환 시 `run_in_executor`/네이티브 async 필요 — 사전 인지 항목.

### [P2-5] `_extract_primary_class`의 "가장 긴 라벨 = 가장 구체적" 휴리스틱
- **위치**: `neo4j_loader.py:88-93` `max(specific, key=len)`
- **근거**: 라벨 문자열 길이로 구체성을 추정. 길이가 곧 구체성은 아니므로 device_type 오분류 가능(예: 짧은 정확 라벨 < 긴 일반 라벨).
- **영향**: device_type → `allowed_commands` 매핑(`neo4j_loader.py:161`) 정확도에 영향 가능. 성능 아닌 정합성 이슈.

---

## 3. 최적화 권고

### P0 (즉시 — 장애 시 데이터/가용성 직접 영향)
1. **큐 컨슈머 병렬화 + sleep 직렬화 제거** (`command_queue.py:117-171`)
   - 옵션 A: 워커 N개(`asyncio.create_task` 다중)로 디큐 처리.
   - 옵션 B(권장): 백오프를 컨슈머 점유 sleep으로 두지 말고, **재시도 예정 시각(`next_retry_at`)을 명령에 부여**하고 아직 이르면 즉시 큐 뒤로 되돌려 다른 명령을 먼저 처리(또는 `asyncio.sleep`을 per-command 태스크로 분리). head-of-line blocking 제거가 핵심.
2. **큐 maxsize 설정 + 백프레셔/거짓 성공 제거** (`command_queue.py:58`, `main.py:497-522`)
   - `asyncio.Queue(maxsize=K)`로 상한. 가득 차면 enqueue 거부 후 클라이언트에 **503/202** 등 실제 상태 반영(현재는 항상 `success=True`).

### P1 (단기 — 기동/지연 개선)
3. **Neo4j 로딩을 백그라운드 태스크로 이동** (`main.py:354`)
   - `yield` 이후/직전에 `asyncio.create_task(load_devices_with_retry(...))`로 비차단화. 로딩 완료 전엔 Phase 1 폴백(AHU_5F)로 동작, 헬스체크는 즉시 응답.
4. **Neo4j 쿼리 라벨 인덱스 활용** (`neo4j_loader.py:126`)
   - `UNWIND $target_labels AS lbl MATCH (e) WHERE lbl IN labels(e)` 또는 라벨별 분할 쿼리로 AllNodesScan 회피.
5. **드라이버 재사용** (`neo4j_loader.py:110`, `209`)
   - 드라이버를 재시도 루프 바깥에서 1회 생성해 주입. 또는 모듈 레벨 싱글턴.
6. **감사 로그 비동기 분리** (`main.py:535`)
   - 성공 경로 감사 로그를 `asyncio.create_task`로 fire-and-forget(트레이드오프: 프로세스 급종료 시 유실 가능 → 거부/큐잉 등 보안성 높은 이벤트는 동기 유지 검토).

### P2 (정리 — 가독성/미래 대비)
7. **죽은 코드 제거**: `import random`(`bacnet_adapter.py:14`), `AUDIT_LOG_LIMIT`(`config.py:37`), `get_device_by_ontology_id`(`bacnet_adapter.py:284`), `is_controllable`(`device_registry.py:61`).
8. **로컬 감사 로그 `deque(maxlen=500)`로 교체** (`main.py:67`,`291`).
9. **명령 전송 헬퍼 단일화** (`main.py:478` ↔ `322`).
10. **실 BACnet 대비**: read/write를 async화 또는 `run_in_executor` 래핑 설계 메모(`main.py:809`,`819`).

---

## 4. Impact × Effort 랭킹

| # | 권고 | 위치 | Impact | Effort | 우선 |
|---|------|------|:------:|:------:|:----:|
| 1 | 큐 head-of-line blocking 제거(워커 병렬화/sleep 분리) | `command_queue.py:117-171` | 높음 | 중 | **P0** |
| 2 | 큐 maxsize + 백프레셔/거짓 성공 제거 | `command_queue.py:58`, `main.py:497` | 높음 | 낮음 | **P0** |
| 3 | Neo4j 로딩 백그라운드화(기동 비차단) | `main.py:354` | 중상 | 낮음 | P1 |
| 4 | Neo4j 쿼리 라벨 인덱스화(AllNodesScan 제거) | `neo4j_loader.py:126` | 중 | 낮음 | P1 |
| 5 | Neo4j 드라이버 재사용 | `neo4j_loader.py:110`,`209` | 중 | 낮음 | P1 |
| 6 | 감사 로그 핫패스 분리 | `main.py:535` | 중 | 낮음 | P1 |
| 7 | 죽은 코드 4건 제거 | 각 파일 | 낮음 | 낮음 | P2 |
| 8 | 로컬 감사 로그 deque 전환 | `main.py:67`,`291` | 낮음 | 낮음 | P2 |
| 9 | 명령 전송 헬퍼 단일화 | `main.py:478`,`322` | 낮음 | 낮음 | P2 |
| 10 | BACnet read/write async 설계(미래 대비) | `main.py:809`,`819` | 낮음(현재) | 중 | P2 |

> **핵심 결론**: 정상 동작 시 Server B는 가볍지만, **Server C 장애 시나리오에서 재시도 큐(P0-1 head-of-line blocking, P0-2 무제한·거짓 성공)가 가장 큰 리스크**다. 기동 지연(P1-1) 및 Neo4j 로딩 비용(P1-2/3)은 부팅 경험 개선 항목이다. BACnet 어댑터는 순수 인메모리라 현재 병목 없음(단 실 I/O 전환 시 재설계 필요).

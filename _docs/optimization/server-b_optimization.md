# Server B 최적화 방향

> 대상: `platform/server-b` (BAS Adapter — 프로토콜 게이트웨이, FastAPI, 컨테이너 포트 8001 / 외부 8011)
> 분석 범위: `app/*.py` 7개 전체 정독 + `docker-compose.yml`/`.env` 교차 확인
> 작성일 기준 코드 상태로 분석 (코드 수정 없음, 분석만 수행)

---

## 1. 현황 요약 (구조·규모·구현 성숙도)

### 구조
- **main.py** (855줄): FastAPI 앱. 11개 엔드포인트(`/command`, `/devices*`, `/health`, `/audit-log`, `/command-queue`, `/bacnet/*`). MQTT·PostgreSQL·httpx 헬퍼와 lifespan 리소스 관리 포함.
- **command_queue.py** (207줄): Server C 호출 실패 시 명령을 보관·재시도하는 `asyncio.Queue` 기반 단일 프로세서 큐. 지수 백오프(1~16s), TTL 30분, 최대 5회 재시도.
- **bacnet_adapter.py** (330줄): 실제 BMS 없이 BACnet 프로토콜을 **인메모리 시뮬레이션**하는 스텁. `bacpypes3`/`BAC0` 미사용(docstring에 명시). Brick→BACnet 오브젝트 타입 매핑, read/write/who-is 흉내.
- **device_registry.py** (97줄): 온톨로지 ID→장비 정보 인메모리 딕셔너리. Phase 1 하드코딩(AHU_5F 1대) + Neo4j 로딩으로 확장.
- **neo4j_loader.py** (230줄): Neo4j에서 제어 가능 장비를 조회해 레지스트리에 등록. 재시도 래퍼(5회×10초) 포함.
- **config.py** (45줄): `pydantic-settings` 환경변수 로딩.

### 구현 성숙도
- **데이터 흐름의 실제 주체는 Server C**다. Server B는 "REST 패스스루 + MQTT 발행 + 감사 로깅 + BACnet 시뮬레이션"의 게이트웨이로, **실제 프로토콜 제어 기능은 없는 스텁** 단계(docstring·주석에 "Phase 1 MVP", "시뮬레이션 모드"로 명시됨).
- 폴백 설계는 비교적 견고: Neo4j 실패→Phase 1 폴백, PostgreSQL 실패→인메모리 감사 로그, MQTT 미연결→발행 스킵 후 서비스 지속. 단일 의존성 장애로 프로세스가 죽지 않도록 방어적으로 작성됨.
- 반면 **신뢰성(유실/중복)·관측성(observability)·보안(인증)** 측면은 미완성. 아래 이슈 참조.

### 교차 확인된 정상 사항 (오탐 방지)
- `SERVER_C_URL=http://server-c:8002`는 Server C **컨테이너 내부 포트**(외부 8012 매핑)로 **정상**. 설정 불일치 아님.
- `config.py`의 `PORT=8001`도 컨테이너 내부 포트로 정상(외부 8011 매핑).
- SQL은 전부 파라미터 바인딩(`$1..$6`) 사용 — SQL 인젝션 위험 없음.

---

## 2. 발견된 이슈 (우선순위별)

### P0 (즉시 조치 권장)

**P0-1. 모든 제어 엔드포인트에 인증·인가 부재 (보안)**
- 근거: `main.py:423` `POST /command`, `main.py:816` `POST /bacnet/write`, `main.py:570` `GET /devices/reload` 등 전 엔드포인트에 인증 미들웨어/의존성 없음. `CommandRequest.userId`(`main.py:79`)는 요청 본문에서 **무검증 신뢰**.
- 영향: 네트워크에 도달 가능한 누구나 장비 ON/OFF·setpoint·BACnet write를 실행하고, 임의 `userId`로 감사 로그를 위조할 수 있음. `audit_log` 테이블에 `ip_address INET` 컬럼(`main.py:243`)이 정의돼 있으나 **한 번도 채워지지 않음** — 사후 추적도 불가.
- 게이트웨이가 제어 평면(control plane)이라는 점에서 가장 치명적.

**P0-2. `/command-queue` 상태 API가 항상 0을 반환 (기능 버그)**
- 근거: 응답 모델 `CommandQueueStatus`(`main.py:132`)의 필드는 `pending/processing/completed/failed/total`. 그러나 `command_queue.get_status()`(`command_queue.py:191`)가 반환하는 키는 `queue_size/max_retries/ttl_seconds/stats{enqueued,succeeded,expired,failed}`로 **완전히 다름**.
- 영향: FastAPI `response_model` 직렬화 시 일치하는 필드가 없어 **모든 값이 기본값 0으로 채워지고 실제 큐 통계는 폐기**됨. 큐 적체/실패를 운영자가 모니터링할 수 없음 — 사실상 죽은 엔드포인트.

### P1 (신뢰성·관측성)

**P1-1. 단일 큐 프로세서 + 루프 내 백오프 sleep → head-of-line 블로킹**
- 근거: `command_queue.py:117` `_process_queue`는 단일 태스크. `command_queue.py:151` `await asyncio.sleep(delay)`(최대 16초)를 **꺼낸 명령 1건마다 루프 본문에서 블로킹**. 실패 시 `retry_count+1` 후 큐 뒤로 재삽입(`:163-164`).
- 영향: Server C가 특정 장비에 대해 계속 실패하면 그 1건의 백오프 대기(최대 16초) 동안 **뒤따르는 모든 명령 처리가 정지**. 큐가 길수록 처리량이 붕괴. 재삽입 명령이 즉시 다시 꺼내질 수 있어 사실상 단일 장비가 큐 전체를 점유.

**P1-2. 큐·로컬 감사 로그가 전부 인메모리 → 재시작 시 유실**
- 근거: `command_queue.py:58` `asyncio.Queue`, `main.py:67` `_local_audit_log` 모두 프로세스 메모리. 영속화 없음. Dockerfile에 `/app/db` 볼륨(`docker-compose.yml:121`)이 마운트돼 있으나 **코드에서 사용처 없음**(SQLite 등 미사용).
- 영향: 컨테이너 재시작/크래시 시 재시도 대기 중인 명령과 PostgreSQL 폴백 감사 로그가 모두 소실. at-most-once로 퇴화.

**P1-3. `/command`의 httpx 예외 처리 범위 불완전 → 일부 장애가 큐로 안 가고 500**
- 근거: `main.py:490`에서 `(httpx.TimeoutException, httpx.HTTPStatusError, httpx.ConnectError)`만 포착. `httpx.ReadError`, `httpx.RemoteProtocolError`, `httpx.PoolTimeout`, `httpx.WriteError` 등은 미포착.
- 영향: 위 미포착 예외 발생 시 명령이 **재시도 큐에 들어가지 못하고** 500 에러로 그대로 실패 — 일시 장애에 대한 복원력 상실. `httpx.HTTPError`(상위 클래스)로 포착해야 일관됨.

**P1-4. 큐 재시도로 뒤늦게 성공한 명령은 MQTT 발행·감사 로그 누락 (정합성/관측성)**
- 근거: 직접 성공 경로에서만 MQTT 발행(`main.py:532`)과 `action="command"` 감사 로그(`main.py:535`)가 기록됨. 큐 재시도 성공 경로(`command_queue.py:155` 분기 → `_send_to_server_c`, `main.py:322`)는 **`_succeeded` 카운터만 증가**시키고 MQTT 발행도, 최종 성공 감사 로그도 남기지 않음.
- 영향: `bees/commands/*`를 구독하는 측은 "큐를 거쳐 성공한 명령"을 영영 받지 못함. 감사 로그에는 `command_queued`만 남고 최종 결과(성공/만료/실패)가 기록되지 않아 감사 추적이 불완전.

**P1-5. 중복 실행 가능성 (멱등성 키 부재)**
- 근거: Server C가 명령을 **처리한 뒤** 응답이 타임아웃되면(`main.py:490`), Server B는 실패로 간주하고 큐에 재삽입 → 재전송. 명령에 멱등성 키/중복 제거 로직 없음(`command_queue.py:86` `command_id`는 큐 내부용 UUID로 Server C에 전달되지 않음).
- 영향: setpoint·ON/OFF가 중복 적용될 수 있음(at-least-once with duplicates). 토글성 명령에서 특히 위험.

### P2 (개선 권장)

**P2-1. `/devices/reload` 후 BACnet 시뮬레이터 미갱신**
- 근거: `_init_bacnet_devices()`는 lifespan(`main.py:358`)에서 **1회만** 호출. `reload_devices`(`main.py:570`)는 레지스트리만 갱신하고 `bacnet_sim`에는 신규 장비를 등록하지 않음.
- 영향: 운영 중 reload로 추가된 장비가 `/bacnet/*`에 노출되지 않아 레지스트리와 BACnet 뷰가 불일치.

**P2-2. 부작용 있는 작업에 GET 사용**
- 근거: `main.py:570` `GET /devices/reload`는 Neo4j 재조회·레지스트리 변경이라는 부작용을 가짐. REST 관례상 POST가 적절(프리페치/캐시/CSRF 측면에서도).

**P2-3. 미사용 import (데드 코드)**
- 근거: `bacnet_adapter.py:14` `import random` — 파일 내 사용처 없음.

**P2-4. `/health`가 의존성 장애 시에도 항상 HTTP 200**
- 근거: `main.py:653` `status="degraded"`를 본문에만 담고 상태 코드는 200 고정.
- 영향: 본문을 파싱하지 않는 헬스 프로브(L4/L7 로드밸런서, k8s readiness)가 degraded를 감지 못함. Dockerfile HEALTHCHECK(`/health`)도 항상 통과.

**P2-5. BACnet write 값 검증 부재**
- 근거: `bacnet_adapter.py:261` `obj.present_value = value` — 타입/범위 검증 없이 임의 값 수용. binary 오브젝트에 문자열·음수 등 비정상 값 주입 가능.

**P2-6. `_send_to_server_c` 성공 판정이 응답 본문을 버림**
- 근거: `main.py:331-332`는 2xx면 True만 반환하고 Server C 응답 내용을 활용하지 않음. 큐 경로에서 Server C가 "수신은 했으나 거부"한 응답을 구분하지 못함.

---

## 3. 최적화 방향 (이슈별 개선안 + 예상 효과)

### P0-1 (인증)
- **개선안**: 게이트웨이 앞단에 인증 도입. 최소한 Server A↔B 간 공유 시크릿/서비스 토큰을 `Depends`로 검증하는 FastAPI 의존성 추가. `userId`는 토큰에서 도출하고 본문 값은 무시. `audit_log.ip_address`를 `request.client.host`로 실제 기록.
- **효과**: 무단 제어·로그 위조 차단, 감사 추적성 확보. 내부망이라도 제어 평면은 인증이 표준.

### P0-2 (큐 상태 API)
- **개선안**: `CommandQueueStatus` 모델을 `get_status()` 실제 반환 형태(`queue_size`, `stats{...}`)에 맞춰 재정의하거나, `get_status()`가 모델 필드명에 맞춰 반환하도록 정렬. (둘 중 하나로 계약 일치)
- **효과**: 큐 적체·실패·만료를 실제로 모니터링 가능. 운영 가시성 회복.

### P1-1 (HOL 블로킹)
- **개선안**: ① 백오프를 루프 본문에서 빼고, 재삽입 시 `next_attempt_at` 타임스탬프를 부여해 "아직 시간 안 된" 명령은 즉시 재큐(또는 지연 큐/`asyncio.PriorityQueue` by due-time) 처리. ② 또는 워커 풀(N개 동시 처리)로 단일 장비가 큐를 점유하지 못하게 분리. ③ 장비별 백오프 상태를 분리.
- **효과**: 한 장비의 장애가 전체 큐를 막지 않음. 처리량·지연 안정화.

### P1-2 (영속화)
- **개선안**: 이미 마운트된 `/app/db` 볼륨에 SQLite(또는 PostgreSQL 테이블)로 큐·감사 로그를 영속화. 재시작 시 미완료 명령 복구. 감사 로그 인메모리 폴백도 동일 저장소 활용.
- **효과**: 재시작/크래시 시에도 명령·감사 데이터 보존. at-least-once 보장.

### P1-3 (예외 범위)
- **개선안**: `except (httpx.TimeoutException, ...)`를 `except httpx.HTTPError`(또는 `httpx.TransportError` + `HTTPStatusError`)로 확대. `reason` 분기는 유지.
- **효과**: 모든 일시적 전송 장애가 일관되게 재시도 큐로 유입.

### P1-4 (큐 성공 시 발행/로깅)
- **개선안**: `_send_to_server_c` 또는 큐 성공 콜백에서 MQTT 발행·`action="command"`(또는 `command_retry_success`) 감사 로그를 남기도록 후크 추가. 만료·최종 실패도 감사 로그에 기록.
- **효과**: 구독자 정합성 복구, 감사 추적 완결.

### P1-5 (멱등성)
- **개선안**: `command_id`(또는 클라이언트 제공 idempotency-key)를 Server C 명령 페이로드에 포함하고, Server C가 중복을 제거하도록 계약 합의. 최소한 setpoint 같은 비토글 명령을 우선 적용.
- **효과**: 타임아웃 후 재시도로 인한 중복 적용 방지.

### P2 묶음
- reload 시 `_init_bacnet_devices()` 재호출(또는 증분 등록)로 레지스트리·BACnet 동기화. reload를 POST로 전환. `import random` 제거. `/health`에 degraded 시 503 옵션(또는 별도 `/ready`). BACnet write 값 타입·범위 검증 추가.

---

## 4. 리스크 / 주의사항

- **스텁 특성 인지**: BACnet 어댑터는 실제 프로토콜 연동이 아닌 인메모리 시뮬레이션이다. "BACnet 게이트웨이"로 외부에 공개·연동하기 전에 실제 라이브러리(`bacpypes3`) 교체가 전제. 현재 `/bacnet/write`는 시뮬레이터 메모리만 바꿀 뿐 실제 장비/Server C로 전파되지 않음(제어 경로는 `/command`만 유효).
- **인증 추가 시 Server A 연동 영향**: P0-1 적용 시 Server A의 호출부에 토큰 주입이 필요하므로 **Server A 변경과 동기화**가 전제(독립 배포 불가).
- **큐 영속화·멱등성은 Server C 계약 변경 동반**: P1-2/P1-5는 Server B 단독으로 완결되지 않고 Server C의 명령 중복 제거 협조가 필요. 단독 머지 시 부분 효과만.
- **`response_model` 변경(P0-2) 호환성**: 큐 상태 응답 스키마를 바꾸면 이 API를 소비하는 프론트엔드/모니터링이 있는지 확인 필요(현재는 항상 0을 반환하므로 의존이 없을 가능성이 높음).
- **회귀 검증 수단 부재**: 프로젝트에 자동화 테스트가 없어(CLAUDE.md 명시), 위 변경은 수동 curl + 로그 확인으로 검증해야 함. 큐·재시도 로직 변경은 특히 회귀 위험이 있으니 최소 단위 테스트 추가를 권장.

# Server D 최적화 방향

> 대상: `platform/server-d` (Data Historian, FastAPI + InfluxDB + PostgreSQL, 포트 8003)
> 분석 일자: 2026-06-30 · 분석 기준: 실제 코드 정독 (app/*.py 15개 + db/init.sql)

## 1. 현황 요약 (구조·규모·데이터 파이프라인)

### 구조
- **코드 규모**: `app/` 하위 ~2,472 LOC. 핵심은 `mqtt_worker.py`(513L), 라우터 5종(points/devices/admin/health/export), 지원 모듈(config/database/quality/downsampling/retention).
- **데이터 저장소 2종**:
  - **InfluxDB** — 센서 시계열(`sensor_data` measurement) + 장비 상태(`device_state`). 버킷 3단(`raw_7d`→`aggregated_30d`→`aggregated_365d`)을 다운샘플링 Task로 연결(`downsampling.py`, `retention.py`).
  - **PostgreSQL** — 알람 이력(`alarm_history`), 감사 로그(`audit_log`) 등 관리 데이터(asyncpg 풀, `database.py`).

### 데이터 파이프라인 (수집)
1. Server C가 MQTT로 발행 → `mqtt_worker`가 3개 토픽 구독(`bees/points/#`, `bees/devices/#`, `bees/alarms/#`, 모두 qos=1).
2. **포인트/장비 상태**: paho 콜백 스레드에서 파싱→품질검사(`quality.py`)→메모리 버퍼(`_buffer`) 적재. `batch_flush_size=100` 도달 시 즉시, 또는 `batch_flush_interval=5초`마다 InfluxDB 배치 write.
3. **알람**: 별도 버퍼(`_alarm_buffer`)에 적재 → 주기 플러시 시 PostgreSQL `alarm_history`에 INSERT.
- 규모: 670 포인트 + 284 장비가 5초 주기로 발행 → 약 130~190 msg/s.

### 데이터 파이프라인 (조회)
- REST: `/data/points/{id}/latest|history`, `/data/points/summary`, `/data/devices/*`, `/alarm-history`, `/audit-log`, `/export`. 모두 InfluxDB Flux 또는 PostgreSQL 조회.

---

## 2. 발견된 이슈 (우선순위별)

### 🔴 P0 — 즉시 개선 권장

**[P0-1] 동기 InfluxDB I/O가 asyncio 이벤트 루프를 블로킹**
- `mqtt_worker.py:84` — `write_api(write_options=SYNCHRONOUS)`로 **동기(blocking) write** 사용.
- `mqtt_worker.py:483` — `_periodic_flush()`(asyncio task)가 `self._flush_buffer()`(동기 HTTP write)를 **이벤트 루프 안에서 직접 호출**. write가 진행되는 동안 FastAPI의 모든 async 핸들러(헬스체크/조회 API)가 멈춤.
- 조회 측도 동일: `points.py:118,198`, `devices.py:47,118`, `export.py:81` — `query_api.query()`(동기 HTTP)를 `async def` 안에서 직접 호출. InfluxDB 응답 지연 시 서버 전체가 직렬화됨(동시 요청이 순차 처리).
- **영향**: 5초마다 누적 수백 포인트 write + 무거운 조회가 겹치면 헬스체크/SSE 소비측까지 지연 전파. 단일 워커에서 처리량 상한이 낮아짐.

### 🟠 P1 — 단기 개선 권장

**[P1-1] 무제한 시계열 응답 (메모리/페이로드 폭증)**
- `points.py:200-216` — `/history`가 원시 레코드를 **상한 없이 전부** 반환. `from=-7d` + 집계 없음이면 포인트당 약 12만 레코드(5초×7일). 단일 응답으로 수십 MB → 메모리·네트워크·직렬화 비용 폭증.
- `points.py:111` — `/latest`가 마지막 1건 찾으려고 `range(start: -7d)` 전체 스캔.

**[P1-2] Flux 쿼리 인젝션 — 입력 미검증 직접 문자열 보간**
- 사용자 입력(`point_id`, `device_id`, `aggregation`, `from`/`to`, `equipment`, `points`)이 이스케이프 없이 f-string으로 Flux에 삽입됨: `points.py:113-115,180-184`, `devices.py:104-115`, `export.py:46-75`.
- `"` 포함 입력으로 쿼리 변조·임의 Flux 실행 가능. 특히 `export.py:51`의 정규식 보간(`r.point_id =~ /.*{equip_name}.*/`)과 `points` 콤마 분해는 검증 전무.

**[P1-3] write 실패 시 무재시도 → 데이터 유실**
- `mqtt_worker.py:470-476` — InfluxDB write 예외 시 로그만 남기고 **버퍼는 이미 비워진 상태**(449-450에서 copy+clear 선행). 일시적 네트워크 오류에도 해당 배치 영구 유실. 재시도·dead-letter 없음.
- 알람도 동일 구조(`_save_alarms_async`는 건별 try지만 풀 미연결 시 전량 유실, `409`).

**[P1-4] `/data/points/summary` 매 호출 풀스캔 (캐시 없음)**
- `points.py:48-64` — 전 포인트 `range(-7d)` + `count()` 집계를 **요청마다** 실행. 670 포인트×7일 스캔은 고비용. 대시보드가 폴링하면 InfluxDB 부하 급증. TTL 캐시 부재.

**[P1-5] 관리 API 인증 부재**
- `admin.py` 전 엔드포인트 무인증. 특히 `acknowledge_alarm`(246-)은 `acknowledged_by`를 **쿼리 파라미터 기본값 1**로 받아 누구나 알람 확인 처리 가능. `audit-log`(293-)는 IP/사용자 행위를 무인증 노출. 감사 로그 본래 취지(무결성)와 상충.

### 🟡 P2 — 중장기/품질 개선

**[P2-1] CORS 와일드카드 + credentials 조합**
- `main.py:133-137` — `allow_origins=["*"]` + `allow_credentials=True`. 브라우저 스펙상 무효이며 보안 안티패턴. 운영 시 도메인 화이트리스트 필요.

**[P2-2] 동기 알람 플러시 메서드 데드코드 + 위험 패턴**
- `mqtt_worker.py:359-385` `_flush_alarms()`는 호출처 없음(주기 플러시는 `_flush_alarms_async` 사용, 484). 내부의 `asyncio.get_event_loop()` + `run_coroutine_threadsafe`는 Python 3.12에서 deprecation/오작동 위험. 제거 권장.

**[P2-3] InfluxDB 태그 카디널리티 — `quality`를 태그로 사용**
- `mqtt_worker.py:254-255` — `unit`, `quality`를 태그로 부착. `quality`(good/uncertain/bad)가 같은 point_id에서 변동하면 **시리즈가 분할**되어 카디널리티·저장 비용 증가, 연속성 깨짐. `quality`는 field가 적합.

**[P2-4] PostgreSQL 인덱스 미활용 (선행 와일드카드 ILIKE)**
- `admin.py:58,68` — `equipment_id ILIKE '%...%'`, `alarm_type ILIKE '%...%'`는 선행 `%`로 btree 인덱스(`idx_alarm_history_equipment`) 미사용 → 시퀀셜 스캔. `alarm_type`엔 인덱스 자체가 없음(`init.sql:95-97`). 데이터 누적 시 느려짐. (단, `onset_at DESC` 정렬·범위 조건은 인덱스 양호.)

**[P2-5] MQTT 세션·재연결 신뢰성**
- `mqtt_worker.py:97-100` — `clean_session` 기본(True). 브로커 재연결 사이 구간의 qos=1 메시지가 유실될 수 있음. Historian 특성상 `clean_session=False`(persistent session)로 브로커 큐잉 활용 검토.
- 버퍼는 순수 인메모리 → 프로세스 크래시 시 미플러시 분 유실(시뮬레이션 환경에선 수용 가능, 명시 필요).

**[P2-6] 단건 저장마다 write_api 재생성**
- `points.py:255` — `POST /data/points`가 요청마다 `write_api(...)` 생성. fallback 용도라 빈도 낮으나 핸들러 진입마다 객체 생성은 불필요.

**[P2-7] 장비 상태(device_state) 다운샘플링·보존 누락**
- `downsampling.py`는 `sensor_data`의 `value`만 집계. `device_state`는 `raw_7d` 7일 후 소멸 → 장기 가동률 분석 불가.

**[P2-8] 사소한 중복/일관성**
- ISO 타임스탬프 파싱(`datetime.fromisoformat(ts.replace("Z","+00:00"))`)이 4곳 중복(worker 236,305,416 / points 241) → 헬퍼화 권장.
- `Dockerfile`/`config`는 8003, `CLAUDE.md`는 8013로 표기(컨테이너 내부 vs 매핑 포트). 문서 일관성 확인 필요.

---

## 3. 최적화 방향 (이슈별 개선안 + 예상 효과)

### P0-1 (이벤트 루프 블로킹) — 최우선
- **조회**: `query_api.query()` 호출을 `await asyncio.get_running_loop().run_in_executor(None, query_api.query, flux, org)`로 감싸 스레드풀에 위임. 또는 InfluxDB 비동기 클라이언트(`influxdb_client.client.influxdb_client_async`) 도입.
- **write**: `_periodic_flush`에서 `self._flush_buffer()`를 `run_in_executor`로 오프로드하거나, paho 콜백 스레드 측에서만 동기 flush를 수행하고 이벤트 루프에선 트리거만. 더 근본적으로는 InfluxDB 클라이언트의 **배치 모드(`WriteType.batching`)** 채택 — 백그라운드 플러시·재시도·지터를 라이브러리가 처리(아래 P1-3과 결합).
- **효과**: 동시 요청 직렬화 해소, write 중 헬스체크/조회 멈춤 제거. 단일 워커 처리량·응답 지연 크게 개선.

### P1-1 (무제한 응답)
- `/history`에 `limit`(기본 예: 5,000)·`max_points` 가드 추가, 초과 시 자동 `aggregateWindow` 강제 또는 `429`/안내. `/latest`는 `range(-10m)`로 좁히고 데이터 없을 때만 `-7d` 폴백(2단 조회). **효과**: 응답 페이로드·메모리 수십 배 절감, latest 쿼리 비용 급감.

### P1-2 (Flux 인젝션)
- 식별자 화이트리스트 검증(정규식 `^[A-Za-z0-9:_\-./]+$`), `aggregation`은 enum(`1m/5m/1h/1d`), 시간 인자는 상대표현/ISO만 허용. 가능하면 Flux `query_params`(파라미터 바인딩) 사용. **효과**: 쿼리 변조·임의 실행 차단.

### P1-3 (데이터 유실)
- write 실패 배치를 재시도 큐로 되돌리거나(버퍼 prepend), 배치 모드의 재시도 정책(`max_retries`, backoff) 활용. 실패 카운터를 헬스 degraded로 노출. **효과**: 일시 장애 시 데이터 보존.

### P1-4 (summary 풀스캔)
- 결과를 짧은 TTL(예: 10~30초) 인메모리 캐시 또는 다운샘플 버킷(`aggregated_30d`) 기반 조회로 전환. `total_records`는 별도 저빈도 잡으로 산출. **효과**: 폴링 부하 제거, 응답 ms 단위로 단축.

### P1-5 (관리 API 인증)
- Server A와 동일한 인증(토큰/세션) 미들웨어 또는 FastAPI `Depends` 가드 적용. `acknowledged_by`는 쿼리 기본값 제거 후 인증 주체에서 추출. **효과**: 감사 무결성 확보, 무단 알람 확인 차단.

### P2 묶음
- CORS 도메인 제한, 데드코드 제거, `quality`→field 전환(신규 데이터부터), `alarm_type` 인덱스 추가 및 검색 UX가 prefix로 충분하면 `ILIKE 'x%'`로 전환, `clean_session=False`, write_api 재사용(라우터 의존성 주입), device_state 다운샘플 Task 추가, 타임스탬프 파서 헬퍼화.

---

## 4. 리스크 / 주의사항

- **P0-1 적용 시 스레딩 모델 변경 주의**: `_buffer`/`_alarm_buffer`는 이미 `threading.Lock`으로 보호되나, write를 executor로 옮기면 플러시 동시 진입 가능성 검토 필요(플러시 중복 방지 플래그 권장).
- **`quality` 태그→field 전환은 비가역적 스키마 변경**: 기존 `raw_7d` 데이터와 혼재. 신규 measurement/필드로 분리하거나 버킷 롤오버 시점에 적용 권장.
- **다운샘플 Task는 InfluxDB OSS에서 미지원 가능**(`downsampling.py:103-108`에서 이미 ApiException 흡수). 운영 InfluxDB 에디션 확인 후 대안(외부 cron + Flux) 검토.
- **인증 추가(P1-5)는 Server A 프론트엔드 호출 경로에 영향** — 프론트가 Server D를 직접 호출하는 구간이 있는지 확인 후 토큰 전파 설계 필요.
- 본 분석은 코드 정적 분석 기준. 실제 InfluxDB 카디널리티·쿼리 지연은 운영 데이터로 프로파일링하여 우선순위 재조정 권장. **코드는 수정하지 않았음.**

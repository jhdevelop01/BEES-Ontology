# Server D (Data Historian) 최적화 분석

> 대상: `platform/server-d` (FastAPI, 포트 8003→외부 8013, InfluxDB 시계열 + PostgreSQL 관리데이터)
> 분석 방식: 전체 소스 정적 분석 (file:line 근거). 실행 프로파일링은 미수행.
> 분석 시점 기준 git 수정 상태(main.py / models.py / mqtt_worker.py / admin.py 수정, devices.py 신규)를 그대로 반영.

---

## 1. 현행 구조 요약

**역할**: MQTT(`bees/points/#`, `bees/devices/#`, `bees/alarms/#`) 구독 → InfluxDB 배치 저장 + PostgreSQL 알람 저장, 그리고 시계열/장비/알람/감사 조회 및 CSV·JSON 내보내기 REST API.

**데이터 경로**
- **쓰기(수집)**: `mqtt_worker.MQTTWorker` 싱글톤. paho-mqtt 콜백 스레드(`_on_message`)에서 페이로드 파싱 → `quality_checker.check()` 품질 태깅 → `Point` 생성 → 메모리 버퍼(`_buffer`)에 적재. 플러시는 ① 버퍼 크기 `batch_flush_size(=100)` 도달 시(콜백 스레드), ② `batch_flush_interval(=5s)` 주기(asyncio 이벤트 루프 `_periodic_flush`) 두 경로. InfluxDB write_api는 **SYNCHRONOUS** 모드(`mqtt_worker.py:84`).
- **알람**: `bees/alarms/#` → `_alarm_buffer` → 5초 주기 `_flush_alarms_async` → PostgreSQL `alarm_history`에 행 단위 INSERT 루프(`mqtt_worker.py:407-438`).
- **읽기(조회)**: `database.py`의 전역 InfluxDB QueryApi / asyncpg 풀(min2/max10). 라우터 `points / devices / export`는 Flux 쿼리, `admin`은 PostgreSQL.
- **다운샘플링/리텐션**: 시작 시 `ensure_buckets()`(raw_7d/aggregated_30d/aggregated_365d 3버킷) + `ensure_downsampling_tasks()`(InfluxDB Task로 5m·1h mean 집계) 1회 등록.

**측정 가능 규모**: Server C가 670 포인트 + 284 장비를 5초 주기 발행 → 초당 약 134 포인트 쓰기, 일 약 1,150만 포인트(raw 7일 보존 시 약 8천만 시리즈 레코드).

---

## 2. 발견된 병목/이슈

### [P0-1] 동기 InfluxDB 쓰기가 FastAPI 이벤트 루프를 블로킹
- **근거**: `mqtt_worker.py:84` `write_api(write_options=SYNCHRONOUS)`, `mqtt_worker.py:478-484` `_periodic_flush`가 이벤트 루프에서 `self._flush_buffer()`(동기 HTTP write, `mqtt_worker.py:458`)를 **`await` 없이 직접 호출**.
- **영향**: 5초마다 이벤트 루프가 InfluxDB write 왕복(네트워크 + 디스크) 동안 정지한다. 같은 루프에서 처리되는 모든 REST 조회(`/data/points/*`, `/export`, `/health`)가 그 시간만큼 지연. 배치가 클수록(예: 누적 수백 포인트) 한 번에 수십~수백 ms 스톨. InfluxDB 일시 지연 시 전체 API p99가 동반 악화.
- 동일 `_flush_buffer`가 paho 콜백 스레드에서도 호출(`mqtt_worker.py:265-266`)되어 **수신 스레드까지 블로킹** → MQTT 수신 백프레셔(아래 P0-2와 연동).

### [P0-2] 쓰기 실패 시 데이터 무손실 보장 없음 + 무제한 버퍼
- **근거**: `_flush_buffer`는 락 안에서 버퍼를 copy 후 **즉시 clear**(`mqtt_worker.py:449-450`)하고 write를 시도. write 예외 시 `points_to_write`는 재시도 없이 폐기(`mqtt_worker.py:470-476`, "유실" 로그). 알람도 동일(`mqtt_worker.py:404`).
- **영향**: InfluxDB/PG 일시 장애 동안 수집된 모든 포인트·알람이 영구 유실. Data Historian의 핵심 책무(무손실 영속화)와 정면 충돌. 반대로 `_buffer`는 상한이 없어(`mqtt_worker.py:50`) 쓰기가 막히면 무한 증가 → OOM 가능. 즉 "실패하면 버리거나, 안 버리면 터지거나" 양극단.

### [P0-3] export가 "스트리밍"이 아니라 전체 메모리 적재
- **근거**: `export.py:87-96` 쿼리 결과를 `records` 리스트에 **전량 적재** 후, `_stream_csv`는 이미 다 모은 리스트를 줄 단위로 흘려보냄(`export.py:104-125`). JSON은 `json.dumps`로 전체 직렬화(`export.py:130-133`). 행 수·기간 상한 없음(`start` 기본 -24h, 무제한 가능).
- **영향**: 670포인트 × 24h(5초) ≈ 1,160만 행을 단일 요청이 메모리에 올림 → OOM/장시간 GC. 다중 내보내기 동시 요청 시 컨테이너 다운 위험. `query_api.query()`는 동기 호출이라 이 큰 쿼리도 이벤트 루프를 블로킹(P0-1과 동류).

### [P1-1] 장기 조회가 항상 raw_7d 버킷만 스캔 — 다운샘플 버킷 미활용
- **근거**: 모든 조회가 `settings.influxdb_bucket`(기본 `raw_7d`) 하드코딩 — `points.py:49,58,111,179,190`, `devices.py:40,102,111`, `export.py:73`. 시간 범위·집계 여부와 무관하게 5초 원시 버킷을 읽음. aggregated_30d/365d는 조회 경로에서 전혀 사용되지 않음.
- **영향**: 7일 범위 history/summary가 포인트당 ~12만 raw point를 스캔(전체 ~8천만). aggregated_30d(5분)·365d(1시간)를 만들어 놓고도 질의에서 안 써서 다운샘플링 투자 효과가 0. 범위에 따라 버킷을 라우팅하면 장기 쿼리 비용이 수십~수백 배 감소.

### [P1-2] summary / latest가 -7d 전 구간 last()·count() 풀스캔
- **근거**: `/data/points/summary`는 `range(-7d)` + `group(point_id)` + `last()`(`points.py:48-54`)와 별도 `count()` 풀스캔(`points.py:57-64`)을 매 호출 수행. `/{id}/latest`도 `range(-7d)`(`points.py:111`).
- **영향**: 데이터가 5초마다 들어오므로 최신값은 항상 최근 수십 초 내에 존재한다. 그런데 7일 전체를 훑어 last를 구함 → 불필요하게 수천만 레코드 스캔. `count()` 풀스캔(`total_records`)은 더 비쌈. 범위를 `-10m`(수집 주기 대비 충분)로 줄이고 count는 캐시/근사치로 대체하면 summary 응답이 급격히 빨라짐. 두 쿼리 모두 동기 → 이벤트 루프 블로킹.

### [P1-3] Flux 쿼리 문자열 인젝션 (보안 + 안정성)
- **근거**: 사용자 입력을 f-string으로 Flux에 직접 보간 — `point_id`/`device_id`(`points.py:115,183,194`, `devices.py:105,114`), `aggregation`(`points.py:184`, `devices.py:107`), `start`/`end`(`points.py:172-173`, `export.py:57-78`), `export`의 `equipment` 정규식(`export.py:51`). 검증·이스케이프 없음.
- **영향**: `point_id`에 `"`나 Flux 구문을 넣어 쿼리를 변형/오류 유발 가능. `aggregation`/`start`처럼 그대로 들어가는 토큰은 잘못된 값 하나로 쿼리 전체가 깨져 500을 유발(안정성). InfluxDB 파라미터 바인딩(`query(query, params=...)`) 또는 화이트리스트 검증 필요. (참고: `admin.py`의 알람/감사 본 조회는 `$N` 바인딩으로 안전하나, `alarm-history/statistics`·통계의 `INTERVAL '{days_back} days'`는 f-string — `days_back`이 `Query(ge=1,le=365)` 정수라 현재는 안전하지만 패턴은 위험.)

### [P1-4] 태그 카디널리티 — `quality`/`mode`를 태그로 사용
- **근거**: `sensor_data`에 `quality` 태그(`mqtt_worker.py:255`), `device_state`에 `mode` 태그(`mqtt_worker.py:311`). quality는 good/uncertain/bad로, mode는 auto/manual/off 등으로 시간에 따라 변동.
- **영향**: InfluxDB 시리즈 키 = 태그 조합. 동일 point_id가 quality 값마다 별도 시리즈로 분기(point_id × unit × quality)되어 시리즈 카디널리티·인덱스 메모리가 증가하고, 같은 포인트의 연속 시계열이 여러 시리즈로 쪼개짐. 시간에 따라 자주 바뀌는 값은 **태그가 아니라 필드**가 적합. quality/mode를 필드로 옮기면 카디널리티가 point_id(670)/device_id(284) 수준으로 안정화.

### [P2-1] PostgreSQL 알람 INSERT 행 단위 루프
- **근거**: `_save_alarms_async`가 알람을 `for` 루프로 개별 `conn.execute` INSERT(`mqtt_worker.py:412-434`).
- **영향**: 현재 알람 볼륨이 낮아 체감은 작지만, 알람 폭주(다수 장비 동시 임계 초과) 시 N회 왕복. `executemany`/`copy_records_to_table` 또는 다중 VALUES 한 번에 처리로 개선 여지.

### [P2-2] alarm_history `equipment`/`alarm_type` ILIKE '%...%' 인덱스 미활용
- **근거**: `admin.py:58,68` `ILIKE '%키워드%'`. 스키마 인덱스는 `idx_alarm_history_equipment(equipment_id)`, `severity`, `onset_at DESC`만 존재(`db/init.sql:95-97`), `alarm_type` 인덱스 없음.
- **영향**: 선행 와일드카드 `%...%`는 btree 인덱스를 못 타 풀스캔. 데이터 누적 시 알람 이력 조회·`COUNT(*)`가 느려짐. 접두 매칭(`키워드%`)이 가능한 케이스 분리, 또는 `pg_trgm` GIN 인덱스 도입 검토.

### [P2-3] POST /data/points 매 요청 write_api 재생성 + 동기 쓰기
- **근거**: `points.py:255` 요청마다 `influx_client.write_api(write_options=SYNCHRONOUS)` 새로 생성 후 동기 write.
- **영향**: REST fallback 저장 시 클라이언트/세션 셋업 오버헤드 반복 + 이벤트 루프 블로킹. 워커의 공용 write 경로(버퍼)로 위임하거나 write_api를 재사용하는 편이 효율적.

### [P2-4] 죽은 코드 / 잠재 위험 경로
- **근거**: 동기판 `_flush_alarms`(`mqtt_worker.py:359-385`)는 호출처가 없음(주기 플러시는 `_flush_alarms_async` 사용, `mqtt_worker.py:484`). 내부에서 `asyncio.get_event_loop()`(`mqtt_worker.py:375`)는 Python 3.12에서 비권장 패턴.
- **영향**: 유지보수 혼란. 향후 누군가 콜백 스레드에서 호출하면 `run_coroutine_threadsafe(...).result(timeout=10)`로 paho 수신 스레드가 최대 10초 블로킹될 수 있음. 제거 권장.

### [P2-5] CORS 설정 모순
- **근거**: `main.py:132-138` `allow_origins=["*"]` + `allow_credentials=True`.
- **영향**: 브라우저 표준상 와일드카드 + credentials 조합은 무효/비권장. 운영 시 허용 도메인 명시 필요(보안 + 동작 정확성).

### [관찰] 다운샘플링/리텐션 문서·구현 불일치
- **근거**: `retention.py:7` 주석은 aggregated_365d를 "1일 평균"으로 기술하나, `downsampling.py:44-53` 태스크는 1시간 평균을 적재. 또 `downsampling.py:103-108` 주석대로 InfluxDB OSS는 Task API 미지원 가능 → 실패해도 warning만 남기고 통과.
- **영향**: OSS 환경이면 다운샘플 버킷이 비어 P1-1의 버킷 라우팅 전제도 무너짐. 배포 InfluxDB 에디션 확인 및 Task 동작 검증 필요(미지원 시 외부 cron + Flux로 대체).

---

## 3. 최적화 권고

### P0 (즉시 — 정확성/안정성/데이터 무손실 직결)
1. **수집 쓰기를 비동기/논블로킹화** (P0-1):
   - 단기: `_periodic_flush`에서 동기 `_flush_buffer`를 `await loop.run_in_executor(...)`로 분리하거나 별도 쓰기 스레드/큐로 이전 → 이벤트 루프 블로킹 제거.
   - 권장: influxdb-client 내장 **배치 WriteApi**(`WriteOptions(batch_size, flush_interval, jitter, retry_interval, max_retries, max_retry_delay)`)로 교체. 수동 버퍼/락/타이머를 라이브러리에 위임하면 P0-1·P0-2(재시도·백프레셔)·P2-3를 한 번에 해결.
2. **무손실 + 백프레셔 경계 설정** (P0-2): 쓰기 실패 시 재시도 큐(또는 내장 WriteApi 재시도) 도입, 버퍼에 **상한(max len)** + 초과 시 정책(블록/드롭+카운터) 명시. 현재의 "copy 후 즉시 clear→실패 시 폐기"를 "성공 확인 후 제거"로 전환.
3. **export 진성 스트리밍 + 상한** (P0-3): `query_api.query_stream()`(또는 raw CSV stream)로 행 단위 yield, 전량 적재 제거. 최대 기간/행 수 가드 추가, 큰 쿼리는 executor로 오프로딩. 초과 시 413/파라미터 안내.

### P1 (단기 — 쿼리 효율/보안)
4. **시간 범위별 버킷 라우팅** (P1-1): 범위 길이에 따라 raw_7d / aggregated_30d / aggregated_365d 선택. history·export·summary에 적용해 장기 쿼리 스캔량 대폭 절감.
5. **summary/latest 범위 축소** (P1-2): `last()`·`latest`는 `-10m`(수집 주기 5s 대비 충분) 범위로. `total_records`는 매번 풀스캔 대신 주기 캐시/근사. 두 동기 쿼리는 executor 오프로딩.
6. **Flux 입력 파라미터 바인딩/검증** (P1-3): `point_id`/`device_id`/`equipment`는 바인딩 또는 정규식 화이트리스트, `aggregation`/`start`/`end`는 형식 검증(예: `^\d+(s|m|h|d)$`, ISO8601/상대표현). 잘못된 입력은 400으로 빠르게 반려.
7. **quality/mode를 필드로 이동** (P1-4): 카디널리티 안정화. (마이그레이션 비용 고려해 신규 measurement로 점진 전환 가능.)

### P2 (중기 — 점진 개선)
8. 알람 INSERT 배치화(`executemany`/`copy_records_to_table`) (P2-1).
9. alarm 조회 인덱스 전략: `alarm_type` 인덱스 추가 또는 `pg_trgm` GIN, 접두 매칭 분기 (P2-2).
10. POST /data/points는 공용 write 경로로 위임/write_api 재사용 (P2-3).
11. 죽은 `_flush_alarms`(sync) 제거 (P2-4), CORS 운영 도메인 명시 (P2-5).
12. 다운샘플 문서·구현 불일치 정정 + 배포 InfluxDB의 Task API 지원 검증 (관찰 항목).

---

## 4. Impact × Effort 랭킹

| 순위 | 항목 | Impact | Effort | 비고 |
|:--:|------|:--:|:--:|------|
| 1 | P0-1 동기 write → 논블로킹/내장 배치 WriteApi | 高 | 中 | 라이브러리 교체 시 P0-2·P2-3 동반 해결 |
| 2 | P0-3 export 진성 스트리밍 + 상한 | 高 | 低 | OOM 직접 방지, 변경 국소적 |
| 3 | P1-2 summary/latest 범위 -7d→-10m | 高 | 低 | 한 줄 수준 변경, 스캔량 수백 배↓ |
| 4 | P0-2 무손실 재시도 큐 + 버퍼 상한 | 高 | 中 | 내장 WriteApi 채택 시 Effort↓ |
| 5 | P1-1 시간범위별 버킷 라우팅 | 高 | 中 | 다운샘플 투자 회수, Task 동작 전제 |
| 6 | P1-3 Flux 입력 검증/바인딩 | 中 | 低 | 보안+안정성, 라우터별 헬퍼화 |
| 7 | P1-4 quality/mode 태그→필드 | 中 | 中 | 카디널리티, 데이터 마이그레이션 수반 |
| 8 | P2-2 alarm 인덱스(alarm_type/pg_trgm) | 中 | 低 | 데이터 누적 시 효과 증대 |
| 9 | P2-1 알람 INSERT 배치화 | 低 | 低 | 알람 폭주 대비 |
| 10 | P2-3 POST write_api 재사용 | 低 | 低 | fallback 경로 한정 |
| 11 | P2-4/2-5 죽은 코드·CORS 정리 | 低 | 低 | 유지보수/보안 위생 |
| 12 | 다운샘플 문서·Task 검증 | 中 | 低 | P1-1 선행 조건 |

> 우선 적용 순서 제안: **3(범위 축소) → 2(export 스트리밍) → 1(논블로킹 쓰기/배치 WriteApi) → 4(무손실)** 순으로 가면 낮은 Effort부터 즉시 체감 효과를 얻고, 1번에서 라이브러리 내장 기능으로 다수 항목을 흡수할 수 있다.

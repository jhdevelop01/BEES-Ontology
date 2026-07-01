# Server C 최적화 방향

> 대상: `platform/server-c` (가상 건물 에뮬레이터, FastAPI, 포트 8012→내부 8002)
> 분석 일자: 2026-06-30 · 분석 범위: 13개 `.py` 전체 정독 (engine, thermodynamics, config, profile_factory, neo4j_loader, fault_injection, scenarios, weather, alarm_checker, main, ahu_5f)

---

## 1. 현황 요약 (구조·규모·시뮬레이션 파이프라인)

### 1.1 구조
- **단일 싱글턴 엔진**: `main.py`가 `EmulatorEngine` 1개를 생성, FastAPI `lifespan`에서 Neo4j 로딩 → 자동 시작.
- **모듈 분리**: 데이터 생성(`engine.py`) / 열역학(`thermodynamics.py`) / 프로파일 매핑(`profiles/profile_factory.py`) / 고장 주입(`fault_injection.py`) / 시나리오(`scenarios.py`) / 기상(`weather.py`) / 알람(`alarm_checker.py`) / Neo4j 로더(`neo4j_loader.py`).
- **초기화 경로**: `initialize_from_neo4j()`가 Neo4j에서 장비/포인트를 로딩(`isPointOf` 역방향 쿼리) → `create_device_profile`/`create_data_profile`로 프로파일 생성 → 실패 시 AHU_5F 하드코딩 폴백. 추가로 공조 센서 없는 7개 층에 가상 Zone 온/습/CO2 포인트 주입.

### 1.2 규모
- 약 284 장비 / 670 포인트 (MEMORY 기준), Zone 온도 포인트는 1차 열역학 모델(`ThermalModel`) 사용.
- `SIMULATABLE_EQUIPMENT_LABELS` 약 50종, `POINT_SPECS` 약 30종, 전력 센서는 `EQUIPMENT_POWER_OVERRIDE` 25종으로 장비별 보정.

### 1.3 시뮬레이션 파이프라인 (`_simulation_loop`)
매 틱마다:
1. `now` 1회 계산, 시나리오 변경 감지 시 기상 오버라이드 갱신.
2. **670개 포인트 순회** → `_generate_value()` (통신단절/센서고착/바이너리/Setpoint/열역학/일반 분기) → `bees/points/{id}` 개별 발행 → 알람 체크 → `bees/alarms/{sev}` 발행.
3. **284개 장비 순회** → `bees/devices/{id}/state` 개별 발행.
4. `await asyncio.sleep(SIMULATION_INTERVAL)`.

데이터 공식: `value = base + noise·U(-1,1) + daily_pattern + equipment_effect + seasonal + drift + fault_drift + degraded_effect + leak_effect` → 물리 범위 클리핑.

MQTT는 `connect_async` + `loop_start`(별도 네트워크 스레드), 발행은 `qos=0` fire-and-forget. paho 발행 호출은 스레드 안전하므로 asyncio 스레드에서 직접 enqueue (크로스스레드 문제 없음).

---

## 2. 발견된 이슈 (우선순위 P0/P1/P2)

### 🔴 P0 — 즉시 검토 필요

**[P0-1] `SIMULATION_INTERVAL` 5.0초 → 1.0초 변경으로 플랫폼 전체 부하 5배 증가**
`config.py:23` (git status `M`, 미커밋). 기존 5초 → 1초.
- 한 틱당 발행량 ≈ 670(포인트) + 284(장비 상태) ≈ **954건** + 알람.
- 5초→1초 변경으로 **초당 ~191건 → ~954건**으로 약 5배 증가. 이 부하는 Server C 단독이 아니라 **다운스트림 전체에 증폭 전파**:
  - Server A `mqtt_service`(메모리 캐시 + SSE 0.5초 배치) 처리량 5배
  - Server D `mqtt_worker` → **InfluxDB 쓰기 5배** (저장공간/IO 증가가 가장 큼)
  - 프론트엔드 SSE 트래픽 증가
- CLAUDE.md·MEMORY 전반이 "5초 주기" 전제로 기술됨 — 의도된 변경인지 확인 필요. 의도라면 Server D의 다운샘플링/배치 쓰기 정책도 같이 점검해야 함.

**[P0-2] 핫 루프에서 `_find_spec` 매 틱·매 포인트 선형 재탐색 + 함수 내부 import**
`engine.py:485-491` → `profile_factory._find_spec()`.
- `_generate_value`가 일반 센서마다 `from .profiles.profile_factory import _find_spec`를 **루프 내부에서 import**하고, `_find_spec`는 `POINT_SPECS`(~30개)에 대해 정확매칭 실패 시 `endswith`/`in` **선형 스캔**(최대 ~60회 문자열 비교)을 수행.
- 결과: **틱당 (670 - 바이너리/Setpoint 제외) × 최대 60회 문자열 비교 + 670회 import 조회**가 매초 반복. spec은 프로파일 생성 시점에 확정되어 **절대 변하지 않음** → 순수 낭비 연산.

**[P0-3] 670포인트 생성이 이벤트 루프를 동기 블로킹 (yield 없음)**
`engine.py:610-679`. 포인트·장비 순회 전체가 `await` 없이 동기 실행 → 한 틱 계산 동안 FastAPI 이벤트 루프가 점유됨. 1초 주기로 바뀌면서 블로킹 빈도도 5배. 계산이 무거워지면(열역학 + json.dumps × 954) `/health`·제어 API 응답 지연 및 `sleep(1)` 드리프트 가능.

### 🟠 P1 — 성능/효율 개선

**[P1-1] 포인트·장비·알람을 건건이 개별 MQTT 발행 (배치 없음)**
`engine.py:648 / 660 / 679`. 틱당 ~954회 `json.dumps` + `publish()`. 토픽 구조상 포인트별 토픽이 필요하지만, 스냅샷 묶음 토픽(예: `bees/points/_batch`) 병행 발행 또는 device state를 변화 시에만 발행(상태는 대부분 불변)하면 Server A/D 파싱 비용을 크게 줄일 수 있음.

**[P1-2] `has_comm_loss` 틱당 포인트별 2회 중복 호출**
`engine.py:613`(루프) + `engine.py:446`(`_generate_value` 내부). 각 호출이 `_target_index` 조회 후 `ActiveFault` 리스트 컴프리헨션 생성. 고장 0건(정상 상태)이 대부분인데도 670×2회 반복. 틱 시작 시 활성 고장 스냅샷을 한 번만 만들어 전달하면 됨.

**[P1-3] 기상 조건 틱당 중복 재계산**
`engine.py:412, 506-508, 530`. `weather.get_current_conditions(now)`가 ① 시나리오 max_ventilation 급기온 포인트마다 ② 성능저하 온도센서마다 ③ 모든 열역학 존마다 개별 호출됨. `now`는 틱 내 동일하므로 sin 연산이 중복. **틱당 1회 계산 후 공유**하면 됨.

**[P1-4] 알람 카테고리·시나리오 분류 매 틱·매 포인트 재계산**
`alarm_checker.py:_match_category`(선형 스캔)와 `engine.py:_apply_scenario_effects`의 `_strip_namespace`+`"CO2"/"Power"/... in class_name` 문자열 검사가 매 틱 모든 포인트에 대해 반복. 분류 결과는 불변 → 프로파일에 1회 캐시 가능.

### 🟡 P2 — 정합성/유지보수

**[P2-1] `stuck_damper` 고장이 실제로는 무효과 (미완성 기능)**
`fault_injection.py:240` `get_stuck_damper_position`는 정의되어 있으나 `engine._generate_value`에서 **호출되지 않음**. 즉 `stuck_damper` 주입은 API는 성공하지만 생성값에 아무 영향 없음. FAULT_TYPES·API 문서(`main.py:351`)에는 노출되어 사용자 오해 소지.

**[P2-2] 미사용 코드**
`weather.clear_temp_override`(미호출), `ScenarioManager`의 `outdoor_temp_range`/`hvac_mode`/`solar_factor` 프로퍼티(엔진이 `scenario.*` 직접 접근), Command 포인트 specs(`Valve_Command` 등)는 일반 센서로 처리됨.

**[P2-3] 부수효과를 가진 getter**
`fault_injection.py:222` `get_sensor_drift`가 조회 메서드 내부에서 `fault.drift_accumulated`를 누적 변경. 현재는 틱당 1회 호출이라 정상이나, 호출 위치가 늘면 이중 누적 위험. 누적은 틱 진행 단계로 분리 권장.

**[P2-4] 시작 시 INFO 로그 ~950줄 스팸**
`engine.py:309, 315`가 장비·프로파일 등록마다 INFO 로깅 → 284+670 ≈ 950줄이 StreamHandler+FileHandler 양쪽에 기록. 시작 지연 및 로그 가독성 저하. DEBUG로 강등 또는 요약 1줄.

**[P2-5] 사소한 재계산/하드코딩**
`thermodynamics.py:151` `window_area = 0.3·volume^(2/3)`를 매 스텝 재계산(존당 상수). `config.py`의 NEO4J/MQTT 기본값은 로컬 dev 전제(`AUTO_START_SIMULATION=True` 포함) — 운영 시 `.env` 의존 명확화 필요. `alarm_checker._suppression` 딕셔너리는 정리 로직 없음(포인트 수로 상한이 있어 실질 누수는 아님).

---

## 3. 최적화 방향 (이슈별 개선안 + 예상 효과)

| 이슈 | 개선안 | 예상 효과 |
|------|--------|-----------|
| **P0-1** | 의도 확인 후, 1초 유지가 필요하면 Server D 측 배치/주기 쓰기·다운샘플 정책 동반 적용. 표시 부드러움만 목적이면 프론트 보간으로 처리하고 발행은 2~5초 유지 | InfluxDB 쓰기·SSE·CPU **최대 5배 절감** 또는 통제된 증가 |
| **P0-2** | `DataProfile`에 `seasonal_amplitude`/`seasonal_phase_month`(및 분류 결과)를 **생성 시 1회 주입**, 핫 루프의 `_find_spec` 호출과 함수내 import 제거. import는 모듈 상단으로 이동 | 틱당 수만 회 문자열 비교 제거, 생성 루프 CPU 대폭 절감 |
| **P0-3** | 포인트를 N개 청크로 나눠 청크 사이에 `await asyncio.sleep(0)` 삽입, 또는 무거운 부분만 `run_in_executor` 위임 | 이벤트 루프 점유 완화, API 응답성·sleep 정확도 개선 |
| **P1-1** | device state는 **변화 시에만** 발행(대부분 불변). 선택적으로 포인트 스냅샷 묶음 토픽 병행 | 발행/파싱 건수 대폭 감소(상태 954→수십) |
| **P1-2** | 틱 시작 시 활성 고장/통신단절 집합을 1회 스냅샷 → 루프에 전달, `_generate_value` 내부 재조회 제거 | 정상 상태에서 틱당 1340회 중복 조회 제거 |
| **P1-3** | 틱당 `weather` 1회 계산 후 인자로 전달 | 중복 sin 연산 제거 |
| **P1-4** | 알람 카테고리·시나리오 분류를 프로파일에 캐시(enum/플래그) | 매 틱 선형 분류 제거 |
| **P2-1** | `_generate_value`의 Damper/Fan_Speed 계열 분기에서 `get_stuck_damper_position` 반영하거나, 미구현이면 FAULT_TYPES/문서에서 제거 | 기능-문서 정합성 확보 |
| **P2-2/3/4/5** | 미사용 코드 정리, getter 부수효과 분리, 등록 로그 DEBUG 강등, `window_area` 존 생성 시 1회 계산 | 유지보수성·시작 속도·가독성 개선 |

> 참고: drift/fault_drift는 `interval_seconds/3600` 기반이라 주기 변경에도 **물리적 시간당 변화율은 보존**됨 — P0-1 적용 시 드리프트 의미 손상 없음.

---

## 4. 리스크 / 주의사항

1. **P0-1은 단독 변경 금지** — 발행 주기는 Server A SSE 배치(0.5초)·Server D InfluxDB 쓰기·프론트 차트 갱신과 결합된 플랫폼 차원 파라미터. 변경 시 `_docs/history.md`·CLAUDE.md·MEMORY의 "5초 주기" 서술도 동기화해야 함.
2. **프로파일에 spec 필드 캐시(P0-2) 시** `DataProfile` dataclass 시그니처가 바뀌므로 `ahu_5f.py` 폴백 프로파일·`_inject_virtual_zone_points`의 수동 생성부도 함께 수정해야 함(기본값 부여로 하위호환 유지 권장).
3. **이벤트 루프 yield(P0-3)** 도입 시 한 틱 내 포인트들의 `now` 타임스탬프가 미세하게 달라질 수 있음 — 틱 시작 `now`를 고정 사용하면 무방.
4. **paho 크로스스레드 주의(MEMORY 교훈)** — 발행 자체는 스레드 안전하나, `_mqtt_connected` 플래그는 콜백 스레드에서 갱신됨. 배치/재연결 로직 추가 시 플래그 동기화 확인 필요.
5. **device state 변화-시-발행(P1-1)** 전환 시 Server A가 retained 메시지 없이 상태를 놓칠 수 있음 → 초기 1회 전체 발행 또는 `retain=True` 병행 필요.
6. 본 분석은 **코드 정독 기반 정적 분석**이며 실측 프로파일링(틱 소요 시간, 실제 msg/s)은 미수행 — P0/P1 적용 전 `tick` 처리시간 로깅으로 기준선 확보 권장.

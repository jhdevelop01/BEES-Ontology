# Server C (Emulator) 최적화 분석

> 대상: `platform/server-c` — 가상 건물 에뮬레이터 (FastAPI, 포트 8012)
> 분석 범위: `main.py`, `config.py`, `engine.py`, `thermodynamics.py`, `fault_injection.py`, `scenarios.py`, `alarm_checker.py`, `weather.py`, `neo4j_loader.py`, `profiles/*`
> 분석 기준: 시뮬레이션 루프 성능, 수치계산 벡터화, MQTT 직렬화/발행 비용, 메모리 할당, 동기/비동기 블로킹

---

## 1. 현행 구조 요약

- **싱글턴 엔진**: `main.py:46`에서 `EmulatorEngine()` 1개를 생성. FastAPI `lifespan`(`main.py:53-79`)에서 Neo4j 로딩 → `engine.start()`로 자동 기동(`AUTO_START_SIMULATION=True`, `config.py:24`).
- **부팅 시 1회 로딩**: `initialize_from_neo4j()`(`engine.py:142`)가 Neo4j에서 장비/포인트를 읽어 `_profiles`(`dict[point_id, DataProfile]`)와 `_devices`(`dict[device_id, DeviceState]`)를 채움. 실패 시 AHU_5F 폴백.
- **메인 루프**: `_simulation_loop()`(`engine.py:583-689`)가 `while self._running:` 안에서
  1. 모든 포인트(`self._profiles.items()`)를 순회하며 `_generate_value()`로 값 생성 → 포인트별 MQTT 발행 + 알람 체크,
  2. 모든 장비(`self._devices.items()`)를 순회하며 상태 발행,
  3. `await asyncio.sleep(SIMULATION_INTERVAL)`.
- **데이터 생성식**(`engine.py:426-522`): `value = base + scenario보정 + noise·rand + daily_pattern + equipment_effect + seasonal + drift + fault_drift + degraded + leak`. 바이너리/Setpoint/열역학(Zone_Air_Temperature_Sensor)은 분기 처리.
- **열역학**: `ThermalModel.step()`(`thermodynamics.py:114`)이 존 온도 센서마다 1차 에너지 밸런스 + PI 제어로 1스텝 적분.
- **MQTT**: paho-mqtt `loop_start()` 백그라운드 스레드(`engine.py:333`). 발행은 `_publish_mqtt()`(`engine.py:353`)로 포인트당 1건 + 장비당 1건 + 알람당 1건, 모두 `json.dumps` 개별 직렬화.
- **규모**: CLAUDE.md 기준 284장비 / 670포인트. 즉 매 틱당 최소 **~954건 MQTT 발행 + ~670회 값 생성**.

### ⚠️ 선결 사실: 실제 틱 주기는 5초가 아니라 **1초**
`config.py:23`의 기본값이 `SIMULATION_INTERVAL: float = 1.0`이며, `.env`·`docker-compose.yml` 어디에도 오버라이드가 **없음**(grep 확인). 문서(CLAUDE.md, history.md)는 "5초 주기"라고 기술하지만 실제 구동값은 1초다. 따라서 아래 모든 per-tick 비용은 **문서 가정 대비 5배 빈번**하게 발생한다. 이 자체가 의도와 실제의 불일치이며, 성능 분석의 전제로 가장 먼저 확인 필요.

---

## 2. 발견된 병목/이슈

### [B1] 핫 루프 안에서 `import` 실행 — `engine.py:485`
```python
from .profiles.profile_factory import _find_spec
spec = _find_spec(profile.brick_class)
```
`_generate_value()`는 매 틱 일반 센서마다 호출되고, 그 안에서 `import` 문을 실행한다. Python이 모듈을 캐시하더라도 `import` 문은 매번 import 시스템 조회 + 바인딩을 수행한다. 670포인트 × 1초 = **초당 ~수백 회 불필요한 import 평가**.
- **영향(중)**: CPU 낭비 + 가독성. 모듈 상단 1회 import로 제거 가능.

### [B2] `_find_spec()`를 매 틱 재계산 — `engine.py:485-491`, `profile_factory.py:313-335`
`_find_spec()`는 정확매칭 실패 시 `POINT_SPECS`(~30키)를 `endswith`/`in`으로 **선형 탐색**한다. 그런데 한 포인트의 `brick_class`는 **고정 불변**이므로 결과(spec, seasonal_amplitude, seasonal_phase_month)는 등록 시 한 번만 구하면 된다. 현재는 매 틱 매 포인트마다 최대 ~60회의 문자열 비교를 반복.
- **영향(대)**: 670포인트 × 1초 × 최대 60비교 ≈ **초당 4만 회 문자열 연산**. 등록 시점(`_register_profile`)에 spec/seasonal 값을 프로파일에 캐싱하면 루프에서 완전 제거.

### [B3] `has_comm_loss()` 이중 호출 — `engine.py:613` + `engine.py:446`
메인 루프(`613`)에서 통신단절을 검사해 분기하고, 그 후 호출하는 `_generate_value()`(`446`)에서 **동일 검사를 한 번 더** 수행한다. 정상(comm_loss 아님) 경로의 모든 포인트가 2회 스캔된다.
- **영향(소~중)**: `get_faults_for_target` dict 조회 + 리스트 생성이 670포인트 × 2회. 활성 고장 0건이어도 dict.get은 매번 발생.

### [B4] 포인트당 5종 FaultManager 조회 — `engine.py:446,450,497,502,511`
정상 센서 1개 생성에 `has_comm_loss`, `get_sensor_stuck_value`, `get_sensor_drift`, `get_capacity_reduction`, `get_valve_leak`가 각각 호출되고, 모두 내부에서 `get_faults_for_target()`(`fault_injection.py:197`)로 **새 리스트를 생성**한다. 활성 고장이 0건인 일반 상황에서도 670 × 5 = **초당 ~3,350회의 dict.get + 리스트 할당**.
- **영향(중)**: `FaultManager.active_count == 0`일 때 전체 스킵하는 fast-path가 없음. `_target_index`에 해당 타깃이 없으면 즉시 0/None 반환하도록 가드 추가 권장.

### [B5] `logger.debug` f-string이 레벨과 무관하게 매번 평가 — `engine.py:359`
```python
logger.debug(f"MQTT 발행: {topic} → {msg[:100]}")
```
`_publish_mqtt()`는 발행마다 호출되며, f-string과 `msg[:100]` 슬라이스는 **로깅 레벨이 INFO여도(=debug 비활성) 항상 평가**된다(인자 평가가 호출보다 먼저 일어남). 틱당 ~954건 발행 → **초당 ~954회 불필요한 문자열 포맷+슬라이스**.
- **영향(중)**: `if logger.isEnabledFor(logging.DEBUG):` 가드 또는 lazy `%s` 포맷(`logger.debug("MQTT 발행: %s → %s", topic, msg[:100])`)으로 제거.

### [B6] `now.isoformat()` 틱당 ~954회 재계산 — `engine.py:617,639,669,676`
`now`는 틱당 고정인데 페이로드를 만들 때마다(`points` 670 + `devices` 284) `now.isoformat()`를 호출한다. 동일 문자열을 954회 생성.
- **영향(소)**: 루프 진입 시 `ts_iso = now.isoformat()` 1회 계산 후 재사용.

### [B7] `WeatherProvider.get_current_conditions()`의 틱 내 중복 계산 — `engine.py:412,506,530`, `weather.py:73`
기상 조건은 `now` 기준 동일한데, 열역학 모델 스텝마다(`_generate_thermal_value`, 존 센서 수만큼) + 성능저하/밸브누설 효과 경로(`engine.py:506,511`)마다 + `max_ventilation` 급기온 경로(`engine.py:412`)마다 매번 재호출되어 `math.sin` 3회 + dict 조회를 반복한다. 또한 `engine.py:412`의 호출은 `now` 인자 없이 호출되어 **내부에서 `datetime.now()`를 다시** 부른다(틱 시각과 미세 불일치).
- **영향(소~중)**: 틱 시작 시 weather 1회 계산 → 캐시하여 전 포인트가 공유. 존 센서가 많을수록 절감 커짐.

### [B8] 포인트별 개별 MQTT 발행 + 개별 `json.dumps` — `engine.py:357,648,660,679`
틱당 670(points) + 284(devices) + 알람 N건을 **각각** `json.dumps(ensure_ascii=False)` 후 개별 `publish()`. 직렬화 호출 ~954회 + 브로커 publish ~954회/틱.
- **영향(중)**: 직렬화/소켓 큐잉 오버헤드. 단 토픽 구조(`bees/points/{point_id}`)를 Server A가 구독 중이므로 배칭은 **Server A 동시 변경**이 필요 → P2(아키텍처 변경). 단기적으로는 `ensure_ascii=False` 유지 시 한글 없음에도 escape 검사 비용은 미미하므로 우선순위 낮음.

### [B9] 메인 루프 전체가 이벤트 루프 스레드를 동기 점유 — `engine.py:595-689`
670포인트 생성 + 954발행이 `await` 없이 동기로 실행된 뒤에야 `asyncio.sleep`에 도달한다. 이 구간 동안 FastAPI의 다른 API 요청(`/devices`, `/simulation/status` 등)이 블로킹된다. 1초 주기에서 생성 비용이 커지면 응답 지연/주기 드리프트로 직결.
- **영향(중)**: B1~B7 제거로 구간 단축이 1차 대응. 구조적으로는 무거워질 경우 `run_in_executor`로 생성부를 분리하거나 중간 `await asyncio.sleep(0)` yield 고려.

### [B10] 루프 주기 드리프트 — `engine.py:689`
`작업 수행 → sleep(INTERVAL)` 패턴이라 실제 주기 = `INTERVAL + 작업시간`. 항상 의도보다 느리게 발행되며 시각 누적 오차 발생.
- **영향(소)**: 다음 틱 목표시각 기반 보정(`sleep(max(0, INTERVAL - elapsed))`)으로 정밀화.

### [B11] `_apply_scenario_effects`에서 `_strip_namespace` 중복 + 매 틱 문자열 분기 — `engine.py:386-424`
`_generate_value`(`443`)와 `_apply_scenario_effects`(`388`)가 **같은 brick_class를 두 번 strip**하고, 후자는 매 틱 `"CO2" in`, `"Power" in`, `"Supply_Air_Temperature" in`, `"Fan_Speed" in` 등 다중 substring 검사를 수행한다. 포인트 카테고리는 고정이므로 등록 시 1회 분류 가능.
- **영향(소~중)**: B2의 spec 캐싱과 함께 "포인트 카테고리/strip된 class_name"을 프로파일에 캐싱하면 중복 strip + 반복 substring 검사 제거.

### [B12] 벡터화 미적용 — 순수 파이썬 스칼라 루프 — `engine.py:426-522`
일반 센서 경로는 포인트마다 `random.uniform`, `math.sin`(daily/seasonal)을 스칼라로 호출한다. numpy 미사용(requirements에 없음). 분기(바이너리/Setpoint/열역학/고장)가 많아 전면 벡터화는 어렵지만, "일반 센서" 집합에 대해 base/noise/amplitude를 배열로 미리 적재해두면 `noise`, `daily`, `seasonal`을 배치 연산할 여지가 있다.
- **영향(중, 단 Effort 높음)**: 670 규모에서 순수 파이썬도 1초 내 충분하나, 주기 단축(예: 0.5초)·포인트 증가 시 이득. P2.

### [B13] `_latest_values` 매 틱 새 dict 할당 — `engine.py:621,636,644`
포인트당 새 payload dict를 만들어 `_latest_values[point_id]`에 통째 교체. 670개 dict/틱 신규 할당 → GC 압박(작지만 1초 주기 누적).
- **영향(소)**: 기존 dict in-place 갱신으로 할당 감소 가능. 단 MQTT payload와 캐시를 공유하므로 주의.

---

## 3. 최적화 권고

### P0 (즉시·저위험·고효과)
- **[P0-1] `_find_spec`/seasonal/strip된 class_name/카테고리를 등록 시 캐싱** → B2·B11 해소. `_register_profile`(`engine.py:311`) 또는 `DataProfile` 확장 필드에 `_spec`, `_seasonal_amp`, `_seasonal_phase`, `_class_name`, `_scenario_category`를 1회 저장하고 루프는 읽기만. **루프 핫패스에서 가장 큰 CPU 절감.**
- **[P0-2] 핫 루프 `import` 제거** → B1. `_find_spec`를 `engine.py` 상단에서 import.
- **[P0-3] `logger.debug` lazy 포맷/가드** → B5. `_publish_mqtt`의 f-string 제거.
- **[P0-4] `now.isoformat()` 틱당 1회** → B6. 루프 진입 시 `ts_iso` 1회 계산.
- **[P0-5] FaultManager fast-path** → B3·B4. `_simulation_loop` 진입 시 `faults_active = self.fault_manager.active_count > 0` 1회 계산, 0이면 모든 고장 조회 분기를 스킵. `_generate_value` 내 `has_comm_loss` 중복 호출 제거(루프에서 이미 검사한 결과 전달).
- **[P0-6] 틱당 weather 1회 캐싱** → B7. 루프 시작 시 `weather = weather_provider.get_current_conditions(now)` 계산 후 `_generate_value`/`_generate_thermal_value`에 전달. `engine.py:412`의 인자 없는 호출도 `now` 전달로 교정.

### P1 (중위험·중효과)
- **[P1-1] 루프 주기 드리프트 보정** → B10. 목표시각 기반 `sleep`.
- **[P1-2] 이벤트 루프 블로킹 완화** → B9. P0 적용 후에도 구간이 길면 생성부를 `loop.run_in_executor`로 분리하거나 청크 단위 `await asyncio.sleep(0)` 삽입.
- **[P1-3] `SIMULATION_INTERVAL` 실제값 정합** → 선결 사실. 1초 의도면 문서 수정, 5초 의도면 `.env`/`config.py`에 명시. 주기 결정은 위 모든 비용에 5배 차이를 만들므로 **가장 먼저 합의 필요**.

### P2 (고Effort·조건부효과)
- **[P2-1] numpy 벡터화** → B12. 일반 센서 집합의 noise/daily/seasonal 배치 계산. 포인트 수 증가 또는 주기 단축 시에만 비용 대비 효과.
- **[P2-2] MQTT 배치 발행** → B8. 토픽 통합(예: `bees/points/batch`) — **Server A 구독 로직 동시 변경 필수**. 단독 적용 불가.
- **[P2-3] payload dict 재사용** → B13. in-place 갱신. 캐시/발행 payload 공유 주의.

---

## 4. Impact × Effort 랭킹

| 순위 | 항목 | Impact | Effort | 우선순위 | 근거(file:line) |
|:---:|------|:---:|:---:|:---:|------|
| 1 | [P0-1] spec/seasonal/class_name 등록 시 캐싱 | 높음 | 낮음 | P0 | engine.py:485-491, profile_factory.py:313-335 |
| 2 | [P0-5] FaultManager fast-path + 중복 호출 제거 | 중 | 낮음 | P0 | engine.py:446·613, fault_injection.py:197 |
| 3 | [P0-3] logger.debug lazy 포맷 | 중 | 낮음 | P0 | engine.py:359 |
| 4 | [P0-2] 핫 루프 import 제거 | 중 | 낮음 | P0 | engine.py:485 |
| 5 | [P1-3] SIMULATION_INTERVAL 정합(1s vs 5s) | 높음 | 낮음 | P1 | config.py:23, .env(없음) |
| 6 | [P0-6] weather 틱당 1회 캐싱 | 중 | 낮음 | P0 | engine.py:412·506·530, weather.py:73 |
| 7 | [P0-4] now.isoformat() 1회화 | 낮음 | 낮음 | P0 | engine.py:617·639·669·676 |
| 8 | [P1-2] 이벤트 루프 블로킹 완화 | 중 | 중 | P1 | engine.py:595-689 |
| 9 | [P1-1] 루프 주기 드리프트 보정 | 낮음 | 낮음 | P1 | engine.py:689 |
| 10 | [P2-2] MQTT 배치 발행(Server A 동반) | 중 | 높음 | P2 | engine.py:357·648·660 |
| 11 | [P2-1] numpy 벡터화 | 중 | 높음 | P2 | engine.py:426-522 |
| 12 | [P2-3] payload dict 재사용 | 낮음 | 중 | P2 | engine.py:621·636·644 |

> **종합**: 현 670포인트/1초 규모에서 순수 파이썬으로도 기능상 동작하나, 핫 루프에 **틱당 수만 회의 불필요한 문자열 연산(B2)·이중 고장조회(B3/B4)·항상 평가되는 debug 포맷(B5)**이 누적된다. P0 6건은 모두 **저위험·소규모 수정**으로 루프 CPU를 크게 줄이며, 동작/출력은 불변(순수 내부 최적화)이다. 벡터화·MQTT 배칭(P2)은 규모 확장 또는 주기 단축이 결정된 뒤 착수 권장. 그 전에 **실제 주기가 1초인지 5초인지(P1-3)부터 합의**하는 것이 모든 비용 산정의 전제다.

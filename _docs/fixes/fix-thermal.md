# Fix: Server C `thermal_models=0` 문제 수정

## 증상
Server C 시뮬레이션 상태(`get_status()`)에서 `thermal_models`가 **0**으로 보고됨.
가상 Zone 온도 포인트(`Zone_Air_Temperature_Sensor`)가 열역학 모델(`ThermalModel`)로 시뮬레이션되지 않고,
일반 센서 공식(`base_value + noise + ...`)으로 대체 생성되고 있었음.

## 근본 원인
`platform/server-c/app/engine.py`의 `_inject_virtual_zone_points()`(약 229행)가
가상 Zone 온도 포인트를 `DataProfile`로만 등록(`_register_profile`)하고 **`ThermalModel`을 생성하지 않았음**.

- Neo4j 로딩 경로(engine.py 약 196~201행)에는 `Zone_Air_Temperature_Sensor` → `ThermalModel` 생성 로직이 있으나,
  이 경로는 가상 Zone(B4F~3F, 1F 등 공조 온도 센서 미정의 층)에는 도달하지 않음.
- 결과적으로 실제 Neo4j에 `Zone_Air_Temperature_Sensor`가 없으면 `_thermal_models`는 비어 있음 → `thermal_models=0`.
- 런타임 영향: `_generate_value()`의 조건
  `class_name == _ZONE_TEMP_CLASS and profile.point_id in self._thermal_models`가 False가 되어,
  가상 Zone 온도가 열역학 모델이 아닌 일반 센서 공식으로 생성됨.

## 변경 내용
파일: `platform/server-c/app/engine.py`
위치: `_inject_virtual_zone_points()` 내 `Zone_Temp_{floor}` 등록 블록
(수정 후 기준 **약 258~272행** — `self._register_profile(temp_profile); count += 1` 직후)

가상 Zone **온도 포인트에만** `ThermalModel`을 생성해 `self._thermal_models[temp_id]`에 등록.
(습도 `Zone_Humidity_*`, CO2 `Zone_CO2_*` 포인트는 대상 아님 — 요구 범위대로 온도만.)

```python
self._register_profile(temp_profile)
count += 1

# Phase 4: 가상 Zone 온도 포인트에도 열역학 모델 초기화
# (Neo4j 경로 engine.py:196~201과 동일 — 온도 포인트에만 적용)
# zone_id는 층 노드로 지정해 _guess_zone_type이 층 유형(기계실/로비/사무)을 추정,
# initial_temp는 층별 base_temp로 시작 (주차장 18°C, 로비 22°C 등)
if temp_id not in self._thermal_models:
    zone_id = f"bldg:Floor_{floor_code}"
    self._thermal_models[temp_id] = ThermalModel(
        zone_id=zone_id, initial_temp=base_temp
    )
    logger.debug(
        f"열역학 모델 초기화(가상 Zone): {temp_id} (zone: {zone_id})"
    )
```

### 설계 선택 (Neo4j 경로와의 차이 및 근거)
- **`zone_id = f"bldg:Floor_{floor_code}"`**: Neo4j 경로는 `loc_id`를 사용하나 가상 Zone엔 로케이션이 없음.
  층 노드를 zone_id로 넘기면 `thermodynamics._guess_zone_type()`이 층 유형(기계실/로비/사무)을 추정해
  적절한 열역학 파라미터(`_ZONE_DEFAULTS`)를 선택.
- **`initial_temp = base_temp`**: Neo4j 경로는 고정 24.0을 쓰지만, 가상 층은 base_temp가 층마다 다름
  (주차장 B4F=18°C, 로비 1F=22°C 등). 각 층의 base_temp에서 시작하는 것이 물리적으로 자연스러움.
  (참고: `start()` 호출 시 `model.reset()`은 24.0으로 리셋되므로, 초기 로딩~시작 전 상태에만 영향.)
- **`if temp_id not in self._thermal_models`**: 프로파일 중복 방지(`if temp_id not in self._profiles`)와 동일하게
  멱등성 확보.

## 대상 층 및 예상 결과
`_VIRTUAL_FLOORS`는 **7개 층**: B4F, B3F, B2F, B1F, 1F, 2F, 3F.
각 층당 온도 포인트 1개 → **예상 `thermal_models` = 기존 Neo4j 로딩분 + 7**.
Neo4j에 실제 `Zone_Air_Temperature_Sensor`가 없다면(현재 `thermal_models=0` 보고와 일치) → **정확히 7개**.

## 검증
- `python3 -m py_compile platform/server-c/app/engine.py` → **통과 (PY_COMPILE_OK)**

## 범위 준수 / 미변경
- `neo4j_loader.py` 및 다른 로딩 로직 미변경.
- 다른 서버(A/B/D) 파일 미변경.
- git 커밋 / docker 재기동·재빌드 수행하지 않음 (실제 `thermal_models` 수치 확인은 Server C 재기동 후 필요).

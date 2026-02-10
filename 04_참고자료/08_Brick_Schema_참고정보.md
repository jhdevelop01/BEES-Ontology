# Brick Schema 온톨로지 - 참고 정보

## Brick Schema 개요

| 항목 | 내용 |
|------|------|
| 정의 | 건물의 물리적, 논리적, 가상 자산 및 그 관계를 표준화하는 오픈소스 시맨틱 메타데이터 스키마 |
| 공식 사이트 | https://brickschema.org/ |
| GitHub | https://github.com/BrickSchema |
| 문서 | https://docs.brickschema.org/intro.html |
| 표현 형식 | RDF (Resource Description Framework) 기반 |

## Brick Schema 핵심 개념

### 주요 클래스 (Class)

| 클래스 | 설명 | GEC B동 적용 예시 |
|--------|------|-------------------|
| **Location** | 건물 내 물리적 위치 | Building, Floor, Room, Zone |
| **Equipment** | 설비/장비 | AHU, Chiller, Boiler, VAV, FCU, Pump |
| **Point** | 센서/제어 포인트 | Temperature Sensor, Humidity Sensor, Damper Command |
| **System** | 시스템 그룹 | HVAC System, Lighting System, Fire Alarm System |

### 주요 관계 (Relationship)

| 관계 | 설명 | 예시 |
|------|------|------|
| `brick:hasLocation` | 위치 관계 | AHU → Floor |
| `brick:isPartOf` | 구성 관계 | Room → Floor |
| `brick:feeds` | 공급 관계 | AHU → VAV |
| `brick:hasPoint` | 포인트 관계 | AHU → Temperature Sensor |
| `brick:isFedBy` | 수급 관계 | VAV → AHU |

## GEC B동에 적용할 Brick Schema 구조 (리서치 반영)

### Location 계층

```
Site: Samsung_GEC
  ├── Building: GEC_Tower_A (17층, 삼성E&A)
  ├── Building: GEC_Tower_B (14층, 삼성물산 건설부문)
  │     ├── Floor: B4F (지하4층, 공통)
  │     ├── Floor: B3F (지하3층, 공통)
  │     ├── Floor: B2F (지하2층, 공통)
  │     ├── Floor: B1F (지하1층, 공통)
  │     ├── Floor: 1F (포디움)
  │     ├── Floor: 2F (포디움)
  │     ├── Floor: 3F (포디움)
  │     ├── Floor: 5F (오피스) ※ 4층 없음
  │     ├── Floor: 6F ~ 12F (오피스)
  │     ├── Floor: 14F (오피스) ※ 13층 없음
  │     └── Floor: RF (옥상, 옥상녹화)
  │           └── Room / Zone (각 층별)
  ├── Building: GEC_Tower_C (8층, R&D Building, 삼성E&A, LEED Gold)
  └── Structure: Podium (3층, 회의실/식당/박물관)
        └── Bridge (동 간 연결통로)
```

### Equipment 계층 (3차 리서치 보강 - 학술논문 기반)

```
HVAC_System
  ├── Chiller_Plant
  │     ├── Chiller_1, Chiller_2, ... (대수/용량 미확인)
  │     ├── Chilled_Water_Pump_1, ... (Variable_Speed_Pump, 변유량 제어 [논문 4-1])
  │     ├── Condenser_Water_Pump_1, ... (대수 미확인)
  │     └── Cooling_Tower_1, ... (대수 미확인)
  ├── Boiler_Plant
  │     ├── Boiler_1, Boiler_2, ... (대수/용량 미확인)
  │     └── Hot_Water_Pump_1, ... (대수 미확인)
  ├── UFAD_System (가압식 바닥공조)
  │     ├── AHU_UFAD_1, ... (외기조화기/OAU 포함)
  │     ├── Pressure_Controller_1, ... (플레넘 압력 제어 [논문 2-1])
  │     └── Floor_Diffuser_Zone
  │           ├── Interior_Zone_Diffuser (내주부 디퓨저)
  │           └── Perimeter_Zone_Diffuser (외주부 디퓨저, 방위별 [논문 3-2])
  ├── Chilled_Ceiling_System (칠드실링 복사냉방, 16°C 냉수)
  │     ├── Chilled_Ceiling_Panel_Zone_1, ... (구리배관 내장)
  │     ├── Distribution_Header_1, ... (분배기 [특허 4-2])
  │     └── Three_Way_Valve_CC_1, ... (냉수 3방밸브 [논문 4-1])
  ├── Radiant_Heating_System (복사난방)
  │     ├── Radiant_Panel_Zone_1, ...
  │     ├── Distribution_Header_RH_1, ... (분배기 [특허 4-2])
  │     └── Three_Way_Valve_RH_1, ... (온수 3방밸브)
  ├── Double_Skin_Facade_System (서향 이중외피)
  │     └── DSF_West_1, ... (야간냉각/자연환기)
  └── Night_Purge_System (야간 외기냉방 [논문 2-5])
        └── Night_Purge_Damper_1, ...

Lighting_System
  ├── Light_Shelf_System (가변형 외부 라이트셀프)
  │     └── Tunable_Light_Shelf_1, ...
  └── Interior_Lighting_Zone_1, ...

Building_Automation_System (자동화 디지털 네트워크)
  └── Controller_1, ... (DDC, 제조사 미확인)
```

### Point 계층 (3차 리서치 보강 - 학술논문/특허 기반)

```
Sensors - UFAD
  ├── Zone_Temperature_Sensor (거주역/비거주역 구분 [논문 3-1])
  ├── Zone_Humidity_Sensor
  ├── Zone_CO2_Sensor (DCV 환기량 제어)
  ├── Supply_Air_Temperature_Sensor (급기 18~20°C [논문 3-1])
  ├── Return_Air_Temperature_Sensor (성층화 모니터링)
  ├── Duct_Static_Pressure_Sensor (★ 가압식 핵심 [논문 2-1])
  ├── Slab_Temperature_Sensor (야간축냉 효과 [논문 2-5])
  └── Diffuser_Airflow_Sensor (디퓨저별 풍량 [논문 3-2])

Sensors - 칠드실링/복사냉방
  ├── Chilled_Water_Supply_Temperature_Sensor (16°C [논문 4-1])
  ├── Chilled_Water_Return_Temperature_Sensor
  ├── Chilled_Water_Flow_Sensor (변유량 [논문 4-1])
  ├── Hot_Water_Supply_Temperature_Sensor (복사난방)
  ├── Hot_Water_Return_Temperature_Sensor
  ├── Dew_Point_Temperature_Sensor (★ 결로방지 핵심 [특허 4-2])
  ├── Condensation_Sensor (결로 위험 감지 [특허 4-2])
  └── Inside_Face_Surface_Temperature_Sensor (패널 표면온도 [논문 4-1])

Sensors - 외기/공통
  ├── Outdoor_Air_Temperature_Sensor (외기리셋, Night Purge [논문 2-5])
  ├── Outdoor_Air_Humidity_Sensor
  ├── Solar_Radiation_Sensor (일사량 - 자동제어/라이트셀프 연계)
  ├── Occupancy_Sensor (재실감지, LEED IEQ 연계)
  └── Illuminance_Sensor (조도, LEED IEQc8 연계)

Commands / Setpoints
  ├── Zone_Temperature_Setpoint
  ├── Pressure_Setpoint (플레넘 압력 설정값 [논문 2-1])
  ├── Supply_Air_Temperature_Setpoint (급기온도 설정값)
  ├── Chilled_Water_Temperature_Setpoint (칠드실링 냉수 설정값)
  ├── Damper_Position_Command (UFAD/Night Purge)
  ├── Valve_Position_Command (3방밸브 - 칠드실링/복사난방)
  ├── Fan_Speed_Command (VFD 기반)
  ├── Pump_Speed_Command (변속펌프)
  ├── Light_Shelf_Angle_Command (라이트셀프 각도)
  └── DSF_Vent_Command (이중외피 환기)

Energy Monitoring
  ├── Energy_Cost_Sensor (시장 에너지 비용)
  ├── Building_Power_Meter (건물 전체 전력)
  ├── Zone_Energy_Meter (존별 에너지)
  └── Primary_Energy_Baseline (287.4 kWh/m2, 에너지효율 1등급)
```

## Brick Schema + RealEstateCore 통합 동향

- 2025년 BIM World Copenhagen에서 Brick Schema와 RealEstateCore 간 주요 통합(Harmonization) 발표
- HVAC 장비 및 센서: Brick Schema로 모델링
- 건물 위치, 임대, 부동산 관련: RealEstateCore로 모델링
- 두 표준 간 중복 영역 식별 및 통합 작업 진행 중

## 출처

- Brick Schema 공식사이트 (https://brickschema.org/)
- Brick Schema 문서 (https://docs.brickschema.org/intro.html)
- Brick Schema GitHub (https://github.com/BrickSchema)
- RealEstateCore + Brick 통합 발표 (https://www.realestatecore.io/brickrec/)

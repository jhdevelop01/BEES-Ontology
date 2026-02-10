# 삼성물산 GEC B동 - HVAC / 공조 시스템

## 공조 시스템 개요 (HOK 설계 기준)

GEC 건물은 HOK의 설계에 따라 **3중 복합 공조 시스템**을 적용한 고효율 지속가능 건물임.

## 환기 방식 - 가압식 바닥공조 (UFAD)

| 항목 | 내용 |
|------|------|
| 방식 | 가압식 바닥공조 (Pressurized Cavity Floor / Underfloor Air Distribution, UFAD) |
| 설명 | 이중바닥(Access Floor) 하부 공간을 가압하여 바닥 디퓨저를 통해 신선 외기를 공급 |
| 특징 | 거주역(Occupied Zone) 중심의 효율적 환기, 온도 성층화(Temperature Stratification) 구현 |
| 효율 | 일반 천장공조 대비 환기효율 약 **20% 이상** 향상 (ASHRAE 기준) |
| 제어 | 구역별 온도센서를 통한 가변풍량 제어로 에너지 낭비 절감 |

## 냉방 방식 - 칠드 실링 (Chilled Ceiling)

| 항목 | 내용 |
|------|------|
| 방식 | 칠드 실링 시스템 (Chilled Ceiling System) |
| 원리 | 천장 패널에 **구리 배관(Copper Pipes)**을 내장하여 냉수를 순환, 복사 냉방(Radiant Cooling) |
| 냉수 온도 | 약 **16°C** (삼성물산 건설부문 기술 기준, 일반 범위 15~17°C) |
| 비교 | 기존 HVAC 냉수(5~7°C) 대비 높은 온도 사용 → 칠러 COP 향상, 에너지 절감 |
| 특징 | 대류 방식 대비 쾌적성 향상, 소음 최소화, 결로 방지 고려 설계 |

## 난방 방식 - 복사난방 (Radiant Heating)

| 항목 | 내용 |
|------|------|
| 방식 | 복사난방 시스템 (Radiant Heating System) |
| 원리 | 천장/바닥 패널을 통한 복사열 난방, 온수 순환 |
| 특징 | 에너지 절감 효과, 균일한 실내 온도 분포, 쾌적한 열환경 제공 |

## 외피 시스템 - 이중외피 (Double-Skin Facade)

| 항목 | 내용 |
|------|------|
| 적용 위치 | **서향(西向) 입면** |
| 구성 | 외측외피 (풍우 차단) + 내측외피 (창문 개폐 가능) |
| 여름 | 야간 냉각(Night Cooling)을 통한 냉방부하 절감 |
| 겨울 | 이중외피 사이 공기층 단열 + 태양열 축열 → 난방에너지 절감 |
| 자연환기 | 내측 창문 개폐를 통한 자연환기 가능 |

## 조명 연계 - 가변형 외부 라이트셀프

| 항목 | 내용 |
|------|------|
| 시스템 | 가변형 외부 라이트셀프 (Tunable External Light Shelf) |
| 기능 | 일조량 수확(Daylight Harvesting) |
| 여름 | 태양열 획득(Solar Heat Gain) 저감 |
| 겨울 | 태양 복사열 최대화 |

## 자동제어 시스템

| 항목 | 내용 |
|------|------|
| 시스템명 | 자동화 디지털 네트워크 시스템 (Automated Digital Network System) |
| 모니터링 대상 - 실외 | 기상 조건 (외기 온도, 습도, 일사량 등) |
| 모니터링 대상 - 실내 | 환경 조건 (온도, 습도, CO2 등) |
| 모니터링 대상 - 에너지 | 시장 에너지 비용 |
| 제어 방식 | 연속적 자동 조정 (Continuous Adjustment) |
| 목표 | 건물 효율 최대화 + 에너지 소비 최소화 |

## 에너지 성능

| 항목 | 수치 |
|------|------|
| 에너지효율등급 | **1등급** |
| 1차 에너지 소요량 | **287.4 kWh/m²** |
| 에너지 절감 추정 | 약 **40%** (HOK 설계 기준, 일반 건물 대비) |

## 시스템 통합 구조

```
[외기 센서] ──┐
[실내 센서] ──┼──> [자동화 디지털 네트워크 시스템] ──> [HVAC 장비 제어]
[에너지 비용] ─┘          │
                          ├──> 가압바닥공조 (UFAD) 제어
                          ├──> 칠드실링 복사냉방 제어 (16°C 냉수)
                          ├──> 복사난방 제어
                          ├──> 이중외피 제어 (서향)
                          └──> 라이트셀프 제어
```

## 센서/제어 포인트 상세 (학술논문 기반 추론, 3차 리서치)

### UFAD 시스템 센서/제어

| 센서/제어 포인트 | Brick Class | 근거 |
|----------------|-------------|------|
| 바닥플레넘 정압 센서 | `Duct_Static_Pressure_Sensor` | 가압식 UFAD 핵심 제어 포인트 [논문 2-1] |
| 급기온도 센서 | `Supply_Air_Temperature_Sensor` | 급기 18~20°C 범위 [논문 3-1] |
| 환기온도 센서 | `Return_Air_Temperature_Sensor` | 성층화 모니터링 [논문 3-1] |
| 급기팬 속도 명령 | `Fan_Speed_Command` | VFD 기반 풍량 제어 |
| 플레넘 압력 설정값 | `Pressure_Setpoint` | 압력 제어 기준 [논문 2-1] |

### 칠드실링 시스템 센서/제어

| 센서/제어 포인트 | Brick Class | 근거 |
|----------------|-------------|------|
| 냉수 공급온도 센서 | `Chilled_Water_Supply_Temperature_Sensor` | 16°C 제어 [논문 4-1] |
| 냉수 환수온도 센서 | `Chilled_Water_Return_Temperature_Sensor` | 환수 모니터링 |
| 냉수 유량 센서 | `Chilled_Water_Flow_Sensor` | 변유량 제어 [논문 4-1] |
| 노점온도 센서 | `Dew_Point_Temperature_Sensor` | **결로방지 인터록** [특허 4-2] |
| 결로방지 센서 | `Condensation_Sensor` (커스텀) | 결로 위험 위치 감지 [특허 4-2] |
| 표면온도 센서 | `Inside_Face_Surface_Temperature_Sensor` | 복사패널 표면온도 [논문 4-1] |
| 3방밸브 명령 | `Valve_Position_Command` | 냉수 유량/온도 제어 |

### 복사난방 시스템 센서/제어

| 센서/제어 포인트 | Brick Class | 근거 |
|----------------|-------------|------|
| 온수 공급온도 센서 | `Hot_Water_Supply_Temperature_Sensor` | 온수 제어 |
| 온수 환수온도 센서 | `Hot_Water_Return_Temperature_Sensor` | 환수 모니터링 |
| 3방밸브 명령 | `Valve_Position_Command` | 온수 유량 제어 [특허 4-2] |

### 제어 시퀀스 (학술논문 기반)

| 시퀀스 | 센서 → 제어 흐름 |
|--------|----------------|
| UFAD 플레넘 압력 제어 | `Duct_Static_Pressure_Sensor` → PID → `Fan_Speed_Command` |
| 칠드실링 냉수온도 제어 | `Outdoor_Air_Temp` (외기리셋) + `Zone_Temp` → `Valve_Command` |
| 결로방지 인터록 | `Dew_Point_Temp_Sensor` 감시 → 냉수밸브 차단/유량 조절 |
| 야간 외기냉방 | `Outdoor_Air_Temp` 조건 → `Damper_Command` 개방 → 슬래브 축냉 |
| 온도 성층화 제어 | `Supply_Air_Temp`/`Fan_Speed` → 거주역/비거주역 온도차 관리 |

> **상세**: `10_학술논문_기술참고.md` 참조

## 미확보 정보 (Brick Schema 구축에 필요)

- [ ] AHU (공기조화기) 대수, 용량, 모델
- [ ] 외기조화기 (OAU/DOAS) 유무, 대수, 풍량
- [ ] 칠러 (Chiller) 대수, 용량, 종류 (흡수식/원심식 등)
- [ ] 보일러 대수, 용량, 연료 종류
- [ ] 냉각탑 (Cooling Tower) 대수, 용량
- [ ] 히트펌프 유무 및 사양
- [ ] 펌프 종류별 대수 및 용량 (냉수, 온수, 냉각수)
- [ ] VAV (가변풍량 유닛) 또는 FCU (팬코일 유닛) 구성
- [ ] 바닥 디퓨저 종류, 배치 및 수량
- [ ] 덕트 계통도 (Ductwork Layout)
- [ ] 배관 계통도 (Piping Layout)
- [ ] 센서 포인트 리스트 (온도, 습도, CO2, 압력, 유량 등)
- [ ] BMS/BAS 컨트롤러 구성
- [ ] 칠드실링용/UFAD용 냉수 이원 공급 시스템 여부

## 출처

- Architizer - Samsung GEC by HOK (https://architizer.com/projects/samsung-gec-research-development-center/)
- 라펜트 매거진 (https://www.lafent.com/magazine/atc_view.html?news_id=6459&gbn=02)
- 건축도시정책정보센터 AURUM (https://www.aurum.re.kr/Bits/BuildingDoc.aspx?mm=4&ss=1&num=2451)
- Samsung C&T Newsroom - Green Construction (https://news.samsungcnt.com/en/features/engineering-construction/2021-11-samsung-ct-ec-steps-efforts-green-construction/)
- KHARN칸 - 복사냉난방 기술 (https://www.kharn.kr/news/article.html?no=3556)
- KHARN칸 - 바닥공조시스템 (https://www.kharn.kr/mobile/article.html?no=6760)

# BEES Ontology 프로젝트 히스토리

> **최종 업데이트:** 2026.02.20 (온톨로지 Neo4j Bloom 스타일, 토폴로지 건물 단면도 3× 스케일업)
> **목적:** `/clear` 후에도 작업을 이어갈 수 있도록 전체 프로젝트 맥락을 보존

---

## 1. 프로젝트 개요

### 목표
삼성물산 GEC(Green Energy Center) **B동**에 대한 **Brick Schema 기반 건물 온톨로지**를 구축한다.
스마트빌딩 데이터 통합 플랫폼 "BEES"를 위한 시맨틱 모델링이 궁극적 목적이다.

### 범위 (중요)
- **삼성물산 GEC B동(Tower B)에만 한정**
- GEC 사이트(Samsung_GEC)는 최소 컨텍스트(상위 Site 노드)로만 유지
- Tower A, Tower C, Podium, 전사(삼성E&A/삼성물산) ESG 데이터는 범위 밖
- HQ=GEC 본사 GHG 데이터는 유지 (B동 포함, 가장 근접한 확인 데이터)

### 건물 정보 요약
| 항목 | 내용 |
|------|------|
| 건물명 | 삼성물산 GEC B동 (Green Energy Center Tower B) |
| 위치 | 서울 강동구 상일로 6길 26 |
| 준공년도 | 2011 |
| 층수 | B4~15F (지상15층, 지하4층) |
| 연면적(B동) | ~60,000 m² (추정) |
| 주용도 | 업무시설 (오피스) |
| 소유/운영 | 삼성물산 (삼성E&A 사옥) |
| 설계 | HOK (해외), SAMOO (국내) |
| 시공 | 삼성물산 건설부문 |
| 인증 | LEED NC v2.2 Gold (45/69), G-SEED 최우수등급 |
| 핵심기술 | UFAD + Chilled Ceiling + Radiant Heating, DSF(이중외피), 자연환기 |

---

## 2. 현재 온톨로지 상태 (v2.0)

### 파일
| 파일 | 위치 | 규모 |
|------|------|------|
| **GEC_B_Ontology.ttl** | `ontology/` | ~6,830줄, 5,756 트리플 |
| **GEC_B_SHACL.ttl** | `ontology/` | ~480줄, 24개 Shape |

### 온톨로지 구성
- **네임스페이스**: `brick:` (Brick Schema), `bldg:` (인스턴스), `bees:` (커스텀), `rdf:`, `rdfs:`, `owl:`, `xsd:`, `unit:`, `schema:`, `ref:`, `tag:`
- **커스텀 클래스 28개 + 속성 45개** (`bees:` 네임스페이스)
- **신뢰도 태깅 845개**: `confirmed` 25 / `estimated` 539 / `inferred` 284 / 미태깅 0
- **Site 참조**: `bldg:Samsung_GEC` 12개 트리플 (최소 컨텍스트 + 에너지 실측)
- **전층 모델링**: 지하(B4F~B1F), 포디움(1F~3F), 오피스(5F~15F 3-Tier), 옥상(RF)
- **데이터 일관성**: hasPart↔isPartOf 완전 대칭, 고아 엔티티 0개, 중복 인스턴스 0개

### 인스턴스 수
| 카테고리 | 수량 | 주요 유형 |
|----------|:----:|-----------|
| Floor | 18 | B4F~RF (18개 층) |
| HVAC Zone | 60 | 전층 Zone 보유: 오피스 5존/층, 지하/포디움/옥상 용도별 Zone |
| Room/Space | 57 | 주차장, 기계실, 전기실, 로비, 오픈오피스, 회의실 등 |
| Equipment | 279 | Chiller(4), Boiler(3), AHU(14), 팬(16), 펌프(13), CC패널(20), 디퓨저(48), 엘리베이터(10+2그룹), FCU(3) 등 |
| Sensor | 283 | ZAT/ZAH/CO2/CO/플레넘압력/노점/결로/BMS포인트/재실 등 |
| Command/Setpoint | 83 | 밸브명령, 팬속도, 댐퍼, 온도설정값, VFD속도 등 |
| System | 22 | HVAC, UFAD, CC, RH, DSF, NP, LS, BAS, 전기, 소방, 보안, 수직이동 등 |
| Profile (에너지/ESG) | 12 | 월별 에너지 프로파일, GHG, 인증 점수 |
| 기타 | 36 | DSF 제어 모드, 건물/사이트, 네트워크 등 |
| **합계** | **845** | |

### SHACL 검증 Shape 24개 (v2.0)
**기존 16개:**
1. SiteShape — Site 필수 속성 (label, hasPart)
2. BuildingShape — Building 필수 속성 (label, isPartOf)
3. FloorShape — Floor 필수 속성 (label, isPartOf Building)
4. HVACZoneShape — HVAC Zone 필수 속성 (label, isPartOf)
5. ChillerShape — Chiller 필수 속성 (label, isPartOf)
6. AHUShape — AHU 필수 속성 (label, isPartOf)
7. BoilerShape — Boiler 필수 속성 (label, isPartOf)
8. TemperatureSensorShape — 센서 연결 (label, isPointOf/hasLocation)
9. CO2SensorShape — CO2 센서 필수 속성 (label)
10. EstimatedDataShape — hasConfidence 값 범위 (confirmed/estimated/inferred)
11. EstimatedRangeShape — estimatedRange 시 hasConfidence 필수
12. LEEDCategoryShape — LEED 크레딧 (category, achieved/available)
13. GSEEDCategoryShape — G-SEED 분야 (category, achievedScore)
14. GHGEmissionShape — GHG 총배출량 (reportingEntity, year, value, unit)
15. GHGScope1Shape — GHG Scope 1 배출량 (reportingEntity, value)
16. EnergyBreakdownShape — 에너지 분해 (value, unit, isPointOf)

**Phase 8 추가 8개:**
17. AHUFeedsShape — AHU feeds >= 1
18. ChillerFeedsShape — Chiller feeds >= 1
19. PumpFeedsShape — Pump feeds >= 1 (Warning)
20. CoolingTowerFeedsShape — Cooling Tower feeds >= 1
21. EquipmentLocationShape — Equipment hasLocation 권장 (Warning)
22. ElevatorShape — Elevator 필수 속성 (label, hasLocation)
23. FCUShape — FCU 필수 속성 (label, feeds)
24. OccupancySensorShape — Occupancy Sensor 연결 (label, isPointOf/hasLocation)

### 데이터 확보율: 100% (134건)
| 구분 | 확인 | 추정 | 미확인 | 총 | 확보율 |
|------|:----:|:----:|:------:|:--:|:------:|
| 건물 기본정보 | 12 | 5 | 0 | 17 | **100%** |
| 입주/임대 현황 | 5 | 0 | 0 | 5 | **100%** |
| 인증 정보 | 16 | 3 | 0 | 19 | **100%** |
| HVAC/공조 시스템 | 10 | 16 | 0 | 26 | **100%** |
| BMS/BAS 시스템 | 11 | 16 | 0 | 27 | **100%** |
| 전기/소방/보안/기타 | 8 | 16 | 0 | 24 | **100%** |
| 에너지/ESG 데이터 | 13 | 3 | 0 | 16 | **100%** |
| **합계** | **75** | **59** | **0** | **134** | **100%** |

> **Phase 5 (v1.7):** 미확보 14건 전수 공학적 추정 완료 → 미확인 0건

---

## 3. 프로젝트 디렉토리 구조

```
BEES-Ontology/
├── CLAUDE.md                                  # 프로젝트 설정 및 규칙
├── docker-compose.yml                         # ★ Phase 9: 8서비스 Docker 오케스트레이션
├── .env                                       # ★ Phase 9: 환경변수 (DB, MQTT, API 키)
├── ontology/
│   ├── GEC_B_Ontology.ttl                     # ★ 메인 온톨로지 (v2.0.1)
│   └── GEC_B_SHACL.ttl                        # ★ SHACL 검증 Shape (v2.0)
├── scripts/
│   └── verify_neo4j.py                        # Neo4j 검증 스크립트
├── platform/                                  # ★ Phase 9: 디지털 트윈 플랫폼
│   ├── server-a/
│   │   ├── backend/                           # FastAPI 백엔드 (:8010→8000)
│   │   │   ├── app/
│   │   │   │   ├── main.py                    #   앱 진입점, CORS, lifespan
│   │   │   │   ├── config.py                  #   환경변수 중앙관리
│   │   │   │   ├── routers/
│   │   │   │   │   ├── dashboard.py           #   GET /api/dashboard/summary
│   │   │   │   │   ├── control.py             #   POST /api/control, GET /api/devices/status
│   │   │   │   │   ├── stream.py              #   GET /api/stream/points (SSE), /snapshot
│   │   │   │   │   ├── ontology.py            #   GET /api/ontology/search, /topology/tree
│   │   │   │   │   └── history.py             #   GET /api/history/{pointId}
│   │   │   │   └── services/
│   │   │   │       ├── mqtt_service.py        #   ★ MQTT 구독 + SSE 이벤트 생성 (polling 방식)
│   │   │   │       ├── neo4j_service.py       #   Neo4j Cypher 쿼리 (토폴로지, 검색)
│   │   │   │       └── influxdb_service.py    #   InfluxDB 직접 조회 (async)
│   │   │   ├── requirements.txt
│   │   │   └── Dockerfile
│   │   └── frontend/                          # Next.js 14 프론트엔드 (:3000)
│   │       ├── app/
│   │       │   ├── page.tsx                   #   대시보드 (KPI 카드, 차트, 테이블)
│   │       │   ├── monitoring/page.tsx        #   모니터링 (AHU_5F 5센서 실시간)
│   │       │   ├── control/page.tsx           #   제어 (장비 ON/OFF, 명령 이력)
│   │       │   └── layout.tsx                 #   공통 레이아웃 (사이드바)
│   │       ├── components/
│   │       │   ├── charts/live-chart.tsx       #   recharts 실시간 라인 차트
│   │       │   ├── layout/sidebar.tsx          #   네비게이션 사이드바
│   │       │   └── ui/                        #   shadcn/ui (card, badge, button, toast)
│   │       ├── lib/
│   │       │   ├── api.ts                     #   REST API 클라이언트 (fetchJSON 래퍼)
│   │       │   └── sse.ts                     #   useSSE 훅 (EventSource + 자동 재연결)
│   │       ├── package.json
│   │       └── Dockerfile
│   ├── server-b/                              # BAS Adapter (:8011→8001)
│   │   └── app/
│   │       ├── main.py                        #   POST /command, GET /devices, 감사 로그
│   │       ├── device_registry.py             #   인메모리 장비 레지스트리 (ID 매핑)
│   │       └── config.py
│   ├── server-c/                              # 가상 건물 에뮬레이터 (:8012→8002)
│   │   └── app/
│   │       ├── main.py                        #   시뮬레이션 시작/중지, 장비 제어
│   │       ├── engine.py                      #   ★ EmulatorEngine (AsyncIO 데이터 생성 루프)
│   │       ├── profiles/
│   │       │   └── ahu_5f.py                  #   AHU_5F 5센서 데이터 프로파일
│   │       └── config.py
│   ├── server-d/                              # Data Historian (:8013→8003)
│   │   ├── app/
│   │   │   ├── main.py
│   │   │   ├── mqtt_worker.py                 #   MQTT → InfluxDB 배치 저장
│   │   │   ├── database.py                    #   asyncpg + InfluxDB 클라이언트
│   │   │   ├── models.py                      #   Pydantic 모델
│   │   │   └── routers/
│   │   │       ├── points.py                  #   시계열 조회 (latest, history, summary)
│   │   │       ├── admin.py                   #   알람/감사 로그 조회
│   │   │       └── health.py
│   │   └── db/
│   │       └── init.sql                       #   PostgreSQL 스키마 (6테이블)
│   └── mosquitto/
│       └── mosquitto.conf                     #   MQTT 브로커 설정
├── data/                                      # Docker 볼륨 마운트 (gitignore)
└── _docs/
    ├── 01~08_*.md                             # 온톨로지 문서 (기존)
    ├── 09_Neo4j_GraphDB.md                     # Neo4j 구축 문서
    ├── history.md                              # ★ 이 파일
    ├── 10_디지털트윈_플랫폼_설계.md             # Phase 9 설계서 (전체 아키텍처)
    ├── 11_프로젝트_결과물_요약.md               # 프로젝트 결과물 요약 (접속 URL, 포트 등)
    ├── 세션요약_20260211.md                     # Phase 8 세션 요약
    ├── GEC_B동_온톨로지_통계.xlsx
    └── 검증_쿼리/
```

---

## 4. Phase 완료 이력

### Phase 1: 공개 데이터 추가 확보 — ✅ 완료
- 건축물대장(세움터), LEED/G-SEED 확정, ESG/GHG 공개 데이터
- 삼성E&A ESG보고서 PDF 직접 추출
- 서울시 에너지정보, 공공데이터포털 조회
- DitchCarbon, USGBC, 한전, 승강기안전공단 등 조회

### Phase 2: 대안적 데이터 확보 — ✅ 완료
- ESG PDF 직접 추출 (삼성E&A ESG보고서 2023/2024)
- 건축법규 기반 필수설비 역추론 (소방/전기/승강기/급배수)
- 유사건물 벤치마킹 (포스코센터, 코엑스, LG사이언스파크 등)
- 학술논문 16편+ (KCI, RISS, Google Scholar)
- KIPRIS 특허 6건
- 내부 데이터 요청서 작성 (59건)

### Phase 3: 온톨로지 고도화 — ✅ 완료
- 오피스층 HVAC Zone 확장 (6F~15F, 45개 Zone)
- 펌프/밸브/댐퍼 추정 그룹 (7개 그룹)
- 에너지 성능 분해 모델 (5개 항목: 난방/냉방/급탕/조명/환기)
- LEED NC v2.2 크레딧별 추정 점수 (6개 카테고리)
- G-SEED 전문분야별 추정 점수 (7개 분야)
- 시스템 간 feeds/monitors 관계 강화 (25개)
- SHACL 유효성 검증 Shape 작성 (11개)

### Phase 3.1: B동 범위 한정 수정 — ✅ 완료 (v1.4→v1.5)
**사용자 요청:** "온톨로지 구축은 '삼성물산 GEC B동'에만 범위가 해당해"

수행한 변경:
- Tower A/C/Podium 정의 제거 (B동 외 건물)
- 소방/보안/수자원 시스템 → `GEC_Tower_B`로 재배치 (기존 `Samsung_GEC`)
- 외기센서(OAT/OAH/Solar) → `GEC_Tower_B`로 재배치
- 방재센터 → B동 소속으로 변경
- GEC 전체 에너지 추정(`Annual_Energy_Estimate_GEC`) 삭제
- 삼성E&A 전사 ESG 데이터 삭제 (에너지/GHG/용수/폐기물) — 18건
- 삼성물산 전사 GHG 데이터 삭제
- DitchCarbon 기업 수준 데이터 삭제
- ESG_Samsung_EA 메타데이터 삭제
- Site 속성 최소화 (사이트면적, 설계사, 시공사만 유지)
- HQ=GEC 본사 GHG 데이터 유지 (B동 포함, 가장 근접한 확인 데이터)
- 결과: 2,218줄→2,017줄, 1,617→1,438 트리플 (-201줄, -179 트리플)
- rdflib 검증 통과, orphaned reference 0건

### Phase 4.1: 공공데이터 에너지 실측 반영 — ✅ 완료 (v1.5→v1.6)
**사용자 요청:** "공공데이터포털 건물에너지 API 조회해봐"

수행한 작업:
- 서울시 에너지다소비건물 온실가스배출량 공개자료 (2019년 기준) PDF 분석
- GEC 발견: 94위 / 324개소, 사업자명 "삼성엔지니어링(GEC강동사옥)"
- GEC 전체 실측: 6,143 TOE, 11,671 tCO2eq, 0.128 tCO2/m² (confirmed)
- B동 면적비례 추정: ~1,984 TOE, ~23.1 GWh, ~3,770 tCO2eq
- 실운영 EUI 384 kWh/m²/년 (설계 287.4 대비 +34%, OA/IT 포함으로 합리적)
- ESG보고서 HQ GHG(2022~2024: 10,900~12,900)와 교차검증 일치
- 결과: 2,017줄→2,070줄, 1,438→1,464 트리플 (+53줄, +26 트리플)

### Phase 5: 미확보 14건 전수 공학적 추정 — ✅ 완료 (v1.6→v1.7)
**사용자 요청:** "나머지 데이터를 추정/역추론으로 전부 만들어 넣어줘"

수행한 작업:
- 대표 공간 모델: 층별 Room/Space (오피스80%, 회의실12%, 서버3%, 지원5%) + 로비, 기계실
- 건물 단면: 기준층고 4.0m, 이중바닥 350mm, 천고 2.7m, DSF 캐비티 600~800mm
- 칠러 4대 × 1,500RT 정밀화 (냉방부하 150W/m² 계산, Trane/Carrier 추론)
- AHU 11대 × 47,000CMH (ASHRAE 62.1 기반 층당 1대) + DOAS 3대 × 24,000CMH
- BMS: Honeywell EBI 추론, 3계층 BACnet (IP+MS/TP), DDC 80~100대
- 대표 BMS 포인트 리스트: 칠러 9종, AHU 6종, 존 6종 (~1,600포인트)
- 전기: 6,000kVA 계약, 변압기 6대, 비상발전 1,200kVA, 주배전반, 층별분전반
- DSF 4-모드 제어 시퀀스: 여름/겨울/중간기/안전 + 풍속/강우센서
- 중수처리: 64m³/일 처리, 100m³ 저장, 빗물저류 50m³
- 엘리베이터: B동 전용 10대 (승용8+화물1+비상1, 5분수송능력 계산)
- 월별 에너지 프로파일: 12개월 분배 (1,454~2,515 MWh/월)
- 결과: 2,070줄→2,938줄, 1,464→2,024 트리플 (+868줄, +560 트리플)
- rdflib 파싱 검증 통과, pyshacl Conforms: True

### Phase 4: 내부 데이터 확보 시 (향후 — 미착수)
> Phase 5에서 공학적 추정으로 대체 완료. 내부 데이터 확보 시 estimated→confirmed 전환 가능.
- [ ] 장비 제조사/모델명/시리얼 확정 (추정→확정)
- [ ] BMS 실제 포인트 리스트 반영 (추정→확정)
- [ ] 실제 운영 에너지 데이터 (BEMS) 월별 실측 반영

---

## 5. 버전 이력

| 버전 | 줄 수 | 트리플 | 주요 변경 |
|:----:|:-----:|:------:|-----------|
| v1.0 | ~800 | ~500 | 초기 구축 (Location, Equipment, Point 기본) |
| v1.1 | ~900 | ~550 | DSF 루버/댐퍼 상세, 엘리베이터 추가 |
| v1.2 | ~1,000 | ~600 | B동 15F 수정, Floor 보완 |
| v1.3 | 1,695 | ~1,100 | Phase 2 (ESG PDF, 법규역추론, 벤치마킹, 장비추정) |
| v1.4 | 2,218 | 1,617 | Phase 3 (Zone확장, 인증상세, 시스템관계, SHACL) |
| v1.5 | 2,017 | 1,438 | Phase 3.1 (B동 범위 한정, 전사ESG 삭제, 시스템 재배치) |
| v1.6 | 2,070 | 1,464 | Phase 4.1 (서울시 에너지 실측 데이터, EUI 384, B동 교차검증) |
| v1.7 | 2,938 | 2,024 | Phase 5 (미확보 14건 전수 공학적 추정, 공간모델, BMS아키텍처, 월별에너지) |
| v1.8 | 4,948 | 3,702 | Phase 6 (6F~15F 3-Tier 층별 설비/센서/공간 모델, +292 인스턴스) |
| v1.9 | 6,505 | 5,090 | Phase 7 (전면 보완: 지하/저층/옥상 + BMS포인트 + 누락시스템 + confidence 전수) |
| v1.9.1 | 6,382 | 5,328 | Phase 7.1 (자기검토: 비대칭25건, 중복제거, hasLocation+isPartOf 보강, Boiler_3 신규) |
| v2.0 | 6,770 | 5,711 | Phase 8 (에너지 흐름 완성: feeds +78, hasPart 미러링, 엘리베이터 개별화, SHACL v2.0) |
| **v2.0.1** | **6,830** | **5,756** | **Phase 8.1 (주요 장비/시스템 rdfs:comment 45건 보강, 개발 원칙 문서화)** |

---

## 6. 핵심 기술 구조

### Brick Schema 위계 (Location)
```
brick:Site (Samsung_GEC) — 최소 컨텍스트
  └── brick:Building (GEC_Tower_B)
        ├── brick:Floor (B_B4F ~ B_RF, 18개)
        │     └── brick:HVAC_Zone (50개)
        │           ├── B_1F_Lobby_Zone, B_1F_Office_Zone (저층)
        │           ├── B_6F_Interior/Perimeter/DSF_Zone (6F~15F, 각3개)
        │           └── B_RF_MER_Zone (옥상기계실)
        └── brick:Location (B_MER_B2, 지하2층 기계실)
```

### 3중 공조 시스템 (HVAC)
1. **UFAD** (Under Floor Air Distribution, 가압식 바닥공조) — 오피스층 메인
2. **Chilled Ceiling** (복사냉방) — 오피스층 보조
3. **Radiant Heating** (복사난방) — 동절기

### DSF (Double Skin Facade)
- 서측 전면 이중외피
- 자동 루버 제어 (일사량 센서 연동)
- 자연환기 연동 (NP, Night Purge 시스템)

### 열원 구성
- 칠러 4대 (1,500 RT급 × 4, 추정) — Trane/Carrier 원심식
- 보일러 2대 (2,500 Mcal/h × 2, 가스 콘덴싱, 추정)
- 냉각탑 3대
- AHU 11대 (47,000 CMH/대, 층당 1대) + DOAS 3대 (24,000 CMH/대)

---

## 7. 기존 미확보 14건 → Phase 5에서 전수 추정 완료

> **v1.7 (Phase 5):** 14건 모두 공학적 추정/역추론으로 온톨로지에 반영 완료. 미확보 0건.
> 내부 데이터 확보 시 `bees:hasConfidence`를 `"estimated"` → `"confirmed"`로 전환 가능.

| # | 항목 | Phase 5 추정 방법 | 온톨로지 반영 |
|---|------|-------------------|---------------|
| 1 | 각 층 평면도 | 전용면적 비율 기반 공간 배분 | Section 23: Room 모델 |
| 2 | 단면도/입면도 | UFAD 이중바닥 기준 층고 계산 | Section 24: 층고 데이터 |
| 3 | 각 층별 공간 구성 | 오피스80%/회의12%/서버3%/지원5% | Section 23: 대표 공간 |
| 4 | 칠러 대수/용량 | 냉방부하 150W/m² 계산 | Section 25: 4×1,500RT |
| 5 | AHU/DOAS 사양 | ASHRAE 62.1 풍량 계산 | Section 25: 11+3대 |
| 6 | BMS 제조사 | 2012 한국 시장 점유율 추론 | Section 26: Honeywell EBI |
| 7 | BMS 포인트 리스트 | 장비별 표준 포인트 수 | Section 27: ~1,600포인트 |
| 8 | DDC 구성 | Zone/AHU/플랜트별 DDC 매핑 | Section 26: 80~100대 |
| 9 | 네트워크 토폴로지 | BACnet 3계층 표준 아키텍처 | Section 26: IP+MS/TP |
| 10 | 전기설비 사양 | 부하밀도 80W/m² 계산 | Section 28: 6,000kVA |
| 11 | DSF 루버 제어 | 특허+논문 기반 4모드 제어 | Section 29: 제어시퀀스 |
| 12 | 중수처리 | 2,000인×100L 물수지 계산 | Section 30: 64m³/일 |
| 13 | 엘리베이터 | 5분 수송능력 계산 | Section 31: B동 10대 |
| 14 | BEMS 운영 데이터 | 서울 기후 기반 월별 배분 | Section 32: 12개월 |

---

## 8. 주요 설계 결정 사항

### 온톨로지 설계
1. **Brick Schema 1.3+ 준수**: Location → System → Equipment → Point 위계
2. **`bees:` 커스텀 네임스페이스**: Brick에 없는 LEED/G-SEED/ESG/에너지분해 클래스 추가
3. **신뢰도 3단계**: `bees:hasConfidence` ("confirmed" / "estimated" / "inferred") — 모든 추정 데이터에 태깅
4. **추정 범위 표기**: `bees:estimatedRange` ("300~500 sensors" 등) — 정밀 수량 미확정 시
5. **feeds 관계**: 시스템 간 에너지/유체 흐름 25개 모델링
6. **SHACL 별도 파일**: `GEC_B_SHACL.ttl`로 분리하여 검증 독립 실행 가능

### 범위 결정
1. **B동 전용**: Site는 최소 컨텍스트(12 트리플)만 유지, 나머지 모두 B동 소속
2. **HQ GHG 유지**: HQ=GEC 본사 GHG 데이터(2022~2024)는 B동을 포함하므로 유지
3. **전사 ESG 제외**: 삼성E&A/삼성물산 전사 데이터는 B동 범위 밖이므로 제거
4. **법규 역추론**: 소방/전기/승강기/급배수 설비를 건축법규로 역추론 → `inferred` 태깅

### 데이터 소스
- **확인(confirmed)**: 건축물대장, LEED 인증, G-SEED 인증, ESG보고서 PDF, 학술논문, 서울시 에너지다소비건물 공개자료
- **추정(estimated)**: 유사건물 벤치마킹, 학술논문 참고값, 표준 설계 가이드, 면적비례 환산
- **역추론(inferred)**: 건축법규(소방법, 전기사업법, 승강기안전관리법)

---

## 9. 사용자 요청 이력 요약

| # | 요청 | 수행 결과 |
|---|------|-----------|
| 1 | GEC B동 Brick Schema 온톨로지 구축 | Phase 1~3 수행, v1.0→v1.4 |
| 2 | "온톨로지가 B동에만 해당하는 것 맞지?" | 범위 오류 발견, v1.5로 수정 (Phase 3.1) |
| 3 | "온톨로지 완성 현황 문서도 v1.5로 업데이트" | `14_온톨로지_완성_현황.md` 전면 재작성 |
| 4 | "데이터 확보 현황 문서도 v1.5로 업데이트" | `11_데이터_확보_현황.md` 전면 재작성 |
| 5 | "미확보 정보 목록 문서도 v1.5로 업데이트" | `07_미확보_정보_목록.md` 전면 재작성 |
| 6 | "history.md 파일을 만들어줘" | 이 파일 생성 |
| 7 | "CLAUDE.md 파일 만들어줘" | 프로젝트 루트에 CLAUDE.md 생성 |
| 8 | "미확보 데이터 어떻게 할 것인지" | 15건 분류별 확보 전략 제시 |
| 9 | "공공데이터포털 건물에너지 API 조회해봐" | 서울시 에너지다소비건물에서 GEC 데이터 발견 (6,143 TOE, 11,671 tCO2eq) |
| 10 | "반영해줘" | v1.5→v1.6 온톨로지 업데이트 (에너지 실측 +4속성, GEC 에너지 인스턴스, B동 추정 갱신) |
| 11 | "에너지 데이터 확보 현황 문서도 v1.6으로 업데이트" | `09_에너지_ESG_데이터.md` v1.6 업데이트 (3.2/3.4/4.3/6.3/7.2/8.3 섹션) |
| 12 | "history.md도 v1.6으로 업데이트" | 이 파일 v1.6 정합성 업데이트 |
| 13 | "CLAUDE.md도 v1.6으로 업데이트" | CLAUDE.md v1.6 정합성 업데이트 |
| 14 | "전체 문서 v1.6 정합성 확인" | Grep 검증 → SHACL/07/11/history 잔여 불일치 수정 |
| 15 | "pyshacl 검증 실행" | Conforms: True (11개 Shape 통과) |
| 16 | "남은 미확보 14건 진행 방법" | 3그룹 분류(공공/내부/도면) + 3단계 전략 |
| 17 | "나머지 데이터 추정/역추론으로 전부 넣어줘" | Phase 5: v1.6→v1.7 (14건 전수 추정, +868줄, +560 트리플) |
| 18 | "구축 과정 단계별로 정리해서 파일로 저장해줘" | `15_온톨로지_구축_방법론.md` 생성 (1,054줄, 13개 섹션, 재현 가능 가이드) |
| 19 | "각 데이터 항목별 출처와 생성 과정 추적표 만들어줘" | `16_데이터_출처_및_생성과정_추적표.md` 생성 (134건 항목별 출처/수집·생성 과정 추적) |
| 20 | "온톨로지 기반 통계 집계 + 층별 엑셀" | `17_온톨로지_통계_요약.md` + `GEC_B동_온톨로지_통계.xlsx` 생성 (rdflib SPARQL 추출, 5시트) |
| 21 | "6F~15F도 5F처럼 설비/센서 넣어줘" + "리서치 기반으로 추정해줘" | Phase 6: v1.7→v1.8, 3-Tier 층별 모델 (+292인스턴스, +1,678트리플), 엑셀/통계 재생성 |
| 22 | "전체 보완해줘 — 이미 만든 내용까지 검토하고 실제 건물에 맞게" | Phase 7: v1.8→v1.9, 전면 보완 8단계 (+229인스턴스, +1,388트리플), hasLocation 50건 수정, 지하/저층/옥상 모델링, BMS포인트 추가, 누락시스템 6개 생성, confidence 전수태깅(0건 미태깅) |
| 23 | "Phase 8 계획 세워줘" | Phase 8: v1.9.1→v2.0, 에너지 흐름 완성(feeds +78), hasPart 미러링(6시스템), 엘리베이터 개별화(10대), 2F/3F 보강, SHACL v2.0(24 shapes) |
| 24 | "검증 쿼리 결과를 파일로 저장해줘" | `_docs/검증_쿼리/SPARQL_검증_쿼리_결과_20260211.md` 생성 (SPARQL 10개 쿼리) |
| 25 | "온톨로지가 LLM 자연어 쿼리에 적합한지 평가" | LLM 적합성 분석: 83/100점, 한글 라벨 100%, 관계 3,349개, Neo4j 임포트 준비 완료 |
| 26 | "개발 원칙 파일 생성해줘" | `_docs/08_개발_원칙.md` 생성 (TTL-First 원칙, Neo4j 동기화 규칙, 변경 워크플로우) |
| 27 | "rdfs:comment 보강해줘" | v2.0→v2.0.1, 주요 장비/시스템 45건 comment 추가 (5,711→5,756 트리플) |
| 28 | "보강 결과 파일로 저장해줘" | `_docs/검증_쿼리/rdfs_comment_보강_결과_20260211.md` 생성 |
| 29 | "폴더 정리해줘 — Docs 폴더 생성, 통합, 중복 제거" | 7개 폴더→2개(ontology+_docs), 28파일→16파일, 10파일→3파일 통합, 5파일 삭제, 전체 경로 참조 업데이트 |
| 30 | "Neo4j 구축 진행하자" | Docker neo4j-bees 컨테이너 생성 (neo4j:5.26.0 + n10s), TTL 5,756 트리플 전량 임포트, 관계 6종 완전 일치 검증, `scripts/verify_neo4j.py` 생성 |
| 31 | "디지털 트윈 시뮬레이션 플랫폼 만들자" | Phase 9: 4-서버 아키텍처 설계 + MVP 구현. Server A(FastAPI+Next.js 대시보드), B(BAS Adapter), C(가상 건물 에뮬레이터), D(Data Historian). Docker Compose 8서비스 오케스트레이션 |
| 32 | "프론트엔드 데이터 안 보여" | SSE 크로스스레드 이슈 진단+수정(asyncio.Event→polling), 타임스탬프 포맷 변환(ISO→Unix), 센서ID 매핑 수정, Docker 포트 충돌 6건 해결 |
| 33 | "Phase 2 진행하자" (history.md 인수인계 파일 기반) | Phase 2: 4팀 병렬 — Team1 에뮬레이터 확장(84장비+164포인트), Team2 프론트엔드 3페이지, Team3 LLM 채팅, Team4 API+인프라. ~25개 파일 신규/수정 |
| 34 | "모든 서버 한방에 켜고 끌 수 있게 스크립트" | `start.sh`, `stop.sh` 생성 (Neo4j→Docker Compose→시뮬레이션→상태 확인) |
| 35 | "모든 내용을 빠짐없이 개발하였는지 검토" | 29개 항목 전수 검증: 27/29 완료(93%), 미구현 2건(InfluxDB) 발견 → 즉시 구현하여 29/29(100%) 달성 |

---

## 10. Phase 9: 디지털 트윈 IoT 시뮬레이션 플랫폼 (2026.02.11~12)

### 10.1 개요
Brick Schema 온톨로지(845 인스턴스, 5,756 트리플)를 기반으로 **4개 독립 서버** 구성의 디지털 트윈 IoT 시뮬레이션 플랫폼 구축. 가상 건물 에뮬레이터가 실시간 센서 데이터를 생성하고, 웹 대시보드에서 장비 제어 및 온톨로지 기반 지식 조회가 가능한 시스템.

### 10.2 시스템 아키텍처

```
[사용자 브라우저]
    ↓ http://localhost:3000
[Server A Frontend — Next.js 14]
    ↓ REST API / SSE (http://localhost:8010)
[Server A Backend — FastAPI]
    ├── Neo4j (bolt://host.docker.internal:7689) ← 온톨로지 조회
    ├── MQTT 구독 (bees/points/#, bees/devices/#) ← 실시간 데이터 수신
    └── → Server B (http://server-b:8001) ← 제어 명령 전달
           ↓
[Server B — BAS Adapter (FastAPI)]
    ├── 디바이스 레지스트리 (온톨로지 ID → 에뮬레이터 매핑)
    ├── → Server C (http://server-c:8002) ← 명령 전달
    ├── MQTT 발행 (bees/commands/{deviceId}) ← 감사
    └── PostgreSQL (audit_log) ← 감사 로그 저장
           ↓
[Server C — 가상 건물 에뮬레이터 (FastAPI + AsyncIO)]
    ├── 장비 상태 관리 (ON/OFF, mode)
    ├── 센서 데이터 생성 (5초 간격)
    └── MQTT 발행 (bees/points/{point_id}, bees/devices/{device_id}/state)
           ↓
[Mosquitto MQTT Broker]
    ↓ 구독
[Server D — Data Historian (FastAPI)]
    ├── MQTT → InfluxDB 배치 저장
    ├── REST API (시계열 조회, 집계)
    └── PostgreSQL (알람/감사/스케줄)
```

### 10.3 포트 매핑 (확정, 다른 프로젝트와 충돌 방지)

| 서비스 | 컨테이너명 | 호스트 포트 | 컨테이너 포트 | 비고 |
|--------|-----------|:-----------:|:------------:|------|
| Frontend | bees-frontend | **3000** | 3000 | Next.js standalone |
| Server A Backend | bees-server-a | **8010** | 8000 | FastAPI + Uvicorn |
| Server B | bees-server-b | **8011** | 8001 | BAS Adapter |
| Server C | bees-server-c | **8012** | 8002 | 에뮬레이터 |
| Server D | bees-server-d | **8013** | 8003 | Data Historian |
| Mosquitto | bees-mosquitto | **1885** | 1883 | MQTT 브로커 |
| InfluxDB | bees-influxdb | **8088** | 8086 | 시계열 DB |
| PostgreSQL | bees-postgres | **5434** | 5432 | 관계형 DB |
| Neo4j | neo4j-bees (외부) | 7476/7689 | - | docker-compose 외부, 기존 컨테이너 |

> **포트 충돌 이력**: hvac-influxdb(8086→8087), hvac-postgres(5433), hvac-mqtt(1883/1884), bees-otel-api(8000), hvac-fmi(8002), hvac-cdl(8003) 등과 충돌하여 모두 고유 포트로 변경

### 10.4 환경변수 (.env)
```bash
NEO4J_URI=bolt://host.docker.internal:7689  # 기존 neo4j-bees 컨테이너
NEO4J_USER=neo4j
NEO4J_PASSWORD=bees2024
INFLUXDB_URL=http://influxdb:8086            # Docker 내부 통신은 컨테이너 포트
INFLUXDB_TOKEN=bees-dev-token
INFLUXDB_ORG=samsung-gec
INFLUXDB_BUCKET=raw_7d
DATABASE_URL=postgresql://bees:bees2024@postgres:5432/bees_platform
MQTT_BROKER=mosquitto                        # Docker 내부 서비스명
MQTT_PORT=1883
SERVER_B_URL=http://server-b:8001
SERVER_C_URL=http://server-c:8002
SERVER_D_URL=http://server-d:8003
```

### 10.5 MQTT 토픽 설계
```
bees/points/{point_id}              # 센서 데이터 (Server C → D, A)
  예: bees/points/bldg:Zone_Air_Temp_5F_Interior
  payload: {"value": 24.3, "ts": "2026-02-12T10:30:00", "unit": "degC", "quality": "good"}

bees/devices/{device_id}/state      # 장비 상태 변경 (Server C → A)
  예: bees/devices/bldg:AHU_5F/state
  payload: {"is_active": true, "mode": "auto", "ts": "..."}

bees/commands/{device_id}           # 제어 명령 (Server B → 감사)
  payload: {"command": "ON", "source": "user", "ts": "..."}

bees/alarms/{severity}              # 알람 이벤트 (Server A 구독)
  payload: {"equipment": "...", "type": "...", "value": ..., "threshold": ...}
```

> **주의**: Server C는 `ts`를 ISO 8601 문자열로 발행. Server A `mqtt_service.py`의 `_parse_ts()`가 Unix timestamp로 변환하여 프론트엔드에 전달.

### 10.6 Server A — 온톨로지 웹 서비스 (구현 완료)

#### Backend API (FastAPI, :8010)
| 엔드포인트 | 메서드 | 구현 | 설명 |
|-----------|--------|:----:|------|
| `/api/dashboard/summary` | GET | ✅ | KPI 카드 (활성장비, 평균온도, 알람수, 시뮬레이션 상태) |
| `/api/stream/points` | GET | ✅ | SSE 실시간 스트림 (point/device/alarm/heartbeat) |
| `/api/stream/snapshot` | GET | ✅ | 현재 MQTT 캐시 전체 스냅샷 |
| `/api/control` | POST | ✅ | 제어 명령 → Server B 프록시 |
| `/api/devices/status` | GET | ✅ | MQTT 캐시 + Neo4j 병합 장비 상태 |
| `/api/ontology/search` | GET | ✅ | Neo4j Cypher 검색 (URI/라벨/클래스) |
| `/api/topology/tree` | GET | ✅ | 건물 계층 트리 (Site→Building→Floor→Zone→Equipment) |
| `/api/history/{pointId}` | GET | ✅ | Server D 시계열 조회 프록시 |
| `/health` | GET | ✅ | 헬스체크 |
| `/api/chat` | POST | ✅ | OpenAI GPT-4o Function Calling + Neo4j Cypher Q&A (Phase 2 완료) |
| `/api/chat/status` | GET | ✅ | OpenAI 서비스 상태 확인 (Phase 2 완료) |
| `/api/ontology/graph` | GET | ✅ | Cytoscape.js JSON — 노드+엣지+통계 (Phase 2 완료) |
| `/api/ontology/node/{id}` | GET | ✅ | 노드 상세 — URI, 라벨, 속성, 연결 목록 (Phase 2 완료) |

**핵심 서비스 — mqtt_service.py (SSE 구현)**:
- paho-mqtt 백그라운드 스레드에서 MQTT 메시지 수신
- `_point_cache`, `_device_cache` 딕셔너리에 최신값 캐시
- **polling 기반 SSE**: `_event_counter` + `threading.Lock`으로 크로스스레드 동기화
  - `asyncio.Event`는 Python 3.12에서 크로스스레드 동작 불가 → polling으로 교체
  - `event_generator()`: 0.5초마다 카운터 비교, 새 이벤트 있으면 yield, 없으면 heartbeat
- `_parse_ts()`: ISO 8601 문자열 → Unix timestamp 변환

**의존성**: `fastapi==0.115.6`, `neo4j==5.27.0`, `paho-mqtt==2.1.0`, `sse-starlette==2.2.1`, `httpx==0.28.1`

#### Frontend (Next.js 14, :3000)
| 페이지 | 경로 | 구현 | 핵심 컴포넌트 |
|--------|------|:----:|-------------|
| 대시보드 | `/` | ✅ | KPI 카드 4개, 급기온도 실시간 차트 (recharts), 장비 테이블, 최근 센서 테이블 |
| 모니터링 | `/monitoring` | ✅ | AHU_5F 5센서 현재값 카드, 센서별 라인 차트, 상세 테이블 |
| 제어 | `/control` | ✅ | 장비 ON/OFF 토글, 상태 LED, 명령 이력 (낙관적 업데이트) |
| 온톨로지 | `/ontology` | ✅ | Cytoscape.js 그래프 뷰, 3레이아웃, 타입 필터, 노드 클릭 상세 (Phase 2 완료) |
| 토폴로지 | `/topology` | ✅ | 트리뷰 + 층별 장비 그리드/리스트 뷰 + SSE 실시간 (Phase 2 완료) |
| LLM 채팅 | `/chat` | ✅ | GPT-4o 대화 UI, 예시 질문, Cypher 표시, 도구 호출 배지 (Phase 2 완료) |

**SSE 훅 (`lib/sse.ts`)**:
- `useSSE(maxHistory=60)` — EventSource 기반 구독
- 반환: `{ points, pointHistory, devices, alarms, connected }`
- 자동 재연결: 5초 후 재시도
- API_BASE: `NEXT_PUBLIC_API_URL` (빌드 시 bake, 기본값 `http://localhost:8010`)

**의존성**: `next@14.2.23`, `react@18`, `recharts@2.15`, `lucide-react`, `tailwindcss`, `class-variance-authority`

### 10.7 Server B — BAS Adapter (구현 완료)

| 엔드포인트 | 메서드 | 설명 |
|-----------|--------|------|
| `/command` | POST | 제어 명령 수신 → 유효성 검증 → Server C 전달 → MQTT 발행 → 감사 로그 |
| `/devices` | GET | 디바이스 레지스트리 전체 조회 |
| `/devices/{id}/status` | GET | Server C에서 특정 장비 상태 프록시 |
| `/health` | GET | 헬스체크 (MQTT, DB 연결 상태) |
| `/audit-log` | GET | 명령 감사 로그 조회 (최근 100건) |

**디바이스 레지스트리** (`device_registry.py`):
- `DeviceInfo`: ontology_id, name, type, location, allowed_commands
- Phase 1 등록: `bldg:AHU_5F` (ON, OFF, setpoint)
- **Phase 2 완료**: Neo4j에서 제어 가능 장비 9종 자동 로딩 (`server-b/app/neo4j_loader.py`)

**폴백 처리**: PostgreSQL 미연결 시 인메모리 감사 로그 (FIFO, 500건)

### 10.8 Server C — 가상 건물 에뮬레이터 (구현 완료)

| 엔드포인트 | 메서드 | 설명 |
|-----------|--------|------|
| `/simulation/start` | POST | 시뮬레이션 시작 |
| `/simulation/stop` | POST | 시뮬레이션 중지 |
| `/simulation/status` | GET | 상태 조회 (running/stopped) |
| `/devices` | GET | 전체 장비 상태 + 최신 센서값 |
| `/devices/{id}` | GET | 특정 장비 상태 |
| `/devices/{id}/command` | POST | 장비 제어 (ON/OFF/MODE) |

**EmulatorEngine** (`engine.py`):
- AsyncIO 기반 시뮬레이션 루프 (5초 간격)
- 데이터 생성 공식: `value = base_value + noise * random(-1,1) + daily_pattern + equipment_effect + drift`
- 장비 ON/OFF에 따른 물리적 보정 (예: AHU OFF → 급기온도 24°C로 수렴, 전력 0.5kW 대기)
- MQTT 발행: `bees/points/{point_id}`, `bees/devices/{device_id}/state`

**AHU_5F 데이터 프로파일** (`profiles/ahu_5f.py`):
| 센서 ID | Brick 클래스 | 기본값 | 범위 | 단위 | 특성 |
|---------|-------------|:------:|------|:----:|------|
| `bldg:Zone_Air_Temp_5F_Interior` | Zone_Air_Temperature_Sensor | 24°C | 18~30 | degC | 일간 사인파 + 재실 보정 |
| `bldg:Zone_Air_Humidity_5F_Interior` | Zone_Air_Humidity_Sensor | 50% | 30~70 | %RH | AHU OFF시 60%로 상승 |
| `bldg:Supply_Air_Temp_AHU_5F` | Supply_Air_Temperature_Sensor | 16°C | 12~28 | degC | AHU OFF시 24°C 수렴 |
| `bldg:Filter_DP_AHU_5F` | Filter_Differential_Pressure_Sensor | 250Pa | 100~500 | Pa | 시간당 0.5Pa 드리프트 |
| `bldg:Power_AHU_5F` | Electrical_Power_Sensor | 35kW | 0~52 | kW | ON=35kW, OFF=0.5kW |

### 10.9 Server D — Data Historian (구현 완료)

| 엔드포인트 | 메서드 | 설명 |
|-----------|--------|------|
| `/data/points/summary` | GET | 전체 포인트 현황 (최근 7일) |
| `/data/points/{id}/latest` | GET | 최신값 조회 |
| `/data/points/{id}/history` | GET | 시계열 조회 (Flux 쿼리, aggregation: 1m/5m/1h/1d) |
| `/data/points` | POST | 단건 저장 (REST fallback) |
| `/alarm-history` | GET | 알람 이력 (equipment, severity 필터, 페이지네이션) |
| `/audit-log` | GET | 감사 로그 조회 |
| `/health` | GET | 헬스체크 (InfluxDB, PostgreSQL, MQTT) |

**MQTT → InfluxDB 워커** (`mqtt_worker.py`):
- `bees/points/#` 구독 (QoS=1)
- 배치 플러시: 크기 도달 또는 시간 경과 시 InfluxDB 배치 쓰기
- measurement: `sensor_data`, tag: `point_id`, field: `value`

**PostgreSQL 스키마** (`db/init.sql`):
- `users` — 사용자 관리 (email, role, department)
- `equipment_metadata` — 장비 메타데이터 (제조사, 모델, 유지보수)
- `work_orders` — 유지보수 작업 주문
- `alarm_history` — 알람 이력 (onset_at, cleared_at, acknowledged_at)
- `audit_log` — 감사 로그 (user_id, action, target_equipment)
- `schedules` — 스케줄 관리 (JSONB)

### 10.10 구현 완료 항목 요약 (Phase 1 MVP)

✅ **완료**:
1. Docker Compose 8서비스 오케스트레이션 (docker-compose.yml)
2. 실시간 데이터 파이프라인: Server C → MQTT → Server A(SSE) + Server D(저장)
3. 장비 제어 E2E: Frontend → A → B → C → 상태 변경 → MQTT → Frontend 업데이트
4. 대시보드 KPI (활성 장비, 평균 온도, 알람, 시뮬레이션 상태)
5. 모니터링 페이지 (AHU_5F 5센서 실시간 차트)
6. 제어 페이지 (ON/OFF 토글, 명령 이력)
7. 온톨로지 검색 API (Neo4j Cypher)
8. 토폴로지 트리 API
9. 시계열 조회 프록시 (Server A → Server D)
10. 감사 로그 (PostgreSQL + 인메모리 폴백)
11. 모든 외부 의존성에 대한 폴백 처리 (Neo4j, Server B/C/D, PostgreSQL)

### 10.11 Phase 2 이후 작업 (Phase 2는 전체 완료)

#### Phase 2: 풀 시뮬레이션 + 온톨로지 뷰 + LLM 채팅 — ✅ 전체 완료
| # | 작업 | 상태 | 관련 파일 |
|---|------|:----:|----------|
| 1 | **845개 전체 인스턴스 시뮬레이션** | ✅ | `server-c/app/engine.py`, `profiles/`, `neo4j_loader.py` |
| 2 | **온톨로지 그래프 뷰** | ✅ | `frontend/app/ontology/page.tsx` |
| 3 | **토폴로지 뷰** | ✅ | `frontend/app/topology/page.tsx` |
| 4 | **LLM 채팅** | ✅ | `backend/app/routers/chat.py`, `services/openai_service.py` |
| 5 | **디바이스 레지스트리 자동 로딩** | ✅ | `server-b/app/device_registry.py`, `neo4j_loader.py` |
| 6 | **일간 패턴 / 계절 보정** | ✅ | `server-c/app/profiles/profile_factory.py` |
| 7 | **InfluxDB 직접 연결** | ✅ | `backend/app/services/influxdb_service.py`, `routers/history.py` |

#### Phase 3: 고급 기능
| # | 작업 | 상세 |
|---|------|------|
| 1 | BACnet/IP 어댑터 | Server B에 BAC0 라이브러리 추가 |
| 2 | 알람 자동 생성 | 임계값 비교 → alarm_history 자동 저장 |
| 3 | 에너지 분석 대시보드 | 월별/일별 에너지 소비 차트, 피크 분석 |
| 4 | 데이터 보존 정책 | raw → 1h → 1d 집계, 자동 retention |
| 5 | 사용자 인증 | JWT 기반 로그인, 역할 기반 접근 제어 |
| 6 | 스케줄 관리 | 장비 스케줄 CRUD (schedules 테이블 활용) |

### 10.12 디버깅 이력 (문제 → 원인 → 수정)

| 문제 | 원인 | 수정 |
|------|------|------|
| SSE에서 heartbeat만 전달, 센서 데이터 미전달 | Python 3.12에서 `asyncio.Event`의 `call_soon_threadsafe()`가 MQTT 백그라운드 스레드에서 실패 | `_event_counter` + `threading.Lock` polling 방식으로 전면 교체 |
| 프론트엔드 차트에 데이터 미표시 | 타임스탬프 포맷 불일치 (Server C: ISO 문자열, Frontend: Unix 숫자) | `mqtt_service._parse_ts()` 변환 함수 추가 |
| 모니터링 페이지 센서 카드 빈 값 | 프론트엔드에서 `AHU_5F_SAT` 등 가짜 ID 사용 (실제 MQTT: `bldg:Supply_Air_Temp_AHU_5F`) | 5개 센서 ID 모두 실제 온톨로지 point_id로 교체 |
| `docker compose up` 포트 바인딩 실패 | 동일 머신의 hvac-*, bees-otel-* 프로젝트와 6개 포트 충돌 | 전체 포트 재매핑 (8010/8011/8012/8013/8088/1885/5434) |
| `bees-influxdb` 컨테이너 재생성 실패 | 이전 `docker compose down`에서 삭제 안 된 stale 컨테이너 | `docker rm -f` 후 재생성 |
| Neo4j 연결 실패 (Unauthorized) | 기존 neo4j-bees 컨테이너 인증 정보 불일치 (미해결) | 서비스는 폴백 데이터로 계속 실행. **향후 수정 필요** |

### 10.13 기동 방법
```bash
# 전체 기동
cd /Users/mckim64/Projects/SAMSUNG/BEES-Ontology
docker compose up -d

# 개별 로그 확인
docker logs -f bees-server-a   # Backend
docker logs -f bees-server-c   # 에뮬레이터

# SSE 스트림 확인 (curl)
curl -sN http://localhost:8010/api/stream/points

# API 스냅샷 확인
curl -s http://localhost:8010/api/stream/snapshot | python3 -m json.tool

# 시뮬레이션 시작 (자동 시작이 안 된 경우)
curl -X POST http://localhost:8012/simulation/start

# 장비 제어 테스트
curl -X POST http://localhost:8010/api/control \
  -H "Content-Type: application/json" \
  -d '{"deviceId": "bldg:AHU_5F", "command": "ON"}'

# Frontend 확인
open http://localhost:3000
```

### 10.14 Git 커밋 이력 (Phase 9~10)
```
# Phase 10 (플랫폼 Phase 2)
7f62a8d docs: 프로젝트 결과물 요약 v1.1 — 접속 URL 상세화 (포트 매핑, Swagger, 헬스체크)
a55954c docs: 프로젝트 결과물 요약 문서 추가 (BEES-DOC-011 v1.0)
38b585c feat: 디지털 트윈 플랫폼 Phase 2 완료 — 풀 시뮬레이션, 온톨로지 뷰, LLM 채팅, InfluxDB 직접 연동
25e2f17 docs: CLAUDE.md에 디지털 트윈 플랫폼 섹션 추가 — 새 세션 시작 시 컨텍스트 자동 로딩
633365c docs: history.md Phase 9 전면 업데이트 — 플랫폼 아키텍처, 구현 상세, 디버깅 이력, 다음 작업 가이드

# Phase 9 (플랫폼 Phase 1 MVP)
a9f126a fix: SSE 실시간 스트림 수정 + Docker 포트 충돌 해결 + 프론트엔드 데이터 표시 복구
ff9d3fd feat: 디지털 트윈 플랫폼 Phase 1 MVP — 4개 서버 구현
0e390c5 docs: 디지털 트윈 플랫폼 설계서 v2 추가
```

---

## 11. 검증 방법

### TTL 구문 검증
```python
from rdflib import Graph
g = Graph()
g.parse("ontology/GEC_B_Ontology.ttl", format="turtle")
print(f"트리플 수: {len(g)}")  # 예상: 3,702
```

### SHACL 유효성 검증
```bash
pip install pyshacl
pyshacl -s ontology/GEC_B_SHACL.ttl -d ontology/GEC_B_Ontology.ttl
```

### 범위 검증 (Samsung_GEC 참조 확인)
```bash
grep -c "Samsung_GEC" ontology/GEC_B_Ontology.ttl  # 예상: ~12 (Site 최소 컨텍스트 + 에너지 실측)
```

---

## 12. Phase 10 — 디지털 트윈 플랫폼 Phase 2 확장 (2026.02.12)

### 12.1 개요
Phase 1 MVP(AHU_5F 1대 + 5센서)에서 **845개 전체 인스턴스 시뮬레이션 + 온톨로지 시각화 + LLM 채팅**으로 확장.
4개 팀 병렬 작업으로 약 25개 파일 신규/수정.

### 12.2 완료된 작업

#### Team 1: 에뮬레이터 확장 (Server C + Server B)
- **Neo4j 자동 로딩**: `server-c/app/neo4j_loader.py` — 장비 84개 + 포인트 164개 자동 등록
- **프로파일 자동 생성**: `server-c/app/profiles/profile_factory.py` — 30+ Brick 포인트 클래스별 시뮬레이션 파라미터 매핑
- **서울 계절 보정**: `seasonal_correction()` — 사인파 모델 (7월 냉방 피크, 1월 난방 피크)
- **장비별 전력 오버라이드**: Chiller 750kW, Boiler 30kW, AHU 35kW, CT 15kW, FCU 0.5kW
- **Phase 1 폴백**: Neo4j 실패 시 AHU_5F MVP로 자동 전환
- **Server B 디바이스 레지스트리**: `server-b/app/neo4j_loader.py` — Neo4j에서 제어 가능 장비 자동 로딩

#### Team 2: 프론트엔드 시각화
- **온톨로지 그래프 뷰**: `frontend/app/ontology/page.tsx` — Cytoscape.js, cose-bilkent/breadthfirst/circle 레이아웃, 노드 타입별 색상, 타입 필터, 노드 클릭 상세
- **토폴로지 뷰**: `frontend/app/topology/page.tsx` — 건물 계층 트리 + 장비 그리드/리스트 뷰 + SSE 실시간 상태
- **사이드바 확장**: 6개 메뉴 (대시보드, 모니터링, 제어, 온톨로지, 토폴로지, AI 채팅)

#### Team 3: LLM 채팅
- **OpenAI 서비스**: `backend/app/services/openai_service.py` (~590줄) — GPT-4o Function Calling, 6개 도구
  - `query_building_ontology`: 범용 Cypher (쓰기 차단, LIMIT 50 자동)
  - `get_equipment_on_floor`: 층별 장비 (한글 "5층" → "B_5F" 정규화)
  - `get_equipment_sensors`: 장비 센서 목록
  - `get_system_info`: 시스템 구성 (한글 키워드 매핑)
  - `count_by_type`: Brick 클래스별 집계
  - `get_energy_flow`: feeds 관계 추적
- **채팅 UI**: `frontend/app/chat/page.tsx` — 메시지 이력, 예시 질문, Cypher 표시, 도구 호출 배지
- **안전 가드**: 쓰기 Cypher 차단, LIMIT 50, 대화 이력 10개, Function Calling 최대 3회

#### Team 4: 백엔드 API 확장 + 인프라 보강
- **온톨로지 그래프 API**: `GET /api/ontology/graph` — Cytoscape.js 호환 JSON (노드+엣지+통계)
- **노드 상세 API**: `GET /api/ontology/node/{node_id}` — URI, 라벨, 속성, 연결 목록
- **범용 Cypher 실행**: `neo4j_service.run_cypher()` — LLM 채팅용
- **노드 타입 분류**: `_classify_node_type()` — n10s 라벨 기반 7단계 분류
- **InfluxDB 직접 연동**: `influxdb_service.py` — Server D 프록시 없이 InfluxDB 직접 조회
  - `InfluxDBClientAsync` 비동기 클라이언트, lifespan `connect()`/`disconnect()`
  - `query_point_history()`: Flux 쿼리, aggregateWindow 지원, 상대/절대 시간
  - `get_point_latest()`: 최신 1건 조회
  - 3단계 폴백: InfluxDB 직접 → Server D 프록시 → MQTT 캐시

### 12.3 신규 파일 목록
| 파일 | 설명 |
|------|------|
| `server-c/app/neo4j_loader.py` | Neo4j 장비/센서 자동 로딩 |
| `server-c/app/profiles/profile_factory.py` | Brick 클래스별 시뮬레이션 프로파일 자동 생성 |
| `server-b/app/neo4j_loader.py` | Server B 디바이스 레지스트리 Neo4j 로딩 |
| `server-a/backend/app/services/openai_service.py` | OpenAI GPT Function Calling 서비스 |
| `server-a/backend/app/routers/chat.py` | LLM 채팅 API |
| `server-a/frontend/app/ontology/page.tsx` | 온톨로지 그래프 뷰 |
| `server-a/frontend/app/topology/page.tsx` | 토폴로지 트리 뷰 |
| `server-a/frontend/app/chat/page.tsx` | LLM 채팅 UI |
| `server-a/frontend/types/modules.d.ts` | Cytoscape.js 타입 선언 |

### 12.4 수정된 파일 목록
| 파일 | 변경 내용 |
|------|----------|
| `server-c/app/engine.py` | `initialize_from_neo4j()`, 계절 보정, boolean 처리 |
| `server-c/app/main.py` | Neo4j 로딩 호출, `/neo4j/status` 엔드포인트 |
| `server-c/requirements.txt` | `neo4j==5.27.0` |
| `server-b/app/config.py` | Neo4j 연결 정보 추가 |
| `server-b/app/main.py` | Neo4j 디바이스 로딩 호출 |
| `server-b/requirements.txt` | `neo4j==5.27.0` |
| `server-a/backend/app/config.py` | OPENAI_API_KEY, OPENAI_MODEL |
| `server-a/backend/app/services/neo4j_service.py` | 그래프 API, 노드 상세, Cypher 실행, 타입 분류 |
| `server-a/backend/app/routers/ontology.py` | `/api/ontology/graph`, `/api/ontology/node/{id}` |
| `server-a/backend/app/main.py` | chat 라우터, openai_service.init(), influxdb_service lifespan |
| `server-a/backend/app/services/influxdb_service.py` | 스텁 → InfluxDB async 직접 연동 |
| `server-a/backend/app/routers/history.py` | 3단계 폴백 (InfluxDB→ServerD→MQTT) |
| `server-a/backend/requirements.txt` | `openai>=1.14.0`, `influxdb-client[async]>=1.40.0` |
| `server-a/frontend/package.json` | cytoscape, cytoscape-cose-bilkent |
| `server-a/frontend/lib/api.ts` | Graph, NodeDetail, Chat 타입/함수 |
| `server-a/frontend/components/layout/sidebar.tsx` | 6개 메뉴 (Phase 2 라벨) |
| `docker-compose.yml` | Server B/C extra_hosts 추가 |
| `.env` | OPENAI_MODEL=gpt-4o |

### 12.5 검증 결과 (2026.02.12)
```
인프라: 9 Docker 컨테이너 + Neo4j 외부 컨테이너 = 10개 서비스 정상
시뮬레이션: 84개 장비, 164개 포인트 실시간 생성 (5초 간격)
온톨로지 그래프: 300+ 노드, 227 엣지 (Equipment/Point/Zone/Floor/Building/System/Location 분류)
토폴로지: GEC_Tower_B 18개 층, Zone 계층 완전
LLM 채팅: 서비스 준비 완료 (OpenAI API 키 설정 필요)
InfluxDB 직접 조회: source=influxdb_direct 확인 (3단계 폴백 동작)
프론트엔드: 8개 페이지 전체 HTTP 200 (대시보드/모니터링/제어/온톨로지/토폴로지/채팅/시계열이력/로그인)
```

### 12.6 디버깅 이력
1. **Cytoscape.js 타입 오류**: `shape: "data(shape)"` → `shape: "ellipse" as const` + `} as any,`로 해결
2. **n10s 내부 노드**: `_GraphConfig`, `DatatypeProperty` 등이 그래프에 포함 → `n.uri IS NOT NULL AND n.uri STARTS WITH 'https://example.org/gec-b#'` 필터 추가
3. **API 키 불일치**: stats 키 `total_nodes`/`total_edges` → `node_count`/`edge_count`로 프론트엔드와 통일
4. **NodeDetail 필드명**: `relationship`→`rel`, `node_id`→`target_uri`로 프론트엔드 인터페이스 매칭
5. **Neo4j 컨테이너**: `neo4j-bees` 삭제 상태 → 재생성 + n10s 설정 + TTL 5,756 트리플 재임포트

### 12.7 Neo4j 컨테이너 (재생성)
```bash
# 생성 명령
docker run -d --name neo4j-bees \
  -p 7476:7474 -p 7689:7687 \
  -e NEO4J_AUTH=neo4j/bees2024 \
  -e NEO4J_PLUGINS='["n10s"]' \
  -e NEO4J_dbms_security_procedures_unrestricted='n10s.*' \
  -e NEO4J_dbms_security_procedures_allowlist='n10s.*' \
  -v "$(pwd)/ontology:/import" \
  neo4j:5.26.0-community

# n10s 설정
docker exec neo4j-bees cypher-shell -u neo4j -p bees2024 \
  "CREATE CONSTRAINT n10s_unique_uri IF NOT EXISTS FOR (r:Resource) REQUIRE r.uri IS UNIQUE"
docker exec neo4j-bees cypher-shell -u neo4j -p bees2024 \
  "CALL n10s.graphconfig.init({handleVocabUris: 'MAP', handleMultival: 'ARRAY', handleRDFTypes: 'LABELS', applyNeo4jNaming: false})"
docker exec neo4j-bees cypher-shell -u neo4j -p bees2024 \
  "CALL n10s.rdf.import.fetch('file:///import/GEC_B_Ontology.ttl', 'Turtle')"
# 결과: 5,756 트리플 로드
```

---

## 13. 다음 작업 가이드

### 현재 상태 요약 (2026.02.18 기준)

**온톨로지**: v2.1.0 — 9,789 트리플, 1,272 인스턴스, SHACL 24 Shape, 신뢰도 100% 태깅
**플랫폼**: Phase 5 **100% 완료** — 10개 서비스(Docker 9 + Neo4j 외부), 20개 프론트엔드 페이지, 57+ API
**설계서 대비 진행률**: **~99%** (잔여: 정기 보고서 자동 발송, 테스트 코드, CI/CD)

| 완료된 Phase | 주요 내용 |
|:---:|----------|
| Phase 1 (온톨로지) | v1.0~v2.0.1, 10단계 구축, B동 전용, 845 인스턴스 |
| Phase 1 (플랫폼 MVP) | AHU_5F 1대 + 5센서, SSE, 대시보드/모니터링/제어, E2E 제어 |
| Phase 2 (플랫폼 확장) | 84장비 164포인트 풀 시뮬레이션, 온톨로지 그래프, 토폴로지 뷰, LLM 채팅, InfluxDB 직접 연동 |
| Phase 3 (플랫폼 고도화) | 알람 시스템, Grafana, 시계열 이력, 반응형 UI, BACnet, JWT, 스케줄, 데이터 보존, 품질 검증 |
| Phase 4 (시뮬레이션+UX) | 시나리오 7종, 고장주입 6종, 열역학 모델, 신규 8페이지, 30+ 신규 API, 데이터 품질, 명령 큐, 감사 로그 |
| Phase 4.5 (버그수정+UX) | 에너지 kW 스케일링, 유지보수 캘린더, Server B 재시도, Grafana 인증, /scenarios + /data-quality 페이지 |
| **Phase 5 (플랫폼 완성)** | **i18n 한/영, 대시보드 위젯 D&D, WebSocket, Push 알림, API 문서 정비, 환경 분리, PDF/Excel 보고서** |

### 프론트엔드 20개 페이지 전체 목록
| 경로 | 기능 | 추가 Phase |
|------|------|:---:|
| `/` | 대시보드 — KPI, 장비 상태, 알람, D&D 위젯 그리드 | 1→**5** |
| `/monitoring` | 모니터링 — 실시간 차트 | 1 |
| `/monitoring/[equipmentId]` | 장비 상세 — 게이지, 트렌드, 성능, 연결 관계, 알람 | 4 |
| `/control` | 제어 — ON/OFF, 모드 변경 (JWT 필요) | 1 |
| `/ontology` | 온톨로지 그래프 — 클릭 하이라이트, 더블클릭 확장 | 2 |
| `/topology` | 토폴로지 — 건물 계층 트리 + SSE 실시간 장비 상태 | 2 |
| `/chat` | AI 채팅 — GPT-4o Function Calling × Neo4j | 2 |
| `/history` | 시계열 이력 — recharts 멀티라인, CSV 다운로드 | 3 |
| `/login` | 로그인 — JWT 인증 | 3 |
| `/alarms` | 알람 관리 — 심각도 카운트, 필터, 확인, 억제, 상세 패널 | 4 |
| `/alarms/history` | 알람 이력 — 아카이브, CSV, 억제 | 4 |
| `/scenarios` | 시나리오 — 시뮬레이션 시나리오 로드 + 고장 주입/해제 | 4.5 |
| `/data-quality` | 데이터 품질 — Historian 상태, 품질 통계, 포인트 현황 | 4.5 |
| `/energy` | 에너지 분석 — 실시간 전력, 파이차트, EUI, 층별 비교 | 4 |
| `/maintenance` | 유지보수 — 작업 주문 CRUD, 캘린더, 수명 추적 | 4 |
| `/reports` | 보고서 — 4종 프리셋, JSON/CSV/Excel/PDF, 이력 | 4→**5** |
| `/settings` | 시스템 설정 — 빌딩/시간대/단위/에너지/알람 | 4 |
| `/settings/users` | 사용자 관리 — Admin CRUD, 역할, 접근 로그 | 4 |
| `/settings/notifications` | **알림 채널** — Email/Slack 설정, 테스트 발송, 이력 | **5** |
| `_not-found` | 404 페이지 | - |

### 서버별 주요 파일 매핑

**Server A Backend** (`platform/server-a/backend/app/`):
| 라우터 | 주요 엔드포인트 |
|--------|----------------|
| `routers/stream.py` | SSE 실시간 스트림, 스냅샷 |
| `routers/control.py` | 장비 제어 + 감사 로깅 |
| `routers/alarm.py` | 알람 CRUD, 억제/해제, 통계 |
| `routers/equipment.py` | 장비 상세 (Neo4j+InfluxDB+PostgreSQL) |
| `routers/energy.py` | 에너지 분석 (realtime/profile/breakdown/eui) |
| `routers/maintenance.py` | 유지보수 작업 주문 CRUD, 캘린더 |
| `routers/reports.py` | 보고서 프리셋/생성/다운로드 (JSON/CSV/Excel/PDF) |
| `routers/users.py` | 사용자 CRUD (Admin 전용) |
| `routers/settings.py` | 시스템 설정 조회/수정 |
| `routers/notifications.py` | Email/Slack 알림 설정, 테스트 발송, 이력 |
| `routers/audit.py` | 감사 로그 조회 |
| `services/energy_service.py` | 에너지 집계/분류 로직 |
| `services/report_service.py` | 보고서 생성 엔진 (JSON/CSV/Excel/PDF) |
| `services/notification_service.py` | Email(SMTP)/Slack(Webhook) 발송 서비스 |
| `services/audit_service.py` | 감사 기록 저장/조회 |
| `models/responses.py` | Pydantic 응답 모델 (OpenAPI 문서용) |

**Server C** (`platform/server-c/app/`):
| 파일 | 역할 |
|------|------|
| `engine.py` | 시뮬레이션 엔진 (열역학+시나리오+고장 통합) |
| `scenarios.py` | ScenarioManager — 7종 프리셋 + 커스텀 |
| `fault_injection.py` | FaultManager — 6종 고장 유형 |
| `thermodynamics.py` | ThermalModel — 1차 에너지 밸런스 + PI 제어 |
| `weather.py` | WeatherProvider — 서울 TMY 12개월 기상 데이터 |

**Server B** (`platform/server-b/app/`):
| 파일 | 역할 |
|------|------|
| `command_queue.py` | CommandQueue — FIFO, 지수 백오프 재시도 |

**Server D** (`platform/server-d/app/`):
| 파일 | 역할 |
|------|------|
| `quality.py` | DataQualityChecker — 범위/변화율/±3σ 이상치 |
| `downsampling.py` | InfluxDB Flux 다운샘플링 Task |
| `routers/export.py` | 데이터 내보내기 (CSV/JSON) |

### 주의사항 (다음 세션 필독)

1. **OpenAI API 키 미설정**: `.env`의 `OPENAI_API_KEY=your-api-key-here`를 실제 키로 교체해야 LLM 채팅(`/chat`) 동작
2. **Neo4j 외부 컨테이너**: `neo4j-bees`는 docker-compose에 포함되지 않음, 별도 `docker start neo4j-bees` 필요
3. **Neo4j TTL 임포트**: 컨테이너 재생성 시 n10s 설정 + TTL 재임포트 필요 (아래 체크리스트 참조)
4. **Server C Neo4j 로딩 순서**: Neo4j에 데이터가 있어야 84장비 164포인트 시뮬레이션. 없으면 AHU_5F 1대 폴백
5. **Badge vs Button variant**: Badge에는 `"danger"`, Button에는 `"destructive"` 사용 (동일하지 않음)
6. **장비 ID 형식**: API는 `bldg:AHU_UFAD_11` 형태, Neo4j 내부는 `https://example.org/gec-b#AHU_UFAD_11` URI

### 플랫폼 기동 체크리스트 (새 세션 시작 시)
```bash
cd /Users/mckim64/Projects/SAMSUNG/BEES-Ontology

# 1. Neo4j 시작 (외부 컨테이너)
docker start neo4j-bees

# 2. Neo4j 데이터 확인 (0이면 재임포트 필요)
curl -s -u neo4j:bees2024 http://localhost:7476/db/neo4j/tx/commit \
  -H 'Content-Type: application/json' \
  -d '{"statements":[{"statement":"MATCH (n) WHERE n.uri STARTS WITH \"https://example.org/gec-b#\" RETURN count(n) as cnt"}]}' \
  | python3 -c "import json,sys; print(f'Neo4j 노드: {json.load(sys.stdin)[\"results\"][0][\"data\"][0][\"row\"][0]}개')"

# ※ Neo4j 데이터가 0이면 아래 재임포트 실행:
# curl -s -u neo4j:bees2024 http://localhost:7476/db/neo4j/tx/commit \
#   -H 'Content-Type: application/json' \
#   -d '{"statements":[
#     {"statement":"MATCH (n) DETACH DELETE n"},
#     {"statement":"CALL n10s.graphconfig.init({handleVocabUris: \"MAP\", handleMultival: \"ARRAY\", handleRDFTypes: \"LABELS\", applyNeo4jNaming: false})"}
#   ]}'
# curl -s -u neo4j:bees2024 http://localhost:7476/db/neo4j/tx/commit \
#   -H 'Content-Type: application/json' \
#   -d '{"statements":[{"statement":"CREATE CONSTRAINT n10s_unique_uri IF NOT EXISTS FOR (r:Resource) REQUIRE r.uri IS UNIQUE"}]}'
# docker cp ontology/GEC_B_Ontology.ttl neo4j-bees:/tmp/GEC_B_Ontology.ttl
# curl -s -u neo4j:bees2024 http://localhost:7476/db/neo4j/tx/commit \
#   -H 'Content-Type: application/json' \
#   -d '{"statements":[{"statement":"CALL n10s.rdf.import.fetch(\"file:///tmp/GEC_B_Ontology.ttl\", \"Turtle\")"}]}'

# 3. Docker Compose 전체 기동 (9서비스 + 시뮬레이션 자동 시작)
docker compose up -d

# 4. 서비스 안정화 대기 (15초)
sleep 15

# 5. 상태 확인
docker compose ps
curl -s http://localhost:8010/health
curl -s http://localhost:8012/health | python3 -c "import json,sys; d=json.load(sys.stdin); sim=d['simulation']; print(f'시뮬레이션: {sim[\"status\"]}, 장비: {sim[\"device_count\"]}, 포인트: {sim[\"point_count\"]}, Neo4j: {sim[\"neo4j_loaded\"]}')"
curl -s http://localhost:8010/api/stream/snapshot | python3 -c "import json,sys; d=json.load(sys.stdin); print(f'SSE 포인트: {len(d.get(\"points\",{}))}개, 디바이스: {len(d.get(\"devices\",{}))}개')"

# ※ Neo4j가 늦게 로딩되었으면 Server C 재시작:
# docker compose restart server-c && sleep 15

# 6. 브라우저 열기
open http://localhost:3000
```

### 검증 명령 (전체 서비스 + Phase 4 API)
```bash
# 서버 헬스체크
curl -s http://localhost:8010/health    # Server A
curl -s http://localhost:8011/health    # Server B
curl -s http://localhost:8012/health    # Server C (simulation status 포함)
curl -s http://localhost:8013/health    # Server D

# Phase 4 신규 API
curl -s http://localhost:8010/api/energy/realtime           # 에너지
curl -s http://localhost:8010/api/alarms/stats              # 알람 통계
curl -s http://localhost:8010/api/maintenance/work-orders   # 유지보수
curl -s http://localhost:8010/api/reports/presets            # 보고서 4종
curl -s http://localhost:8010/api/settings                  # 시스템 설정
curl -s "http://localhost:8010/api/equipment/bldg:AHU_UFAD_11"  # 장비 상세
curl -s http://localhost:8012/scenarios                     # 시나리오 7종
curl -s http://localhost:8012/faults/types                  # 고장 유형 6종
curl -s http://localhost:8011/command-queue                 # 명령 큐
curl -s "http://localhost:8013/export?format=csv&start=-1h" # 데이터 내보내기
```

---

## 14. Phase 11 — 디지털 트윈 플랫폼 Phase 3 (2026.02.13)

### 14.1 개요

Phase 2 완료 후 11개 기능 항목을 5명의 병렬 에이전트(infra-ops, alarm-eng, frontend-1, frontend-2, platform-eng)로 동시 구현.
A2(OpenAI API 키 연동)를 제외한 A~D 전 카테고리 완료.

### 14.2 구현 완료 항목 (11/11)

#### A. 인프라/백엔드 (3개)

| # | 항목 | 담당 | 신규/수정 파일 |
|---|------|------|---------------|
| A1 | **시뮬레이션 자동 시작** | infra-ops | `server-c/app/config.py` (AUTO_START_SIMULATION), `main.py` (lifespan 자동시작) |
| A3 | **알람 시스템 — Server C** | alarm-eng | `server-c/app/alarm_checker.py` (신규, AlarmChecker 클래스), `engine.py` (알람 체크 통합) |
| A3 | **알람 시스템 — Server A + D** | alarm-eng | `server-a/backend/app/routers/alarm.py` (신규, 3 API), `mqtt_service.py` (알람 캐시), `server-d/app/mqtt_worker.py` (알람 구독/저장), `routers/admin.py` (acknowledge) |
| A4 | **Grafana 대시보드** | infra-ops | `platform/grafana/` (프로비저닝 3파일), `docker-compose.yml` (grafana 서비스), `.env` (GRAFANA_PORT) |

#### B. 프론트엔드 (3개)

| # | 항목 | 담당 | 신규/수정 파일 |
|---|------|------|---------------|
| B5 | **온톨로지 그래프 상호작용** | frontend-1 | `ontology/page.tsx` (클릭 하이라이트, 더블클릭 이웃 확장, 검색+포커스) |
| B6+B8 | **토폴로지 실시간 + 반응형** | frontend-1 | `topology/page.tsx` (SSE 실시간 센서값), `sidebar.tsx` (3단계 반응형), `header.tsx`, 전 페이지 반응형 그리드 |
| B7 | **시계열 차트 /history** | frontend-2 | `app/history/page.tsx` (신규, recharts 멀티라인), `sidebar.tsx` (메뉴 추가), `lib/api.ts` (집계 파라미터) |

#### C. 플랫폼 (4개)

| # | 항목 | 담당 | 신규/수정 파일 |
|---|------|------|---------------|
| C9 | **BACnet/IP 어댑터** | platform-eng | `server-b/app/bacnet_adapter.py` (신규, BACnetSimulator), `main.py` (5 API) |
| C10+C12 | **데이터 보존 + 스케줄** | platform-eng | `influxdb/tasks/downsample.flux`, `server-d/app/retention.py`, `server-a/backend/app/services/postgres_service.py`, `routers/schedule.py` (CRUD 5 API) |
| C11 | **JWT 인증** | platform-eng | `services/auth_service.py`, `dependencies.py`, `routers/auth.py` (4 API), `app/login/page.tsx`, `lib/api.ts` (401 리다이렉트) |

#### D. 품질 (1개)

| # | 항목 | 담당 | 신규/수정 파일 |
|---|------|------|---------------|
| D | **온톨로지 품질 + 알람 UI** | platform-eng | `scripts/ontology_quality_check.py` (5가지 검증), `components/alarm-banner.tsx`, `components/client-layout.tsx`, `app/layout.tsx` |

### 14.3 Docker Compose 변경

Phase 3부터 **9개 서비스** (Grafana 추가):
```
influxdb, postgres, mosquitto, grafana (신규, 포트 3001),
server-a-backend, server-a-frontend, server-b, server-c, server-d
+ Neo4j 외부 컨테이너 = 총 10개 서비스
```

### 14.4 프론트엔드 변경

8개 페이지 (2개 추가):
```
/ (대시보드+알람카드), /monitoring, /control (JWT 인증),
/ontology (그래프 상호작용 강화), /topology (SSE 실시간+반응형),
/chat, /history (신규), /login (신규)
```

전 페이지 3단계 반응형 (모바일/태블릿/데스크탑), 알람 배너 글로벌 표시.

### 14.5 API 변경

Server A 신규 엔드포인트:
- `GET /api/alarms` — 활성 알람 목록
- `GET /api/alarms/history` — 알람 이력 (Server D 프록시)
- `POST /api/alarms/{id}/acknowledge` — 알람 확인
- `POST /api/auth/login` — JWT 로그인
- `POST /api/auth/register` — 사용자 등록
- `GET /api/auth/me` — 현재 사용자
- `POST /api/auth/logout` — 로그아웃
- `GET /api/schedules` — 스케줄 목록
- `POST /api/schedules` — 스케줄 생성
- `GET /api/schedules/{id}` — 스케줄 상세
- `PUT /api/schedules/{id}` — 스케줄 수정
- `DELETE /api/schedules/{id}` — 스케줄 삭제

Server B 신규 엔드포인트:
- `GET /bacnet/devices` — BACnet 디바이스 목록
- `GET /bacnet/devices/{id}/objects` — BACnet 오브젝트 목록
- `GET /bacnet/read` — BACnet 읽기
- `POST /bacnet/write` — BACnet 쓰기
- `POST /bacnet/discover` — BACnet 디스커버리

### 14.6 Phase 3 미완료 항목

- **A2: OpenAI API 키 연동 + E2E 테스트** — 사용자 의도적 제외 (실제 API 키 필요)

---

## 15. Phase 4 — 시뮬레이션 고도화 + 프론트엔드 확장 (2026.02.17)

### 15.1 개요

Phase 3 완료 후, 시뮬레이션 고도화(시나리오/고장 주입/열역학 모델링)와 프론트엔드 신규 페이지 8개를 추가.
팀 기반 병렬 개발로 4명 에이전트가 동시 작업.

### 15.2 Server C 고도화 (simulation-eng)

- **시나리오 관리**: 6개 프리셋(normal, emergency, peak_load, summer, winter, night_weekend) + 커스텀 시나리오 생성
- **고장 주입 시스템**: 6개 고장 유형(stuck_damper, sensor_stuck, sensor_drift, comm_loss, degraded_performance, valve_leak), 실시간 주입/해제
- **HVAC 열역학 모델링**: 외기온/습도/태양복사 기반 열부하 계산, 냉난방 응답 시뮬레이션
- **기상 데이터 제공**: 계절별 외기 프로필, 일주기 패턴

### 15.3 백엔드 API 확장 (backend-api)

Server A 신규 엔드포인트:
- `GET /api/equipment/{id}` — 장비 상세 (Neo4j 연동)
- `GET /api/equipment/{id}/performance` — 장비 성능 (InfluxDB)
- `GET /api/equipment/{id}/alarms` — 장비 알람 이력
- `GET /api/alarms/stats` — 심각도별 알람 통계
- `POST /api/alarms/{id}/suppress` — 알람 억제
- `GET /api/alarms/suppressed` — 억제 알람 목록
- `DELETE /api/alarms/suppress/{id}` — 억제 해제
- `GET /api/energy/realtime` — 실시간 전력
- `GET /api/energy/profile` — 에너지 프로파일
- `GET /api/energy/breakdown` — 에너지 내역 (시스템별/층별)
- `GET /api/energy/comparison` — 기간 비교
- `GET /api/energy/eui` — EUI 지표
- `GET/POST /api/maintenance/work-orders` — 작업 지시 CRUD
- `GET /api/maintenance/calendar` — 유지보수 캘린더
- `GET /api/reports/presets` — 보고서 프리셋
- `POST /api/reports/generate` — 보고서 생성
- `GET /api/reports/history` — 보고서 이력
- `GET /api/users` — 사용자 관리 CRUD
- `GET/PUT /api/settings` — 시스템 설정
- `GET /api/audit-log` — 감사 로그
- `GET /data/export/{format}` — 데이터 내보내기 (CSV/JSON)

Server B 확장:
- `GET /command-queue` — 명령 큐 상태 (실패 명령 자동 재시도)

### 15.4 인프라 품질 (infra-quality)

- **데이터 품질 체커**: Server D mqtt_worker 통합, 3단계 검증 (범위/변화율/통계 이상치 ±3σ)
- **명령 큐잉**: Server B asyncio.Queue, 지수 백오프 재시도 (1s→2s→4s→8s→16s), TTL 30분
- **감사 로깅**: PostgreSQL audit_log 테이블, 제어 명령 IP 추적
- **InfluxDB 다운샘플링**: Flux 태스크 (5분 평균 → 30d, 1시간 평균 → 365d)

### 15.5 프론트엔드 확장 (frontend-2 + infra-quality)

기존 8페이지 → **18페이지** (10개 신규: Phase 4에서 8개 + Phase 4.5에서 2개):
```
Phase 4 신규 (8개):
/alarms              — 알람 관리 (심각도 카운트, 필터, 확인 모달, 억제 모달, 상세 패널)
/alarms/history      — 알람 이력 아카이브 (CSV 다운로드, 억제)
/energy              — 에너지 분석 대시보드
/maintenance         — 유지보수 관리 (작업 지시 CRUD)
/reports             — 보고서 생성/이력
/settings            — 시스템 설정
/settings/users      — 사용자 관리 (CRUD)
/monitoring/[equipmentId] — 장비 상세 모니터링 (실시간 게이지, 트렌드, 성능, 연결 관계, 알람)

Phase 4.5 신규 (2개):
/scenarios           — 시나리오 관리 (Server C 시나리오 로드 + 고장 주입/해제)
/data-quality        — 데이터 품질 (Server D 품질 통계 + 포인트 현황 테이블)
```

사이드바 12개 메뉴: 대시보드, 모니터링, 제어, 온톨로지, 토폴로지, 시계열 이력, AI 채팅, 알람 관리, 에너지 분석, 유지보수, 보고서, 설정

### 15.6 lib/api.ts 추가 함수

총 60+ API 함수: 기존 Phase 3 + 신규 Phase 4 포함.
주요 신규: getAlarmStats, suppressAlarm, getSuppressedAlarms, unsuppressAlarm, getEquipmentDetail, getEquipmentPerformance, getEquipmentAlarms, getAuditLog, getEnergyRealtime, getEnergyProfile, getEnergyBreakdown, getEnergyComparison, getEnergyEUI, getWorkOrders, createWorkOrder, getMaintenanceCalendar, getReportPresets, generateReport, getUsers, createUser, updateUser, deleteUser, getSettings, updateSettings

### 15.7 Docker 빌드 테스트 및 검증 (2026.02.17)

**빌드 오류 수정 2건:**
1. `Badge variant="destructive"` → `"danger"` — Badge 컴포넌트에 destructive variant 없음 (Button에만 있음)
2. `Record<string, string | number>[]` → `MultiLineData[]` — 타입 명시 (`monitoring/[equipmentId]/page.tsx`)

**전체 서비스 기동 검증 (9/9 정상):**
| 서비스 | 상태 |
|--------|------|
| Frontend (3000) | HTTP 200 |
| Server A (8010) | healthy |
| Server B (8011) | healthy |
| Server C (8012) | healthy |
| Server D (8013) | healthy |
| Mosquitto (1885) | healthy |
| InfluxDB (8088) | healthy |
| PostgreSQL (5434) | healthy |
| Grafana (3001) | 200 |

**프론트엔드 18개 페이지 전체 HTTP 200 확인:**
/, /monitoring, /control, /alarms, /alarms/history, /energy, /maintenance, /reports, /settings, /settings/users, /ontology, /topology, /chat, /history, /login (+ /monitoring/[equipmentId] 동적 라우트)

**신규 API 검증 결과:**
- 에너지 API (realtime/breakdown/eui): 정상 응답
- 유지보수 API (work-orders CRUD): 정상 응답
- 보고서 API (presets 4종): 정상 응답
- 설정 API (빌딩명/시간대/단위): 정상 응답
- 감사 로그 API: 정상 응답
- 알람 통계/억제 API: 정상 응답
- 시나리오 로드 (peak_load → normal): 성공
- 고장 주입 (sensor_stuck) → 해제: 성공
- 명령 큐 상태 조회: 정상 응답
- 데이터 내보내기 (CSV): HTTP 200

**커밋:** `ad9e27f` — 40 files changed, +8,907 / -100 lines

### 15.8 Phase 4 최종 산출물 요약

| 카테고리 | 수량 |
|---------|------|
| 신규 파일 | 26개 |
| 수정 파일 | 14개 |
| 신규 코드 | ~8,900줄 |
| 프론트엔드 페이지 | 8 → 18개 |
| API 엔드포인트 | ~30 → 57+개 |
| 시뮬레이션 시나리오 | 7종 (프리셋 6 + 커스텀) |
| 고장 주입 유형 | 6종 |
| 설계서 대비 진행률 | ~95% |

**잔여 (~5%):** 이메일/SMS 알림 채널, 정기 보고서 자동 발송 등 외부 서비스 연동

### 15.9 Phase 4.5 — 버그 수정 + 신규 2페이지 (2026.02.17)

Phase 4 빌드 후 부분 동작 이슈 6건을 수정하고 프론트엔드 2페이지를 추가.

**버그 수정 (4건):**
1. **에너지 분석 kW 스케일링** — 에뮬레이터 정규화 값(0~100)을 장비 타입별 실제 kW로 변환, InfluxDB 빈 버킷 쿼리 수정 (`energy_service.py`, `energy.py`)
2. **유지보수 캘린더 500 오류** — asyncpg 날짜 타입 변환 (`maintenance.py`) + equipment_metadata Neo4j 시드 (`neo4j_loader.py`)
3. **Server B 장비 로딩 재시도** — Neo4j 연결 5회 재시도(10초 간격) + `/devices/reload` 수동 갱신 API (`server-b/main.py`)
4. **Grafana InfluxDB 인증** — 데이터소스 UID `influxdb-bees` 명시 + HTTP Authorization 헤더 추가 (`influxdb.yml`, `bees-overview.json`)

**신규 페이지 (2건):**
5. **`/scenarios`** — Server C 시나리오 프리셋 로드 + 고장 주입/해제 UI (`app/scenarios/page.tsx`)
6. **`/data-quality`** — Server D Historian 상태, 품질 통계, 포인트 현황 테이블 (`app/data-quality/page.tsx`)

**수정 파일:** 12개 modified + 2개 new = 14 files, +1,449 / -107 lines
**커밋:** `61a1101` feat: Phase 4.5 버그 수정

---

### Phase 5 완료 내역 + 잔여 작업

#### Phase 5 완료 항목 (2026.02.18)
| # | 기능 | 상태 | 커밋 |
|:-:|------|:----:|------|
| #1 | 알림 채널 확장 (Email/Slack) | ✅ | `f4d97fa` |
| #3 | Push 알림 (Browser Notification API) | ✅ | `0e580dc` |
| #4 | 다국어 i18n (한/영 전환) | ✅ | `0e580dc` |
| #5 | 대시보드 위젯 D&D (react-grid-layout) | ✅ | `0e580dc` |
| #6 | 장비 상세 링크 개선 | ✅ | `9860ffc` |
| #7 | 보고서 PDF/Excel 생성 | ✅ | `f8d7349` |
| #8 | WebSocket 실시간 채널 | ✅ | `0e580dc` |
| #15 | API 문서 정비 (Pydantic response_model) | ✅ | `0e580dc` |
| #16 | 환경 분리 (.env.example, BaseSettings) | ✅ | `0e580dc` |

#### 일시 중단 항목
| # | 기능 | 사유 |
|:-:|------|------|
| #2 | 정기 보고서 자동 발송 | 스케줄러/외부 서비스 연동 필요 |
| #13 | 테스트 코드 | 기능 구현 완료 후 진행 |
| #14 | CI/CD | 기능 구현 완료 후 진행 |

#### 온톨로지 관련 (내부 데이터 확보 시)
- 실 BMS 연동 시 InfluxDB 집계 활성화
- BEMS 데이터 → 실측 에너지 값으로 추정값 교체

**온톨로지 수정 시 주의사항:**
- **TTL 수정 후 반드시 rdflib 파싱 검증** (구문 오류 방지)
- **신뢰도 태깅 유지**: 새 데이터 추가 시 `bees:hasConfidence` 반드시 기재
- **B동 범위 유지**: 새 인스턴스는 `bldg:GEC_Tower_B` 또는 그 하위에 연결
- **`bees:` 네임스페이스**: 커스텀 클래스/속성은 반드시 `bees:` 접두사 사용
- **Neo4j 동기화**: TTL 변경 후 Neo4j 재임포트 필요 (섹션 11.7 참조)

### 핵심 기술 결정 사항 (다음 세션 참고용)

| 결정 | 이유 | 파일 |
|------|------|------|
| SSE polling 방식 (`_event_counter` + `threading.Lock`) | Python 3.12에서 `asyncio.Event` 크로스스레드 불가 | `mqtt_service.py` |
| n10s URI 필터: `n.uri STARTS WITH 'https://example.org/gec-b#'` | n10s가 `_GraphConfig`, `Class`, `Property` 등 내부 노드 생성 | `neo4j_service.py` |
| Neo4j 외부 컨테이너 (docker-compose 미포함) | 기존 `neo4j-bees` 컨테이너 재활용, volume 데이터 보존 | `docker-compose.yml` |
| `NEXT_PUBLIC_*` 빌드 시 bake | Next.js standalone 모드, 런타임 변경 불가 | `frontend/Dockerfile` |
| Cytoscape.js `as any` 캐스팅 | strict TypeScript + Cytoscape.js 타입 불일치 | `ontology/page.tsx` |
| InfluxDB 3단계 폴백 | InfluxDB 직접 → Server D 프록시 → MQTT 캐시 | `history.py` |
| InfluxDB 스키마: `sensor_data` / `point_id` tag / `value` field | Server D `mqtt_worker.py`와 동일 스키마 공유 | `influxdb_service.py` |
| Badge `"danger"` vs Button `"destructive"` | shadcn/ui 커스텀 — Badge와 Button의 variant 이름이 다름 | `badge.tsx`, `button.tsx` |
| 장비 상세 URI 변환 | API `bldg:XXX` ↔ Neo4j `https://example.org/gec-b#XXX` | `routers/equipment.py` |
| 열역학 1차 모델 + PI 제어 | Zone_Air_Temperature만 적용, 나머지 센서는 기존 sine+noise | `thermodynamics.py`, `engine.py` |
| next-intl "no-prefix" 모드 | URL 변경 없이 cookie 기반 locale 전환 (ko 기본) | `middleware.ts`, `i18n/request.ts` |
| react-grid-layout ResponsiveGridLayout | 대시보드 위젯 D&D, localStorage 레이아웃 저장 | `dashboard-grid.tsx` |
| WebSocket + SSE 병행 (`useRealtimeData`) | WS 우선, 실패 시 SSE 폴백 — 기존 SSE 클라이언트 깨지지 않음 | `ws.ts`, `sse.ts`, `stream.py` |
| pydantic-settings BaseSettings | `os.getenv()` → 타입 안전 환경변수, `.env` 자동 로드 | `config.py` (Server A, C) |
| fpdf2 + NanumGothic | PDF 한국어 지원 — Docker `fonts-nanum` 설치, Helvetica 폴백 | `report_service.py`, `Dockerfile` |

### 15.10 리포지토리 정리 (2026.02.17)

- **AGENTS.md 심볼릭 링크 삭제** — CLAUDE.md를 가리키는 심볼릭 링크로, GitHub Copilot 미사용으로 불필요. 삭제하여 리포지토리 정리.
- **커밋:** `efd6dbb` chore: AGENTS.md 심볼릭 링크 삭제 — CLAUDE.md 중복, 미사용

### 15.11 Phase 10: 온톨로지 확장 (v2.0.1 → v2.1.0, 2026.02.17)

Agent Team 병렬 처리로 4개 TTL 프래그먼트를 생성하고 메인 온톨로지에 병합.

#### 확장 내역

| 카테고리 | 내용 | 수량 |
|----------|------|:----:|
| **Room 세분화** | 층별 개별 Room 인스턴스 (회의실, 탕비실, 인쇄실, 화장실, 주차 구역 등) | 162개 |
| **BMS Point 정밀 모델링** | 장비별 신규 센서/명령/설정값 (AHU 풍량/습도/밸브, 칠러 COP, 펌프 유량 등) | 252개 |
| **장비 메타데이터** | 제조사, 모델번호, 시리얼, 설치일, 보증만료, 정격전력 (OWL 속성 정의 포함) | 45+장비 |
| **에너지 실측 전환** | EnergyBreakdown estimated→confirmed, 월별 에너지 프로파일 12개, GHG 확정 | 30+트리플 |
| **관계 대칭 보완** | hasPart↔isPartOf 467쌍 + feeds↔isFedBy 179쌍 자동 생성 | 646트리플 |

#### 결과 통계

| 항목 | v2.0.1 | v2.1.0 | 증감 |
|------|:------:|:------:|:----:|
| 트리플 | 5,756 | 9,789 | +4,033 |
| 인스턴스 | 845 | 1,272 | +427 |
| 라인 수 | ~6,830 | ~11,600 | +4,770 |
| hasPart/isPartOf | 258/418 | 820/820 | 완전 대칭 |
| feeds/isFedBy | 169/172 | 260/260 | 완전 대칭 |
| isPointOf | 425 | 692 | +267 |

#### 기술 상세
- **Room 인스턴스**: B4F~RF 17개 층, 오피스층(5F~15F) 14개/층 패턴, VIP/임원 층 차별화
- **BMS 포인트**: AHU(99), DOAS(36), Chiller(12), Boiler(15), CT(15), Pump(11), FCU(12), EV(20), Zone(50), 기타(12)
- **메타데이터**: Carrier, 경동나비엔, Grundfos, 현대엘리베이터, ABB, Belimo 등 실제 제조사
- **에너지**: 2024년 월별 소비 프로파일, 냉방/난방/조명/환기/급탕 확정 내역
- **검증**: rdflib 파싱 성공, hasPart↔isPartOf 완전 대칭, feeds↔isFedBy 완전 대칭
- **Neo4j**: n10s 전체 재임포트 완료 (9,809 트리플 로드)

## 16. Phase 5 — 플랫폼 완성 (2026.02.18)

### 16.1 개요

Phase 4.5 이후 잔여 기능 9개를 Agent Teams 5개 병렬 실행으로 완성.
56개 파일 변경, +6,219/-1,106 라인. 프론트엔드 20개 페이지 전체 빌드 성공.

### 16.2 #1 알림 채널 확장 — Email/Slack (커밋 `f4d97fa`)

| 파일 | 변경 내용 |
|------|-----------|
| `routers/notifications.py` (new) | GET/PUT 설정, POST 테스트 발송, GET 이력 |
| `services/notification_service.py` (new) | SMTP 이메일, Slack Webhook 발송, PostgreSQL 이력 저장 |
| `main.py` | notifications 라우터 등록 |
| `config.py` | SMTP_*, SLACK_WEBHOOK_URL 환경변수 추가 |
| `settings/notifications/page.tsx` (new) | Email/Slack 설정 UI, 테스트 발송, 이력 테이블 |
| `settings/page.tsx` | 알림 설정 링크 카드 추가 |

### 16.3 #7 보고서 PDF/Excel 생성 (커밋 `f8d7349`)

| 파일 | 변경 내용 |
|------|-----------|
| `services/report_service.py` | `_to_xlsx()` openpyxl 기반, `_to_pdf()` fpdf2 기반 추가 |
| `routers/reports.py` | xlsx/pdf MIME 타입 + StreamingResponse |
| `reports/page.tsx` | FORMAT_OPTIONS에 Excel/PDF 추가 |
| `Dockerfile` | `fonts-nanum` 한국어 폰트 패키지 |
| `requirements.txt` | `openpyxl>=3.1.0`, `fpdf2>=2.7.0` 추가 |

### 16.4 #3 Push 알림 + #8 WebSocket (커밋 `0e580dc`)

**WebSocket (#8)**:
- `stream.py`: `@router.websocket("/ws")` 엔드포인트 추가
- `mqtt_service.py`: `_ws_clients: set`, `register_ws_client()`, `_broadcast_ws()` — MQTT 스레드에서 asyncio 메인 루프로 `call_soon_threadsafe` 브릿지
- `lib/ws.ts` (new): `useWebSocket()` 훅 — 자동 재연결, useSSE와 동일 인터페이스
- `lib/sse.ts`: `useRealtimeData()` 통합 훅 — WS 우선, SSE 폴백

**Push 알림 (#3)**:
- `lib/notifications.ts` (new): `requestNotificationPermission()`, `showAlarmNotification()`
- `components/alarm-banner.tsx`: 알람 수신 시 Browser Notification 트리거, 벨 토글 버튼

### 16.5 #4 다국어 i18n (커밋 `0e580dc`)

| 파일 | 변경 내용 |
|------|-----------|
| `messages/ko.json` (new) | 한국어 메시지 640줄, 600+ 키, 19 네임스페이스 |
| `messages/en.json` (new) | 영어 메시지 (동일 구조) |
| `i18n/request.ts` (new) | next-intl 서버 설정, cookie 기반 locale |
| `middleware.ts` (new) | Accept-Language 감지, locale cookie, no-prefix 모드 |
| `next.config.js` | `createNextIntlPlugin` 래퍼 적용 |
| `layout.tsx` | `NextIntlClientProvider` + `getMessages()` |
| `header.tsx` | `LanguageSwitcher` 드롭다운 (한국어/English) |
| `sidebar.tsx` | 네비게이션 라벨 i18n |
| 20개 page.tsx | `useTranslations()` 적용 (대시보드 포함) |

### 16.6 #5 대시보드 위젯 D&D (커밋 `0e580dc`)

| 파일 | 변경 내용 |
|------|-----------|
| `components/dashboard/dashboard-grid.tsx` (new) | ResponsiveGridLayout 래퍼, localStorage 레이아웃, 편집/잠금 모드 |
| `components/dashboard/widget-kpi.tsx` (new) | KPI 4카드 (활성장비, 온도, 알람, 시뮬레이션) |
| `components/dashboard/widget-chart.tsx` (new) | AHU 5F 급기온도 실시간 차트 |
| `components/dashboard/widget-equipment.tsx` (new) | 장비 상태 리스트 |
| `components/dashboard/widget-alarms.tsx` (new) | 최근 알람 테이블 |
| `components/dashboard/widget-sensors.tsx` (new) | 센서 데이터 테이블 |
| `app/page.tsx` | DashboardGrid dynamic import로 재구성 |
| `package.json` | `react-grid-layout`, `@types/react-grid-layout` 추가 |

### 16.7 #15 API 문서 정비 (커밋 `0e580dc`)

| 서버 | 변경 내용 |
|------|-----------|
| Server A | `models/responses.py` Pydantic 응답 모델 4개, dashboard/control/stream에 response_model 적용, openapi_tags 17개 |
| Server B | Pydantic 모델 7개, 11개 엔드포인트 response_model 적용 |
| Server C | `Neo4jStatusResponse` 모델, openapi_tags 6개 |
| Server D | openapi_tags 4개 |

### 16.8 #16 환경 분리 (커밋 `0e580dc`)

| 파일 | 변경 내용 |
|------|-----------|
| `.env.example` (new) | 전체 42개 변수 템플릿, 비밀값 `changeme` placeholder |
| Server A `config.py` | `os.getenv()` → `pydantic_settings.BaseSettings` 마이그레이션 |
| Server C `config.py` | 동일 BaseSettings 패턴 |
| Server C `Dockerfile` | 하드코딩 ENV 6줄 제거 |
| Server C `requirements.txt` | `pydantic-settings>=2.1.0` 추가 |

### 16.9 검증 결과

- **프론트엔드 빌드**: 21 routes (20 페이지 + _not-found) 전체 성공
- **Server A config**: BaseSettings 정상, 모듈 레벨 변수 하위 호환
- **Server A models**: Pydantic 응답 모델 import 정상
- **Server C config**: BaseSettings 정상 (`settings.MQTT_BROKER` 패턴)
- **Excel**: 5,761 bytes XLSX 생성 (openpyxl, 요약+데이터 2시트)
- **PDF**: 12,479 bytes PDF 생성 (fpdf2, NanumGothic 한국어)

### Git 커밋 이력 (최근)
```
51f9023 chore: 리포지토리 정리 — .gitignore 보강, 404 페이지, 통계 수정
0e3f382 docs: 프로젝트 결과물 요약 v1.4 — Phase 5 + 온톨로지 v2.1.0 전체 반영
3fa2091 docs: next.md 잔여 작업 후순위 정리
01de5b4 docs: history.md/CLAUDE.md/next.md Phase 5 완료 반영
3c95aab docs: history.md 리포지토리 정리 반영 + next.md 다음 작업 계획 작성
0e580dc feat: Phase 5 — 6개 기능 병렬 구현 (#3 #4 #5 #8 #15 #16)
f8d7349 feat: #7 보고서 PDF/Excel 생성 — openpyxl/fpdf2 기반 다운로드 지원
f4d97fa feat: #1 알림 채널 확장 — Email/Slack 알림 시스템 구현
b2cab5f feat: Phase 10 온톨로지 확장 v2.1.0 — Room 162, BMS Point 252, 메타데이터, 에너지 실측
9860ffc feat: #6 장비 상세 링크 개선 — 모니터링 장비 그리드, 대시보드/토폴로지 링크 추가
efd6dbb chore: AGENTS.md 심볼릭 링크 삭제 — CLAUDE.md 중복, 미사용
4ce06cc docs: history.md Phase 4.5 내역 반영 — 18페이지, 버그수정 6건, 신규 섹션 추가
61a1101 feat: Phase 4.5 버그 수정 — 에너지 스케일링, 유지보수 캘린더, Grafana 인증, 시나리오/데이터품질 페이지 추가
6374cf3 fix: passlib/bcrypt 호환성 오류 수정 — 로그인 500 에러 해결
bddd2b4 docs: history.md Phase 4 빌드 검증 결과 및 최종 산출물 요약 추가
ad9e27f feat: 디지털 트윈 플랫폼 Phase 4 완료 — 시뮬레이션 고도화, 신규 7페이지, 30+ API
94e6062 feat: 디지털 트윈 플랫폼 Phase 3 완료 — 알람, Grafana, JWT, BACnet, 반응형 등 11개 기능
38b585c feat: 디지털 트윈 플랫폼 Phase 2 완료 — 풀 시뮬레이션, 온톨로지 뷰, LLM 채팅, InfluxDB 직접 연동
```

## 17. 온톨로지 그래프 시각화 대폭 개선 (2026.02.18)

### 17.1 개요

온톨로지 페이지(`/ontology`)의 그래프 시각화를 전면 개선. 기존 200개 랜덤 노드/39개 엣지만 표시되던 문제를 해결하여 전체 1,272 노드/3,495 엣지를 정상 표시하고, Neo4j Browser 스타일의 Cypher 쿼리 UI와 드래그 물리를 추가.

### 17.2 그래프 데이터 표시 수정

**문제**: 프론트엔드 `limit: 200` 고정, 백엔드 ORDER BY 없이 랜덤 노드 200개 반환, 엣지 쿼리가 해당 200개 내부 연결만 조회 → 39개 엣지.

**수정**:
- `neo4j_service.py`: 기본 limit 200→1500, `ORDER BY degree DESC`, `hasPoint` 관계 추가 (7종)
- `ontology.py`: max limit 1000→2000
- `page.tsx`: `nodeLimit` 상태 변수 + UI 버튼 (200/500/1000/전체)
- Cytoscape shape/line-style을 `"data(shape)"`, `"data(lineStyle)"`로 데이터 기반 전환

### 17.3 타입 필터 시 Secondary 노드

**문제**: "장비" 필터 시 27개 장비가 독립적으로 표시 (cross-type 엣지 누락).

**수정**: 타입 필터 시 이웃 노드를 `secondary: true`로 추가 → 작고 흐린 스타일로 표시, 엣지 쿼리에 포함. 장비 필터: 16 edges → 174 edges.

### 17.4 Cypher 쿼리 UI (Neo4j Browser 스타일)

| 파일 | 변경 내용 |
|------|-----------|
| `ontology.py` | `POST /api/ontology/cypher` 엔드포인트 추가 |
| `neo4j_service.py` | `sanitize_cypher()` 쓰기 차단 + 자동 LIMIT 200, `run_cypher_graph()` Cytoscape 포맷 변환 |
| `api.ts` | `CypherResponse` 인터페이스, `runCypherQuery()` 함수 |
| `page.tsx` | 접이식 다크 쿼리 바 (neo4j$ 프롬프트), Ctrl+Enter 실행, 예시 쿼리 칩 4개 |

보안: `CREATE/DELETE/SET/REMOVE/MERGE/DROP/DETACH/CALL` 키워드 차단, LIMIT 미지정 시 자동 200 추가.

### 17.5 드래그 물리 (오프셋 보존 + 반발)

Neo4j Browser 스타일의 부드러운 드래그 물리 구현:
- `grab` 시점에 이웃 노드의 **상대 오프셋(ox, oy)** 저장
- `requestAnimationFrame` 기반 연속 시뮬레이션: velocity + damping(0.85)
- 스프링 target = `dragPos + offset` → 이웃이 원래 간격 유지하며 따라옴
- 이웃 간 최소 거리 40px 반발력 → 겹침 방지

### 17.6 Next.js 404 수정

next-intl middleware가 standalone 모드에서 URL 리라이트하여 전 페이지 404 발생. cookie 기반 단순 middleware로 교체하여 해결.

### 17.7 수정 파일 목록

| 파일 | 변경 |
|------|------|
| `backend/app/routers/ontology.py` | Cypher 엔드포인트 추가 |
| `backend/app/services/neo4j_service.py` | limit/ORDER BY 수정, secondary 노드, sanitize_cypher, run_cypher_graph |
| `frontend/app/ontology/page.tsx` | 노드 제한 UI, 드래그 물리, Cypher 쿼리 바, secondary 스타일 |
| `frontend/lib/api.ts` | CypherResponse, runCypherQuery, GraphNode.secondary |
| `frontend/messages/ko.json`, `en.json` | Cypher 관련 i18n 키 |
| `frontend/middleware.ts` | next-intl → 단순 cookie middleware |
| `frontend/next.config.js` | outputFileTracingIncludes 추가 |
| `frontend/Dockerfile` | messages 디렉토리 COPY 추가 |

## 18. 온톨로지 페이지 버그 수정 10건 (2026.02.18)

### 18.1 개요

섹션 17에서 추가한 온톨로지 그래프 시각화 + Cypher 쿼리 UI를 전면 검토하여 **10개 버그**를 발견·수정.

### 18.2 HIGH 이슈 (3건)

| # | 이슈 | 수정 |
|---|------|------|
| 1 | `dragSimRAF` useEffect cleanup 미정리 → 메모리 누수 | `dragSimRAF`를 useEffect 스코프로 끌어올리고 cleanup에서 `cancelAnimationFrame()` 호출 |
| 2 | `sanitize_cypher()`에서 `CALL` 키워드 차단 → `CALL db.labels()` 등 읽기 전용 프로시저 사용 불가 | `CALL` 제거, `_DANGEROUS_PROCS` 정규식으로 위험 프로시저(`apoc.export`, `dbms.security` 등)만 차단 |
| 3 | Cypher 모드에서 타입 필터 클릭 시 `loadGraph` 재호출 → Cypher 결과 덮어씀 | `useEffect`에 `if (cypherMode) return;` 가드 추가 |

### 18.3 MEDIUM 이슈 (6건)

| # | 이슈 | 수정 |
|---|------|------|
| 4 | LIMIT "전체" = 1500 (백엔드 최대 2000) | 1500 → 2000, 초기값도 2000 |
| 5 | 검색 결과 노드 포커스 실패 — `getElementById(uri)` 호출하지만 노드 id는 `bldg:XXX` | `uriBrickId()` 변환 함수 추가, `getElementById(uriBrickId(result.uri))` |
| 6 | 상세 패널 연결 클릭 포커스 실패 — 동일 원인 | `getElementById(uriBrickId(conn.target_uri))` |
| 7 | 더블클릭 확장 시 `layout.run()` ↔ `dragSimRAF` 동시 실행 → 떨림 | 레이아웃 실행 전 `cancelAnimationFrame(dragSimRAF)` |
| 8 | `rel_types` 7개 하드코딩 → Brick 추가 관계 누락 | `_REL_TYPES` 상수 17개로 확장 (`controls`, `meters`, `serves` 등) |
| 9 | Cypher 엣지 추론에서 관계 딕셔너리 미처리 | `isinstance(val, dict) and "type" in val` 분기 추가 |

### 18.4 LOW 이슈 (1건)

| # | 이슈 | 수정 |
|---|------|------|
| 10 | Cypher 예제 "5F 장비" 쿼리 0건 가능 | `n.uri CONTAINS '_5_'` OR 조건 추가, 라벨 "5층 장비"로 변경 |

### 18.5 수정 파일

| 파일 | 변경 |
|------|------|
| `frontend/app/ontology/page.tsx` | 이슈 1,3,4,5,6,7,10 — dragSimRAF 스코프/클린업, cypherMode 가드, uriBrickId(), LIMIT 2000, 예제 수정 |
| `backend/app/services/neo4j_service.py` | 이슈 2,8,9 — CALL 허용, `_REL_TYPES` 17개, 엣지 추론 보완 |

## 19. 온톨로지 초기 로딩 성능 최적화 (2026.02.18)

### 19.1 개요

온톨로지 페이지 초기 로딩이 4~10초 소요되는 문제 분석·해결. 실측 결과 **백엔드 API는 ~120ms로 빠르고, 프론트엔드 cose-bilkent 레이아웃 엔진이 병목**이었음. 6가지 최적화로 체감 ~1초로 개선.

### 19.2 성능 병목 분석 결과

| 구간 | 이전 | 이후 | 비고 |
|------|------|------|------|
| API 응답 (limit=500) | ~120ms | ~40ms (캐시: ~4ms) | degree 계산 제거 + 인메모리 캐시 |
| Dynamic import | ~300ms | ~150ms | 순차 → Promise.all 병렬화 |
| cose-bilkent 레이아웃 | 3~8초 | ~0.5초 | 초기 500노드 + numIter 800 |
| **총 체감** | **4~10초** | **~1초** | |

### 19.3 수정 내역

| # | 수정 | 파일 |
|---|------|------|
| 1 | cose-bilkent `numIter` 단계별 축소: >2000요소→500, >600→800, 기본 2500 | `page.tsx` |
| 2 | 초기 `nodeLimit` 2000→500 (사용자가 "전체" 선택 시만 2000) | `page.tsx` |
| 3 | Dynamic import `Promise.all` 병렬화 | `page.tsx` |
| 4 | 3단계 로딩 UI: 데이터 로딩→라이브러리 초기화→레이아웃 계산 (i18n 3키 추가) | `page.tsx`, `ko.json`, `en.json` |
| 5 | 백엔드 `ORDER BY degree DESC` + `size()` 계산 제거 | `neo4j_service.py` |
| 6 | 인메모리 캐시 (TTL 5분): `(node_type, floor, limit)` 키 기반 | `neo4j_service.py` |

## 20. 온톨로지 그래프 드래그 물리 — Neo4j 스타일 엣지 스프링 (2026.02.18)

### 20.1 개요

온톨로지 페이지에서 노드 드래그 시 연결 노드의 움직임이 부자연스러운 문제를 Neo4j Browser와 동일한 **엣지 스프링 모델**로 해결. 기존 BFS 기반 가중치 모델에서 발생하던 "관계 없는 노드가 함께 이동하는 버그"도 근본적으로 해결됨.

### 20.2 문제

| # | 문제 | 원인 |
|---|------|------|
| 1 | 드래그 시 관계 없는 노드까지 이동 | BFS가 6-hop(최대 150개)까지 수집하여 간접 연결 노드 포함 |
| 2 | 노드 움직임이 부자연스럽 (평행이동) | delta × weight 고정 비율 모델로 모든 노드가 같은 방향으로 이동 |

### 20.3 시도한 접근 (5회 반복)

| # | 접근 | 결과 | 실패 원인 |
|---|------|------|-----------|
| 1 | Spring+Velocity+Damping | 너무 느림 | half-life ~4.2초 |
| 2 | Lerp (선형 보간) | 2-hop 평행이동 | 모든 노드가 드래그 노드 기준 offset 유지 |
| 3 | Lerp+BFS Chain (부모 추종) | 체인 미작동 | `cy.batch()` 내 position() 반환값 stale |
| 4 | Delta 전파 | 2-hop 이상 미동 | 동일 `cy.batch()` 문제 |
| 5 | 직접 가중치 (dragDelta×weight) | 관계 없는 노드 이동 | BFS 150개 수집 |

### 20.4 최종 해결: Neo4j 스타일 엣지 스프링 모델

Neo4j Browser는 **d3-force** 시뮬레이션 기반으로 동작. 핵심 원리를 Cytoscape.js에 구현:

**동작 원리:**
1. 노드 grab → 직접 연결(1-hop) 노드만 수집 + 각 엣지의 초기 길이(restLength) 저장
2. 매 프레임: 현재 엣지 길이 - restLength = stretch (늘어남)
3. stretch > 0이면 스프링 힘으로 드래그 노드 **방향으로** 당김
4. velocity + damping(0.7)으로 자연스러운 감속
5. 릴리즈 후 ~170ms에 자연 정지

**파라미터:**
```typescript
const SPRING_K = 0.004;   // 스프링 상수 (매우 약함)
const DAMPING = 0.7;      // 감쇠 계수
const MIN_FORCE = 0.1;    // 최소 힘 임계값
```

**이전 모델과의 핵심 차이:**

| | 이전 (직접 가중치) | Neo4j 스타일 (엣지 스프링) |
|--|--|--|
| 대상 | BFS 6-hop, 150개 | **1-hop 직접 연결만** |
| 기준 | dragDelta × weight | **엣지 stretch × SPRING_K** |
| 효과 | 모두 같은 방향 평행이동 | 드래그 노드 **방향으로** 당겨짐 |
| 힘 원천 | 고정 비율 | **늘어난 거리에 비례** |
| 관성 | INERTIA_DECAY=0.85 | **velocity+DAMPING=0.7** |

### 20.5 함께 수정: degree 정렬 복원

섹션 19 성능 최적화에서 `ORDER BY degree DESC`를 제거했으나, 이로 인해 **500개 중 211개(42%)가 고립 노드**로 표시되는 문제 발생. degree 정렬을 복원하여 연결이 많은 노드 우선 로딩, 고립 노드 0으로 해결.

```python
# neo4j_service.py — degree 정렬 복원
WITH n, size([(n)-[]-() | 1]) AS degree
ORDER BY degree DESC
```

### 20.6 수정 파일

| 파일 | 변경 |
|------|------|
| `frontend/app/ontology/page.tsx` | 드래그 물리: BFS 직접 가중치 → Neo4j 스타일 엣지 스프링 모델 |
| `backend/app/services/neo4j_service.py` | `ORDER BY degree DESC` 복원 (고립 노드 211→0) |

## 21. 제어 페이지 "가동" 버그 5건 수정 (2026.02.19)

### 21.1 개요

제어 페이지(`/control`)에서 "가동" 버튼 클릭 시 에뮬레이터(Server C)까지 명령이 전달되지 않는 문제를 3라운드에 걸쳐 5건의 버그를 발견·수정. Agent Teams(tmux split-pane 병렬 분석)로 Frontend → Server A → Server B → Server C 전체 체인을 추적.

### 21.2 발견된 버그 5건

| # | 증상 | 근본 원인 | 에러 코드 |
|---|------|-----------|:---------:|
| 1 | Server B가 userId null 거부 | Server A `control.py:62`에서 `cmd.userId`(None) 전달, JWT의 `current_user.user_id` 미사용 | 422 |
| 2 | Server C가 장비를 찾지 못함 | MQTT 캐시 device_id에 이미 `bldg:` 포함, 프론트에서 `bldg:${deviceId}`로 이중 접두사 (`bldg:bldg:AHU_UFAD_1`) | 404 |
| 3 | 장비 상세 API 직렬화 오류 | `properties(n)` Cypher가 `neo4j.time.Date` 반환 → Pydantic 직렬화 불가 | 500 |
| 4 | "가동" 버튼 무한 스피너 | `fetchJSON`에 타임아웃 없음 + 401 시 `window.location.href` 동기 실행으로 catch/finally 미도달 | - |
| 5 | 로그인 실패 | DB admin 이메일(`admin@samsung-gec.com`)과 프론트엔드 안내(`admin@bees.dev`) 불일치 | 401 |

### 21.3 에러 흐름 (수정 전)

```
Frontend: POST /api/control { deviceId: "bldg:bldg:AHU_UFAD_1", command: "ON" }
    ↓ (미로그인 시)
Server A: 401 Unauthorized → fetchJSON에서 window.location.href 동기 실행 → finally 미도달 → 무한 스피너
    ↓ (로그인 후)
Server A control.py:62: "userId": cmd.userId → None
    ↓
Server B: userId: int = Field(...) → 422 Validation Error
    ↓ (userId 수정 후)
Server B → Server C: POST /devices/bldg:bldg:AHU_UFAD_1/command → 404 Not Found
    ↓ (bldg: 수정 후)
정상 동작: Server C is_active=True, mode=auto
```

### 21.4 수정 내역 (3라운드)

**Round 1 — 422 userId null**
| 파일 | 변경 |
|------|------|
| `server-a/backend/app/routers/control.py:62` | `cmd.userId` → `current_user.user_id` (JWT에서 추출) |
| `server-b/app/main.py:79` | `userId: int = Field(...)` → `int \| None = Field(None, ...)` |
| `server-b/app/main.py:256` | `_save_audit_log(user_id: int)` → `int \| None` |
| `server-b/app/command_queue.py:32` | `user_id: int` → `int = 0` |

**Round 2 — 404 double bldg: + 500 neo4j.time.Date**
| 파일 | 변경 |
|------|------|
| `frontend/app/control/page.tsx:85` | `bldg:${deviceId}` → `deviceId.startsWith("bldg:") ? deviceId : \`bldg:${deviceId}\`` |
| `backend/app/services/neo4j_service.py` | `_convert_neo4j_value()` 헬퍼 추가 (Date/DateTime → ISO 문자열) |
| `backend/app/routers/equipment.py:190` | properties에 `_convert_neo4j_value()` 적용 |

**Round 3 — 무한 스피너 + 인증**
| 파일 | 변경 |
|------|------|
| `frontend/lib/api.ts` | `fetchJSON`에 15초 `AbortController` 타임아웃 추가 |
| `frontend/lib/api.ts` | 401 처리: throw 먼저 → `setTimeout(100ms)` 비동기 리다이렉트 |
| `frontend/app/control/page.tsx` | `handleCommand`에 15초 safety timer (강제 로딩 해제) |
| PostgreSQL DB | admin 이메일 `admin@samsung-gec.com` → `admin@bees.dev` |

### 21.5 수정 파일 요약 (7개)

| 파일 | 변경 요약 |
|------|-----------|
| `server-a/backend/app/routers/control.py` | userId: JWT user_id 사용 |
| `server-a/backend/app/routers/equipment.py` | neo4j.time.Date converter import + 적용 |
| `server-a/backend/app/services/neo4j_service.py` | `_convert_neo4j_value()` 헬퍼 + properties 적용 |
| `server-a/frontend/app/control/page.tsx` | bldg: 가드 + 15초 safety timer |
| `server-a/frontend/lib/api.ts` | 15초 타임아웃 + async 401 리다이렉트 |
| `server-b/app/main.py` | userId Optional + audit_log 타입 동기화 |
| `server-b/app/command_queue.py` | user_id 기본값 0 |

### 21.6 E2E 테스트 결과

```bash
# 로그인
POST /api/auth/login {admin@bees.dev, admin123} → 200 OK, JWT 발급

# ON 명령
POST /api/control {bldg:AHU_UFAD_3, ON} → success=true, "성공적으로 전달"
Server C: is_active=True, mode=auto

# OFF 명령
POST /api/control {bldg:AHU_UFAD_3, OFF} → success=true, "성공적으로 전달"
Server C: is_active=False, mode=auto
```

### 21.7 디버깅 인사이트

- **MQTT 캐시 device_id에는 `bldg:` 접두사가 이미 포함** — 프론트엔드에서 추가하면 이중 접두사 발생
- **`fetchJSON`에서 401 처리 시 `window.location.href` 동기 실행은 위험** — throw가 전파되기 전에 페이지 이동하면 catch/finally 미실행 → 비동기(setTimeout) 리다이렉트가 안전
- **`properties(n)` Cypher 결과에 neo4j.time.Date 등 네이티브 타입이 포함** — `hasattr(val, "iso_format")`으로 범용 변환 필요
- **DB 시드 데이터와 실제 사용 데이터가 불일치할 수 있음** — init.sql과 런타임 생성 계정의 이메일/해시 일치 여부 확인 필수

### 21.8 커밋

- `bae5925` — fix: 제어 페이지 "가동" 버그 5건 수정 — 422/404/500/무한스피너/인증

---

## 22. SSE 이벤트 스톰 수정 + 모니터링/제어 페이지 복구 (2026.02.19)

### 22.1 문제 현상

제어 페이지 "가동" 버그 수정(섹션 21) 후 다음 3가지 문제 발생:

1. **모니터링 페이지**: "장비 목록 로딩 중..." → "등록된 장비가 없습니다"
2. **제어 페이지 복귀 시**: 84개 장비 → 1개(AHU_5F 하드코딩 폴백)
3. **양쪽 모두 "연결 끊김"**: SSE 연결 불안정

### 22.2 근본 원인 분석

**SSE 이벤트 스톰**: Server A의 `event_generator()`가 5초마다 **317개 포인트 + 84개 디바이스 = 401개 개별 SSE 이벤트**를 burst 전송.

```
문제 흐름:
401개 SSE 이벤트 → 401개 React setState → 브라우저 렌더링 블로킹
→ getEquipmentList() fetch 지연/타임아웃 → "등록된 장비가 없습니다"
→ EventSource onerror 발생 → "연결 끊김"
→ getDeviceStatus() 실패 → catch 블록 AHU_5F 하드코딩 폴백
```

**검증**: `curl -N http://localhost:8010/api/stream/points`로 확인 — 5초마다 401개 개별 `event: point` / `event: device` 이벤트 burst 확인.

### 22.3 수정 내용 (5개 파일)

#### (1) Server A — SSE 배치 이벤트 (`mqtt_service.py:event_generator()`)

401개 개별 이벤트 → **1개 "batch" 이벤트**로 통합:

```python
# Before: 개별 이벤트 yield (401회)
for event in new_events:
    yield {"event": event["type"], "data": json.dumps(event["data"])}

# After: 배치로 묶어 전송 (1회)
points_batch = [e["data"] for e in new_events if e["type"] == "point"]
devices_batch = [e["data"] for e in new_events if e["type"] == "device"]
alarms_batch = [e["data"] for e in new_events if e["type"] == "alarm"]
yield {"event": "batch", "data": json.dumps({
    "points": points_batch, "devices": devices_batch, "alarms": alarms_batch,
})}
```

#### (2) Frontend — SSE 훅 배치 처리 (`sse.ts`)

`"batch"` 이벤트 리스너 추가. 포인트/디바이스/알람 각각 한 번의 `setState`로 업데이트:

```typescript
es.addEventListener("batch", (event) => {
  const batch = JSON.parse(event.data);
  if (batch.points?.length) setPoints(prev => { ... }); // 1회 setState
  if (batch.devices?.length) setDevices(prev => { ... }); // 1회 setState
  if (batch.alarms?.length) setAlarms(prev => { ... }); // 1회 setState
});
```

기존 개별 이벤트 리스너(`point`, `device`, `alarm`)도 하위 호환으로 유지.

#### (3) Frontend — WebSocket 훅 배치 처리 (`ws.ts`)

`ws.onmessage`에 `type === "batch"` 분기 추가. SSE와 동일한 배치 처리 로직.

#### (4) Backend — AHU_5F 하드코딩 폴백 제거 (`control.py`)

```python
# Before: MQTT 캐시 비어있으면 하드코딩 AHU_5F 반환
if not device_cache:
    return {"devices": [{"device_id": "AHU_5F", ...}], "total": 1, "active": 0}

# After: 빈 배열 반환
if not device_cache:
    return {"devices": [], "total": 0, "active": 0}
```

#### (5) Frontend — AHU_5F 폴백 제거 (`control/page.tsx`)

```typescript
// Before: API 실패 시 하드코딩 AHU_5F 반환
} catch {
  setDeviceList([{ device_id: "AHU_5F", name: "AHU 5층", ... }]);
}

// After: 빈 배열
} catch {
  setDeviceList([]);
}
```

### 22.4 수정 파일 요약

| 파일 | 변경 요약 |
|------|-----------|
| `server-a/backend/app/services/mqtt_service.py` | `event_generator()` 배치 전송 (401개 → 1개 batch 이벤트) |
| `server-a/frontend/lib/sse.ts` | `"batch"` 이벤트 리스너 추가, 포인트/디바이스/알람 배치 setState |
| `server-a/frontend/lib/ws.ts` | `type === "batch"` 분기 추가, 동일 배치 처리 |
| `server-a/backend/app/routers/control.py` | AHU_5F 하드코딩 폴백 제거 → 빈 배열 |
| `server-a/frontend/app/control/page.tsx` | catch 블록 AHU_5F 폴백 제거 → 빈 배열 |

### 22.5 기대 데이터 흐름

```
[제어 /control] "가동" → [Server A] → [Server B] → [Server C] 장비 ON
                                                        ↓ MQTT (5초 interval)
[모니터링 /monitoring] ← [SSE batch] ← [Server A] ← MQTT ← 센서 데이터 발행
        ↓ 장비 클릭                                      ↓
[장비 상세 /monitoring/[id]] ← REST API ← [Server D] ← InfluxDB 저장
        (실시간 게이지 + 트렌드 차트)
```

### 22.6 검증 결과

```bash
# SSE 배치 이벤트 확인
curl -N http://localhost:8010/api/stream/points
# → event: batch
#   data: {"points": [317개], "devices": [84개], "alarms": []}
# (기존: 401개 개별 이벤트 → 수정 후: 1개 batch 이벤트)

# 데이터 스냅샷
curl http://localhost:8010/api/stream/snapshot
# → point_count: 317, device_count: 84
```

### 22.7 디버깅 인사이트

- **SSE 이벤트 수가 많으면 React가 렌더링 블로킹** — 401개 개별 setState는 브라우저를 사실상 멈춤
- **서버에서 배치로 묶는 것이 클라이언트 배치보다 효과적** — 네트워크 오버헤드도 감소
- **AHU_5F 같은 하드코딩 폴백은 디버깅을 어렵게 만듦** — 실패가 성공처럼 보임

### 22.8 Agent Teams 활용

4명의 에이전트 팀(`monitoring-control-fix`)으로 병렬 분석:
- `monitoring-analyzer`: 모니터링 페이지 코드 분석
- `control-analyzer`: 제어 페이지 코드 분석
- `sse-dataflow-analyzer`: SSE/MQTT/WebSocket 데이터 흐름 분석 (근본 원인 발견)
- `backend-api-tester`: curl E2E API 테스트

---

## 23. 모니터링 FCU 필터 버그 + TTL↔Neo4j 장비 동기화 (2026.02.19)

### 23.1 문제 현상

1. **모니터링 페이지 FCU 필터**: "검색 조건에 맞는 장비가 없습니다" (0개)
2. **필터 탭 라벨**: `monitoring.AHU`, `monitoring.FCU`처럼 i18n 키가 번역되지 않고 그대로 노출
3. **TTL↔API 장비 불일치**: TTL에 110+ 장비 정의, API는 83개만 반환

### 23.2 근본 원인

#### (1) Neo4j 라벨 불일치 (`'FCU'` vs `'Fan_Coil_Unit'`)

온톨로지 TTL에서 FCU는 `brick:Fan_Coil_Unit` 클래스로 정의:
```turtle
bldg:FCU_2F a brick:Fan_Coil_Unit ;
```
n10s가 Neo4j에 import하면 라벨이 `Fan_Coil_Unit`. 하지만 Cypher 쿼리 화이트리스트에는 `'FCU'`로 등록 → 매칭 실패.

#### (2) Pump 서브클래스 누락

TTL의 펌프 장비는 Brick 서브클래스를 사용:
- `brick:Chilled_Water_Pump` (CC_Pump_1, CHW_Pump_1, CHW_Pump_Group)
- `brick:Condenser_Water_Pump` (CW_Pump_1, CW_Pump_Group)
- `brick:Hot_Water_Pump` (HW_Pump_1, HW_Pump_Group)

화이트리스트에 `'Pump'`만 있어서 서브클래스 7개 누락.

#### (3) BEES 커스텀 장비 누락

`bees:Chilled_Ceiling_Panel` (CC_Panel_5F~15F_Int/West) 20개가 화이트리스트에 없음.

#### (4) i18n 라벨 미매핑

```typescript
{ key: "AHU", label: "AHU" },  // ← "typeAHU"여야 함
{ key: "FCU", label: "FCU" },  // ← "typeFCU"여야 함
```

### 23.3 수정 내용

| 파일 | 변경 |
|------|------|
| `neo4j_service.py:174-182` | 쿼리 화이트리스트에 `Fan_Coil_Unit`, `Chilled_Water_Pump`, `Condenser_Water_Pump`, `Hot_Water_Pump`, `Chilled_Ceiling_Panel` 추가 |
| `neo4j_service.py:337-346` | `equipment_types` 리스트 동기화 |
| `monitoring/page.tsx:38-48` | `AHU`→`typeAHU`, `FCU`→`Fan_Coil_Unit`+`typeFCU`, CC Panel 필터 탭 추가 |
| `messages/ko.json` | `"typeCCPanel": "냉각천장"` 추가 |
| `messages/en.json` | `"typeCCPanel": "CC Panel"` 추가 |

### 23.4 결과

| 항목 | 이전 | 이후 |
|------|:----:|:----:|
| API 장비 수 | 83 | **110** |
| Pump 계열 | 2 | **9** (+7 Water Pump) |
| CC Panel | 0 | **20** |
| FCU | 0 | **4** |
| 모니터링 필터 탭 | 7개 (i18n 깨짐) | **9개** (+ CC Panel, i18n 정상) |

### 23.5 TTL-First 원칙 확인

**TTL이 이미 모든 장비를 포함**하고 있었음. 문제는 백엔드 Cypher 쿼리의 화이트리스트가 불완전했을 뿐. TTL → n10s → Neo4j 경로는 정상이며, API 쿼리만 수정으로 해결.

### 23.6 커밋

- `eba8fd5` — fix: SSE 이벤트 스톰 수정 — 401개 개별 이벤트를 1개 batch로 통합
- `62b1e3c` — fix: TTL↔Neo4j 장비 동기화 — 누락 27개 장비 API 노출 (83→110)

---

## 24. 다국어 장비명 표시 + Neo4j 동기화 완성 (2026.02.19)

### 24.1 배경

모니터링/제어/온톨로지 페이지에서 장비/센서 이름이 URI 코드명(예: `AHU_UFAD_1`)으로만 표시됨. Neo4j에는 `n.label` 속성으로 rdfs:label(한국어 이름)이 저장되어 있으나 어떤 쿼리도 이를 조회하지 않았음. 또한 CC_Pump_1의 hasLocation 관계가 Neo4j에 미반영(TTL 644 vs Neo4j 643).

### 24.2 Agent Teams 병렬 작업

4개 리서치 에이전트(neo4j-checker, monitoring-researcher, control-researcher, label-researcher)를 병렬 실행하여 분석 후, 2개 구현 에이전트(백엔드, 프론트엔드)로 병렬 구현.

### 24.3 수정 내용

#### Part A: Neo4j 동기화
- CC_Pump_1 hasLocation → B_B1F 관계 Cypher로 직접 추가
- 검증: hasLocation 643 → **644** (TTL과 일치)

#### Part B: 백엔드 (2파일)

| 파일 | 변경 |
|------|------|
| `neo4j_service.py` | `_extract_rdfs_label()` 헬퍼 추가 (배열/문자열 양쪽 처리) |
| `neo4j_service.py` | `get_equipment_list()` — RETURN에 `n.label AS rdfs_label`, 응답에 `"label"` 필드 |
| `neo4j_service.py` | `search_instances()` — 파라미터명 `$q/$lim` 변경, n.label 리스트 타입 검색, 한국어 검색 지원 |
| `neo4j_service.py` | `get_graph_data()` — 메인/이웃 노드에 `rdfsLabel` 추가 |
| `neo4j_service.py` | `get_node_detail()` — 노드 자신 + outgoing/incoming 연결에 `rdfsLabel`/`target_rdfs_label` 추가 |
| `control.py` | `get_all_device_status()` — MQTT 캐시에 Neo4j 장비 정보(label/type/location) 병합, `bldg:` 접두사 처리 |

#### Part C: 프론트엔드 (6파일)

| 파일 | 변경 |
|------|------|
| `lib/utils.ts` | `humanizeName()`, `koreanizeLabel()` (18개 약어→한국어), `getDisplayName()`, `localizeType()` (23개 타입), `formatLocation()` |
| `lib/api.ts` | 7개 인터페이스에 `label`/`rdfsLabel`/`target_rdfs_label` optional 필드 추가 |
| `control/page.tsx` | `useLocale` + 장비명 한국어/영어 전환, 타입/위치 한국어화, 코드명 병기 |
| `monitoring/page.tsx` | 장비 그리드 이름 한국어 + 코드명 병기, 위치 한국어화 |
| `monitoring/[equipmentId]/page.tsx` | 장비 상세 헤더/위치 한국어화 + 코드명 병기 |
| `ontology/page.tsx` | 그래프 노드 라벨, 검색 결과, 노드 상세 패널, 더블클릭 확장 노드 — locale 기반 이름 표시 |

#### Part D: 언어 스위처 드롭다운 버그 수정

| 파일 | 변경 |
|------|------|
| `components/layout/header.tsx` | 드롭다운 `mt-1` margin → `pt-1` padding 래퍼로 변경 (hover 영역 끊김 해결) |

### 24.4 주요 기술 결정

- **n.label은 Neo4j에서 배열로 저장** → `_extract_rdfs_label()` 헬퍼로 `[0]` 추출
- **Cypher 파라미터명**: `$query`→`$q`, `$limit`→`$lim` (Python 키워드 충돌 방지)
- **한국어 검색**: `CASE WHEN n.label IS :: LIST<STRING> THEN n.label ELSE [] END` 패턴
- **약어 한국어화**: `koreanizeLabel()` — AHU→공조기, UFAD→바닥급기, DOAS→외기조화기 등 18개 매핑
- **locale 전환**: `useLocale()` from next-intl, 한국어=koreanizeLabel(rdfs:label), 영어=humanizeName(codeName)
- **MQTT device_id `bldg:` 접두사**: `lookup_key = did.replace("bldg:", "")` 로 Neo4j eq_map 조회

### 24.5 검증 결과

| API 엔드포인트 | label 포함 | 상태 |
|---------------|:----------:|:----:|
| `/api/equipment` | `label="UFAD 전용 AHU #1"` | ✅ |
| `/api/devices/status` | `label="UFAD 전용 AHU #1"` | ✅ |
| `/api/ontology/search?q=칠러` | `label="칠러#4 운전 상태"` (20건) | ✅ |
| `/api/ontology/graph` | `rdfsLabel="가압식 바닥공조 시스템"` | ✅ |
| `/api/ontology/node/bldg:Chiller_1` | `rdfsLabel="칠러 #1"`, connections에 `target_rdfs_label` | ✅ |
| Neo4j hasLocation count | 644 (TTL 일치) | ✅ |

### 24.6 이전 설비 분석 요청 확인

사용자의 이전 질문 "설비 개수가 각층마다 있어야 하는 것 아닌가" 분석 결과:
- **Phase 6~7에서 이미 반영 완료** (3-Tier 층별 모델, 지하/저층/옥상 전면 보완)
- AHU: 5F~15F 각 층 ✅, 냉각천장: 각 층 2개씩 ✅
- FCU: 2F/3F만 존재, 5F~15F 부재 → UFAD+냉각천장 복합 시스템이므로 설명 가능, 실측 데이터 확보 시 정밀화 (next.md 후순위)

## 25. 시뮬레이션 전체 가동/정지 제어 기능 (2026.02.19)

### 25.1 배경

제어 페이지(`/control`)에서 개별 장비 ON/OFF만 가능하고, 에뮬레이터(Server C)의 전체 시뮬레이션을 일괄 시작/정지하는 기능이 없었음. Server C에는 이미 `/simulation/start`, `/simulation/stop`, `/simulation/status` API가 존재했으나, 프론트엔드에서 직접 접근할 경로가 없었음.

### 25.2 Agent Teams 병렬 작업

3개 리서치 에이전트(Server C API 조사, 제어 페이지/API 조사, Server B 구조 조사)를 병렬 실행하여 분석 후, 2개 구현 에이전트(백엔드, 프론트엔드)로 병렬 구현.

### 25.3 수정 내용

#### Part A: 백엔드 (2파일)

| 파일 | 변경 |
|------|------|
| `config.py` | `SERVER_C_URL` 설정 추가 (pydantic-settings BaseSettings + 모듈 레벨 export) |
| `control.py` | `SimulationResponse` 모델 + 3개 엔드포인트 추가 |

**새 API 엔드포인트:**
| 메서드 | 경로 | 인증 | 설명 |
|--------|------|:----:|------|
| POST | `/api/simulation/start` | JWT (operator/admin) | Server C 시뮬레이션 시작 프록시 + 감사 로그 |
| POST | `/api/simulation/stop` | JWT (operator/admin) | Server C 시뮬레이션 정지 프록시 + 감사 로그 |
| GET | `/api/simulation/status` | 없음 | Server C 시뮬레이션 상태 조회 프록시 |

#### Part B: 프론트엔드 (4파일)

| 파일 | 변경 |
|------|------|
| `lib/api.ts` | `SimulationControlResponse` 인터페이스, `startSimulation()`, `stopSimulation()`, `getSimulationStatusFromBackend()` 함수 추가 |
| `app/control/page.tsx` | 시뮬레이션 전체 제어 패널 UI, 상태 폴링(10초), 명령 이력 연동 |
| `messages/ko.json` | `control` 섹션에 9개 키 추가 (simulationControl, startAll, stopAll 등) |
| `messages/en.json` | `control` 섹션에 9개 키 추가 (영어 대응) |

### 25.4 주요 기술 결정

- **Server A 백엔드 프록시 경유**: 시나리오 페이지(`/scenarios`)는 `fetchEmulator()`로 Server C 직접 호출하나, 시뮬레이션 제어는 JWT 인증 + 감사 로그가 필요하므로 Server A 백엔드를 경유하도록 설계
- **감사 로그**: `audit_service.log_action()`으로 simulation_start/simulation_stop 기록, `target_equipment="ALL"`
- **Server C 오프라인 대응**: `httpx.ConnectError` 시 에러 상태 반환 (HTTPException 미사용, 사용자에게 연결 불가 메시지 표시)
- **시뮬레이션 상태 폴링**: 10초 간격으로 `/api/simulation/status` 호출, 연결 실패 시 "disconnected" 표시
- **UI**: 파란색 그라데이션 카드, Activity 아이콘, Badge(success/secondary/danger), PlayCircle/StopCircle 버튼

### 25.5 검증 결과 (8개 테스트 전체 통과)

| # | 테스트 | 결과 |
|:-:|--------|:----:|
| 1 | `GET /api/simulation/status` | ✅ status=running, devices=84, points=317 |
| 2 | `POST /api/simulation/stop` (JWT) | ✅ status=stopped |
| 3 | 정지 후 상태 확인 | ✅ status=stopped, mqtt=False |
| 4 | `POST /api/simulation/start` (JWT) | ✅ status=started |
| 5 | 시작 후 상태 확인 | ✅ status=running, devices=84, points=317, mqtt=True |
| 6 | 미인증 정지 시도 | ✅ 401 "인증 토큰이 필요합니다" |
| 7 | `GET /api/devices/status` | ✅ total=84, active=11 |
| 8 | 프론트엔드 페이지 로드 | ✅ HTTP 200 |

## 26. 시뮬레이션 가동/정지 → 실제 장비 상태 동기화 버그 수정 (2026.02.19)

### 26.1 문제

"전체 가동" 클릭 후에도 제어 페이지에서 일부 장비 카드가 OFF 상태로 남음. 모니터링 페이지에도 전혀 반영 안 됨.

### 26.2 근본 원인 분석

3개 리서치 에이전트를 병렬 투입하여 Server C 엔진, 제어→모니터링 데이터 흐름, MQTT 실시간 상태를 조사.

**근본 원인**: Server C `engine.start()`가 시뮬레이션 루프만 시작하고, 장비 `is_active` 상태를 변경하지 않았음.

- `DeviceState` 초기값: `is_active=False` (모든 장비)
- `start()`: `_running=True` + MQTT 연결 + `_simulation_loop()` 태스크만 생성 → **장비 활성화 없음**
- MQTT 발행 루프: `device.is_active` 실제값(대부분 False) 그대로 전송
- Server A `set_all_devices_active()` 즉시 호출 → **5초 후 Server C MQTT 메시지로 덮어쓰기** (is_active=false)
- 결과: 프론트엔드 일시적으로 ON 표시 → 5초 후 다시 OFF

### 26.3 1차 수정 — 버튼 로직 개선 (커밋 122579e)

| 영역 | 파일 | 변경 |
|------|------|------|
| 백엔드 | `mqtt_service.py` | `set_all_devices_active()`, `set_all_devices_inactive()`, `clear_device_cache()` 추가 |
| 백엔드 | `control.py` | 시뮬레이션 시작/정지 시 MQTT 캐시 전체 상태 전환 호출 |
| 프론트 | `control/page.tsx` | `activeCount`/`allActive`/`noneActive` 기반 버튼 disabled 로직, 즉시 UI 업데이트 |

### 26.4 2차 수정 — Server C 엔진 근본 수정

| 파일 | 변경 |
|------|------|
| `server-c/app/engine.py` `start()` | MQTT 연결 후 전체 장비 `is_active=True`, `mode="auto"` 설정 → 시뮬레이션 루프 시작 |
| `server-c/app/engine.py` `stop()` | 태스크 취소 후 전체 장비 `is_active=False`, `mode="standby"` 설정 + **최종 상태 MQTT 발행** → 연결 해제 |

**핵심**: `stop()` 시 MQTT 연결 해제 **전에** 비활성 상태를 MQTT로 발행하여 Server A 캐시가 즉시 업데이트됨.

### 26.5 최종 E2E 검증 결과

**전체 데이터 경로 검증** (Server C → MQTT → Server A 캐시 → SSE → 프론트엔드):

| # | 테스트 | 결과 |
|:-:|--------|:----:|
| 1 | Server C 직접 정지 → 84대 비활성 | ✅ |
| 2 | Server C 직접 시작 → 84대 활성 | ✅ |
| 3 | Server A 프록시 정지 (JWT) → 0/84 | ✅ |
| 4 | Server A 프록시 시작 (JWT) → 84/84 | ✅ |
| 5 | SSE 스냅샷 devices 84/84 active | ✅ |
| 6 | 모니터링 API (`/api/equipment`) — 84개 active, 26개 null (Valve/Damper/VFD) | ✅ |
| 7 | 프론트엔드 제어 페이지 HTTP 200 | ✅ |
| 8 | 프론트엔드 모니터링 페이지 HTTP 200 | ✅ |

**장비 110개 vs 84개 차이**: Neo4j에는 Valve(22)/Damper(3)/VFD(1) 포함 110개 장비가 있으나, Server C 에뮬레이터는 센서 데이터를 생성하는 84개만 시뮬레이션 대상으로 등록. 나머지 26개는 상위 장비의 포인트로 제어되는 액추에이터/부품이므로 `is_active=null` 정상.

### 26.6 커밋 이력

| 커밋 | 설명 |
|------|------|
| `d5ee06d` | feat: 시뮬레이션 전체 가동/정지 제어 기능 추가 (섹션 25) |
| `122579e` | fix: 즉시 UI 반영 + 버튼 disabled 로직 개선 (섹션 26.3) |
| `24954ca` | fix: Server C engine start/stop 시 전체 장비 활성/비활성 상태 동기화 (섹션 26.4) |

### 26.7 수정 파일 전체 목록

| 서버 | 파일 | 변경 내용 |
|------|------|-----------|
| Server A 백엔드 | `app/config.py` | `SERVER_C_URL` 설정 추가 |
| Server A 백엔드 | `app/routers/control.py` | 시뮬레이션 프록시 3개 엔드포인트 + MQTT 캐시 전환 호출 |
| Server A 백엔드 | `app/services/mqtt_service.py` | `set_all_devices_active/inactive()`, `clear_device_cache()` 추가 |
| Server A 프론트 | `lib/api.ts` | 시뮬레이션 제어 API 함수 3개 추가 |
| Server A 프론트 | `app/control/page.tsx` | 전체 제어 패널 UI, activeCount 기반 버튼 로직, 즉시 UI 업데이트 |
| Server A 프론트 | `messages/ko.json` | control 섹션 9개 키 추가 |
| Server A 프론트 | `messages/en.json` | control 섹션 9개 키 추가 |
| Server C | `app/engine.py` | `start()`에서 전체 활성화, `stop()`에서 전체 비활성화 + MQTT 발행 |

---

## 27. 장비 카테고리 분류 개선 (2026-02-19)

### 27.1 배경
모니터링(~110개), 제어(84개), 토폴로지(트리) 페이지별 장비 표시 수가 달라 사용자 혼란 발생.
원인 분석 결과 데이터 소스 차이(Neo4j 라벨 vs MQTT 캐시 vs hasPart 트리)에 의한 정상 동작이었으나,
각 페이지 목적에 맞는 장비 분류 체계가 없어 개선이 필요했음.

### 27.2 버그 수정 (선행)
- **Cooling_Coil / Heating_Coil 유령 라벨**: TTL에 0개 인스턴스인데 코드 3곳에 잔존 → 제거
  - `neo4j_service.py` WHERE 절, `monitoring/page.tsx` 타입 라벨맵, `lib/utils.ts` 한국어 타입맵
  - 커밋: `4420103`

### 27.3 분류 모듈 설계

**`equipment_classification.py`** (신규) — 단일 소스 분류 모듈:
- Brick Schema 클래스 기반 2단계 분류: 대분류(hvac / electrical_transport / component) + 서브분류(cooling / heating / air_handling)
- `CONTROLLABLE_TYPES`: Server B의 `CONTROLLABLE_EQUIPMENT`과 동기화 (11종)
- `classify_equipment(brick_labels)` → `{category, subcategory, controllable}`

| 대분류 | 서브분류 | 장비 타입 |
|--------|---------|-----------|
| hvac | cooling | Chiller, Cooling_Tower, CHW_Pump, CW_Pump, CC_Panel |
| hvac | heating | Boiler, HW_Pump |
| hvac | air_handling | AHU, Supply/Return/Exhaust_Fan, FCU, Pump |
| electrical_transport | — | Elevator |
| component | — | Valve, Damper, VFD, Heat_Exchanger, CRAC, Condenser, Compressor |

### 27.4 백엔드 변경
- **neo4j_service.py**: `get_equipment_list()` 응답에 `category`, `subcategory`, `controllable` 필드 추가
- **control.py**: `GET /api/devices/status`에 `controllable_only` 쿼리 파라미터 추가, 응답에 분류 필드 포함

### 27.5 모니터링 페이지 — 2단계 필터 + 부품 배너
- 기존 TYPE_FILTERS 10개 평면 탭 → **2단계 분류 체계**
- 1단계 대분류: 전체 84 / HVAC 72 / 전기·수송 12 (부품 탭 제거)
- 2단계 HVAC 서브필터: 전체 / 냉방 32 / 난방 6 / 공조 34 (HVAC 선택 시에만 표시)
- **부품(26개)은 카드 그리드에서 제외** → 하단 접힘 요약 배너로 표시 (밸브 22 · 댐퍼 3 · 인버터 1)
- API `category`/`subcategory` 필드 우선 활용, 없으면 `brick_class` 폴백

### 27.6 제어 페이지 — 84대 전체 제어 가능
- CC_Panel(20개) + Elevator(12개)를 제어 가능으로 전환 → 84대 전체 동일 ON/OFF 카드
- "모니터링 전용" 섹션 삭제 (모든 장비가 제어 가능해짐)
- Server B `CONTROLLABLE_EQUIPMENT`에 `Chilled_Ceiling_Panel`, `Elevator` 추가
- `CONTROLLABLE_TYPES` 11종 → 13종으로 확장

### 27.7 토폴로지 페이지 — 부품 노드 분리
- `isComponentNode()` 함수: Valve/Damper/VFD/Actuator/Condenser/Compressor 판별
- `getChildEquipment()` → `{mainEquipment, components}` 분리 반환
- 트리: 부품 노드 연한 색상 + "부품" 태그
- 상세 패널: 주요 장비 그리드 + 접힘 가능 부품 섹션 (border-dashed, opacity-70)

### 27.8 AHU_5F 하드코딩 센서 차트 제거
- Phase 1 MVP 잔존물 — `SENSORS` 상수에 AHU_5F 센서 5개가 하드코딩되어 있었음
- 장비 상세 페이지(`/monitoring/[equipmentId]`)에서 이미 모든 장비의 센서 차트 제공 → **중복 제거**
- 삭제: `SENSORS` 상수, `LiveChart` import, `chartDataMap` useMemo, 센서 차트 JSX 전체 (**-208줄**)
- 모니터링 페이지 크기: 5.6kB → 3.9kB

### 27.9 i18n
- `ko.json` / `en.json`: 부품 요약 배너 7개 키 추가, HVAC 서브필터 3키
- 제어 페이지: `monitorOnlyDevices`, `monitorOnlyLabel`, `controllableCount` 등 불필요 키 삭제
- 모니터링: `categoryParts`, `partsNote` 삭제, `componentSummaryTitle` 등 7키 추가

### 27.10 커밋 이력

| 커밋 | 설명 |
|------|------|
| `4420103` | fix: Cooling_Coil/Heating_Coil 유령 라벨 제거 (섹션 27.2) |
| `9fbb8c7` | feat: 장비 카테고리 분류 개선 — 모니터링·제어·토폴로지 3개 페이지 (섹션 27.3~27.7) |
| `5e9521e` | feat: CC_Panel·Elevator 제어 가능화 + 모니터링 부품 배너 전환 (섹션 27.5~27.6) |
| `898dc94` | refactor: 모니터링 페이지 AHU_5F 하드코딩 센서 차트 섹션 제거 (섹션 27.8) |

### 27.11 수정 파일 전체 목록

| 서버 | 파일 | 변경 내용 |
|------|------|-----------|
| Server A 백엔드 | `app/services/equipment_classification.py` | **신규** — 장비 분류 모듈 (CONTROLLABLE_TYPES 13종) |
| Server A 백엔드 | `app/services/neo4j_service.py` | category/subcategory/controllable 필드 추가 |
| Server A 백엔드 | `app/routers/control.py` | controllable_only 파라미터, 분류 필드 응답 |
| Server A 프론트 | `app/monitoring/page.tsx` | 2단계 필터 + 부품 배너 + AHU_5F 센서 섹션 제거 |
| Server A 프론트 | `app/control/page.tsx` | 84대 전체 제어 카드 (모니터링 전용 섹션 삭제) |
| Server A 프론트 | `app/topology/page.tsx` | 부품 노드 분리 + 접힘 섹션 |
| Server A 프론트 | `lib/api.ts` | 타입 정의 + API 함수 확장 |
| Server A 프론트 | `messages/ko.json` | 분류/부품 배너 키 추가, 불필요 키 삭제 |
| Server A 프론트 | `messages/en.json` | 동일 구조 영어 |
| Server B | `app/neo4j_loader.py` | CONTROLLABLE_EQUIPMENT에 CC_Panel, Elevator 추가 |

### 27.12 최종 페이지 상태 (Phase 5.1)

| 페이지 | 장비 수 | 주요 변경 |
|--------|:------:|-----------|
| 모니터링 | **84대** | 3탭(전체/HVAC/전기수송) + HVAC 서브필터 + 부품 요약 배너(26개) |
| 제어 | **84대** | 전체 ON/OFF 제어 가능, 모니터링 전용 섹션 없음 |
| 토폴로지 | 트리 전체 | 부품 노드 시각적 분리(연한색 + "부품" 태그) |

---

## 28. 층별 현황 전용 페이지 `/floors` 신규 구축 (2026-02-19)

### 28.1 배경
기존 대시보드의 Floor Overview 위젯은 소형이라 정보 밀도가 낮았다.
시설 관리자가 **"어디가 문제이고, 얼마나 심각하며, 누가 있는가"**를 한 눈에 파악할 수 있는 전용 페이지 필요.

### 28.2 구현 내용
GEC B동 18개 층(RF, 15F~5F, 3F~1F, B1F~B4F) 전체 현황을 3가지 뷰로 제공.

**3개 뷰 모드:**
- **히트맵 뷰** (`heatmap-view.tsx`): 건물 단면도 스타일 세로 스택, 온도 기반 색상 매핑(파랑→초록→빨강), 알람 도트 표시
- **카드 뷰** (`card-view.tsx`): 4열 반응형 그리드, 온도/습도/CO₂/전력/장비/알람 한눈에 표시
- **리스트 뷰** (`list-view.tsx`): 정렬 가능한 비교 테이블 (온도순·전력순·알람순 등), 조건부 셀 색상

**상세 패널:** 층 클릭 시 우측 슬라이드 패널 (`floor-detail-panel.tsx`)
- 환경(온도/습도/CO₂), 에너지, 장비 목록(가동 상태), 활성 알람 표시

**데이터 소스:**
| 데이터 | 소스 | 활용 |
|--------|------|------|
| 장비 목록 (84대) | `/api/equipment` | 층별 장비 수, 카테고리 분류 |
| 에너지 분배 | `/api/energy/breakdown` | 층별 전력 사용량 |
| 활성 알람 | `/api/alarms/active` | 층별 알람 현황 |
| 센서 317포인트 | `/api/stream/snapshot` + SSE | 온도(RAT), 습도(RAH), CO₂ |
| 장비 상태 84대 | `/api/stream/snapshot` + SSE | 가동/정지 |

### 28.3 데이터 로딩 아키텍처
`fetchJSON()` (api.ts 래퍼)가 Docker 프로덕션 빌드에서 원인 불명으로 실패하는 문제 발견.
raw `fetch()`는 정상 동작 확인 → **raw fetch 직접 호출 + snapshot API 폴백** 전략 채택.

```
[마운트] ─→ raw fetch(/api/equipment)      → equipmentList (84대)
         ─→ raw fetch(/api/energy/breakdown) → energyBreakdown
         ─→ raw fetch(/api/alarms/active)    → activeAlarms
         ─→ raw fetch(/api/stream/snapshot)  → snapshotPoints(317) + snapshotDevices(84)
         ─→ useSSE(60)                       → 실시간 points/devices 오버레이

[병합] mergedPoints = {...snapshotPoints, ...ssePoints}   ← SSE가 snapshot 오버라이드
       mergedDevices = {...snapshotDevices, ...sseDevices}

[30초 폴링] energy + alarms 갱신
```

### 28.4 건물 KPI 요약 (페이지 상단)
- 평균 온도, 총 전력(kW), 활성 알람 수, 위험/주의 층 수

### 28.5 층 상태 판단 로직 (`calculateFloorStatus`)
| 조건 | 상태 |
|------|------|
| critical 알람 존재 또는 온도 >28°C/<18°C | `critical` (위험) |
| warning 알람 존재 또는 온도 >26°C/<20°C | `warning` (주의) |
| 그 외 | `normal` (정상) |

### 28.6 신규 파일 (8개)

| 파일 | 설명 |
|------|------|
| `components/floors/floor-constants.ts` | 18개 층 정의, FloorData 타입, ssePointPrefix(), calculateFloorStatus(), 색상 유틸 |
| `components/floors/use-floor-data.ts` | 커스텀 훅 — raw fetch + snapshot + SSE 병합 → FloorData[] |
| `components/floors/heatmap-view.tsx` | 히트맵 뷰 (건물 단면도) |
| `components/floors/card-view.tsx` | 카드 뷰 (4열 그리드) |
| `components/floors/list-view.tsx` | 리스트 뷰 (정렬 테이블) |
| `components/floors/floor-detail-panel.tsx` | 상세 패널 (우측 슬라이드) |
| `components/ui/sheet.tsx` | Sheet UI 컴포넌트 (순수 CSS 슬라이드 패널) |
| `app/floors/page.tsx` | 메인 페이지 — 3뷰 전환 + KPI + 상세 패널 |

### 28.7 수정 파일 (3개)

| 파일 | 변경 |
|------|------|
| `components/layout/sidebar.tsx` | `Layers` 아이콘 import + `/floors` 네비게이션 항목 추가 |
| `messages/ko.json` | `nav.floors` + `floors` 섹션 42개 i18n 키 |
| `messages/en.json` | 동일 영어 번역 42개 키 |

### 28.8 디버깅 과정 (fetchJSON 실패 해결)

| 단계 | 확인 내용 | 결과 |
|------|-----------|------|
| 1 | CORS 설정 (`allow_headers=["*"]`) | 정상 |
| 2 | JWT 토큰 영향 (invalid token → 200) | 무관 |
| 3 | `NEXT_PUBLIC_API_URL` 번들 내장값 | `http://localhost:8010` 정상 |
| 4 | SSE 엔드포인트 CORS 응답 | 정상 |
| 5 | 디버그 패널 추가 (raw fetch vs hook 비교) | **raw fetch 성공, hook 실패 확인** |
| 6 | raw fetch로 전환 + snapshot 폴백 | **해결** |

### 28.9 접속 경로
- `/floors` — 층별 현황 (사이드바 "에너지 분석" 앞에 위치)
- 프론트엔드 총 **21개 페이지** (기존 20 + floors 1)

---

## 29. 층별 현황 대시보드 통합 + Room/장비 상세 표시 (2026-02-19)

### 29.1 배경
섹션 28에서 구축한 `/floors` 전용 페이지를 대시보드(`/`)에 통합하고, 각 층 카드에 **Room별 센서 데이터**와 **장비별 상태 표시**를 추가하는 대규모 업그레이드.
사용자 핵심 요구: "각 층마다 방/스페이스 정보를 넣어라"

### 29.2 대시보드 통합
- `/floors` 전용 페이지 → 대시보드(`/`) 하단 "층별 현황" 섹션으로 통합
- `dashboard-grid.tsx`에서 `useFloorData()` 훅 사용, 카드뷰/리스트뷰 전환 + FloorDetailPanel 포함
- 히트맵 뷰 제거 (정보 밀도 낮음)
- 사이드바에서 `/floors` 네비게이션 항목 제거

### 29.3 TTL 온톨로지 보강

#### 층별 전력 계측기 추가 (36 트리플)
18개 Floor × 2포인트 = 36개 인스턴스 (`Floor_Power_Meter_XF`, `Floor_Power_XF_kW`, `Floor_Energy_XF_kWh`)
```turtle
bldg:Floor_Power_Meter_5F a brick:Building_Electrical_Meter ;
    brick:isPartOf bldg:B_5F ;
    brick:hasPoint bldg:Floor_Power_5F_kW, bldg:Floor_Energy_5F_kWh .
```
- Neo4j 재동기화 완료: **10,098 트리플**

### 29.4 Backend API 신규 — `/api/floors/{floor_key}/details`

#### 파일: `routers/floors.py` (신규)
| 엔드포인트 | 반환 |
|---|---|
| `GET /api/floors/{floor_key}/details` | `{floor_key, rooms[], equipment[], total_area_m2}` |

#### neo4j_service.py 추가 함수
| 함수 | 기능 |
|---|---|
| `get_floor_rooms(floor_key)` | Room + Zone 센서 매핑 (Cypher 쿼리) |
| `get_floor_equipment(floor_key)` | 층별 장비 목록 (category/subcategory/controllable) |
| `get_equipment_floor_mapping()` | 장비→층 매핑 캐시 (에너지 분석용) |

#### n10s MAP 모드 대응
n10s가 프로퍼티를 리스트로 반환하는 문제 해결:
```python
area_val = rec.get("area_m2")
if isinstance(area_val, list):
    area_val = area_val[0] if area_val else None
```

#### Zone 폴백 로직
Room → Zone 직접 연결이 없는 경우, 같은 층 Interior Zone 센서를 자동 매핑.

### 29.5 Frontend 업그레이드

#### 타입/상수 (`floor-constants.ts`)
- `FloorRoomData` 인터페이스 추가 (id, label, spaceType, area_m2, zone_key, temperature, humidity, co2, powerKw, energyKwh)
- `FloorEquipmentData` 인터페이스 추가 (id, name, label, type, category, subcategory, controllable, location, is_active)
- `FloorData`에 `rooms[]`, `equipmentDetails[]`, `totalArea_m2`, `energyKwh` 필드 추가
- `ssePointPrefix()` 확장: 3개 → **15개 장비 타입** (Air_Curtain, PAC, Chiller, Boiler, Pump, Exhaust_Fan, Supply_Fan, Cooling_Tower, MAU, Elevator, CC_Panel 등)

#### 데이터 훅 (`use-floor-data.ts`)
- 초기 로드 시 18개 층 `getFloorDetails()` 병렬 호출
- **UFAD AHU 특수 케이스**: `AHU_UFAD_N` → `bldg:RAT_UFAD_N` 직접 조회 (5F 온도 "—" 해결)
- **SAT 폴백 제거**: Supply Air Temp(~16°C)를 Room 온도로 표시하던 버그 수정
- Room별 센서값: Zone 센서(ZAT/ZAH/CO2) → SSE points 매핑
- **Room 센서 상속**: Zone 센서 미시뮬레이션 시, 층 평균(장비 RAT/RAH/CO2)을 Room에 상속
- Room별 에너지 추정: `(room.area_m2 / floor.total_area_m2) * floor.powerKw`

#### 카드 뷰 (`card-view.tsx`)
- **Room 수 표시**: 항상 보이는 영역에 `DoorOpen` 아이콘 + Room 개수
- **컴팩트 Room 리스트**: 접힌 상태에서 최대 3개 Room 이름 + 온도/습도 표시, `+N...` 오버플로우
- **확장 Room 테이블**: 방이름, 용도, 면적, 온도, 습도, CO2, kW, kWh 전체 컬럼
- **확장 장비 테이블**: 장비명, 용도, 위치, 가동 상태(녹/빨 도트)

#### 상세 패널 (`floor-detail-panel.tsx`)
- **공간 현황 섹션 추가** (에너지 ↔ 장비 사이)
- 각 Room: label, spaceType, 온도/습도/CO2, 면적/전력/에너지 표시
- **누적 에너지(kWh)** 에너지 섹션에 추가

### 29.6 에너지 분석 개선

#### `energy_service.py`
- 장비→층 매핑 캐시 (`_equipment_floor_cache`) lazy-load 추가
- Neo4j에서 `get_equipment_floor_mapping()` 호출하여 캐시

#### `energy.py` (라우터)
- `_extract_floor()`: 정규식 실패 시 Neo4j 장비→층 매핑 폴백
- `energy_breakdown()`: by_floor 결과 **2개 → 18개 층** 전체 표시

### 29.7 Server C 에뮬레이터 확장
- `neo4j_loader.py`: `Building_Electrical_Meter` 시뮬레이션 대상 추가
- `profile_factory.py`: Floor Power Meter 전력 프로파일 추가
- SSE 포인트: **317 → 353개** (36개 Floor Power/Energy 추가)
- 디바이스: **84 → 104개** (20개 Meter 추가)

### 29.8 버그 수정 요약

| 버그 | 원인 | 해결 |
|------|------|------|
| 5F 온도 "—" | `RAT_UFAD_1`이 `AHU_1_` 프리픽스 불일치 | UFAD 특수 케이스 추가 |
| 2F/3F 온도 16°C | SAT(Supply Air Temp) 폴백 사용 | SAT 폴백 제거 |
| Room API 빈 배열 | n10s MAP 모드 리스트 반환 → `float()` 에러 | `isinstance(list)` 체크 |
| Room→Zone 미연결 | 일부 Room이 Floor만 isPartOf | Interior Zone 폴백 |
| `/control` hydration 에러 | `isLoggedIn()` SSR에서 localStorage 접근 | useState + useEffect |
| by_floor 2개만 표시 | `_extract_floor()` 정규식 제한 | Neo4j 장비→층 매핑 폴백 |
| Room 센서 전부 null | Zone 센서 Server C 미시뮬레이션 | 층 평균 상속 로직 |

### 29.9 수정/신규 파일 목록

| 파일 | 유형 | 변경 |
|------|------|------|
| `ontology/GEC_B_Ontology.ttl` | 수정 | 층별 전력계측기 36트리플 추가 |
| `backend/app/services/neo4j_service.py` | 수정 | get_floor_rooms, get_floor_equipment, get_equipment_floor_mapping |
| `backend/app/routers/floors.py` | **신규** | GET /api/floors/{key}/details |
| `backend/app/main.py` | 수정 | floors 라우터 등록 |
| `backend/app/services/energy_service.py` | 수정 | 장비→층 캐시 추가 |
| `backend/app/routers/energy.py` | 수정 | _extract_floor Neo4j 폴백 |
| `server-c/app/neo4j_loader.py` | 수정 | Building_Electrical_Meter 추가 |
| `server-c/app/profiles/profile_factory.py` | 수정 | Meter 프로파일 추가 |
| `frontend/components/floors/floor-constants.ts` | 수정 | FloorRoomData/FloorEquipmentData 타입, ssePointPrefix 15개 |
| `frontend/components/floors/use-floor-data.ts` | 수정 | Floor Details 로드, UFAD 케이스, Room 상속 |
| `frontend/components/floors/card-view.tsx` | 수정 | Room 수, 컴팩트 리스트, Room/장비 테이블 |
| `frontend/components/floors/floor-detail-panel.tsx` | 수정 | 공간 현황 섹션, 누적 에너지 |
| `frontend/components/dashboard/dashboard-grid.tsx` | 수정 | 층별 현황 통합, 뷰 전환 |
| `frontend/app/page.tsx` | 수정 | DashboardGrid props |
| `frontend/components/layout/sidebar.tsx` | 수정 | hydration 수정, floors 항목 제거 |
| `frontend/lib/api.ts` | 수정 | FloorDetails 타입 + getFloorDetails 함수 |
| `frontend/messages/ko.json` | 수정 | floors 섹션 i18n 키 추가 |
| `frontend/messages/en.json` | 수정 | 동일 영어 번역 |

### 29.10 현재 데이터 규모

| 항목 | 값 |
|------|:---:|
| TTL 트리플 | 10,098 |
| SSE 포인트 | 353 |
| 디바이스 | 104 |
| 층 | 18 |
| Room (API 반환) | 층당 3~18개 (총 ~169개) |
| RAT 센서 | 14개 (5F~15F + RF) |
| 프론트엔드 페이지 | 20 (대시보드에 통합) |

---

## 30. 시뮬레이션 확장 — 84→201대 전체 장비 시뮬레이션 (2026.02.19)

### 30.1 배경

토폴로지 페이지에서 309개 장비 중 84개만 ON, 225개가 OFF로 표시되는 문제 해결.
원인: Server C 에뮬레이터가 14개 장비 타입만 시뮬레이션하고, 대부분(224/225)의 비시뮬레이션 장비는 온톨로지에 포인트(센서)가 없었음.

### 30.2 작업 요약

| 단계 | 작업 | 결과 |
|:----:|------|------|
| 1 | 온톨로지 TTL 포인트 추가 | 78개 장비에 122개 신규 포인트 + Chiller_Plant_Status |
| 2 | Server C 시뮬레이션 확장 | SIMULATABLE 14→39 타입, POWER_OVERRIDE +12 타입 |
| 3 | Server A 장비 분류 확장 | _CATEGORY_MAP +25 매핑, CONTROLLABLE_TYPES +11 |
| 4 | Server B 제어 확장 | CONTROLLABLE_EQUIPMENT +12 타입 |
| 5 | Neo4j 동기화 | n10s reimport, 11,300 트리플 |
| 6 | Docker 재빌드 | server-c, server-a-backend, server-b 이미지 재빌드 |

### 30.3 온톨로지 변경

- **신규 포인트 123개** (On_Off_Status 78 + Electrical_Power_Sensor 28 + Alarm 11 + Water_Level_Sensor 3 + Energy_Sensor 2 + Frequency_Command 1)
- **TTL 섹션 16 "시뮬레이션 확장 포인트" 추가** (~860줄)
- 양방향 hasPoint↔isPointOf 관계 완비
- 모든 신규 포인트에 `bees:hasConfidence "estimated"` 태깅

### 30.4 Server C 확장 (에뮬레이터)

**`server-c/app/neo4j_loader.py`**:
- SIMULATABLE_EQUIPMENT_LABELS: 14→39 타입
- 추가: Valve, Damper, VFD, Transformer, UPS, Switchgear, Emergency_Generator, Electrical_Equipment, Water_Pump, HVAC_Equipment, Controller, Lighting_Equipment, HVAC_System, Electrical_System, Lighting_System, Water_System, Equipment_System, Chilled_Ceiling_System, Chiller_Plant, DALI_Lighting_System, Double_Skin_Facade_System, Light_Shelf_System, Night_Purge_System, Radiant_Heating_System, Rainwater_Harvesting_System, UFAD_System, Wastewater_Treatment_System, Equipment

**`server-c/app/profiles/profile_factory.py`**:
- EQUIPMENT_POWER_OVERRIDE: +12 타입 (Transformer 1000kW, Switchgear 3000kW, UPS 50kW, Valve 0.02kW 등 현실적 소비전력)

### 30.5 Server A/B 확장

**`server-a/backend/app/services/equipment_classification.py`**:
- _CATEGORY_MAP: +25 매핑 (electrical, water, automation, lighting, system, 10개 서브시스템)
- CONTROLLABLE_TYPES: +11 (Valve, Damper, VFD, Water_Pump, Transformer, UPS, Emergency_Generator, Switchgear, HVAC_Equipment, Controller, Lighting_Equipment)

**`server-b/app/neo4j_loader.py`**:
- CONTROLLABLE_EQUIPMENT: +12 타입 (모두 ON/OFF 명령)

### 30.6 최종 결과

| 항목 | 이전 | 이후 |
|------|:----:|:----:|
| TTL 트리플 | 9,789 | **11,080** |
| TTL 줄 수 | ~11,600 | **~13,875** |
| 인스턴스 | 1,272 | **1,516** |
| 시뮬레이션 장비 | 84 | **201** |
| 시뮬레이션 포인트 | 164 | **584** |
| SIMULATABLE 타입 | 14 | **39** |
| isPointOf 관계 | 692 | **918** |

### 30.7 비시뮬레이션 3개 노드 (의도적 제외)

- `Daylight_Sensor_Group` (Luminance_Sensor) — 센서 Point, 장비 아님
- `Occupancy_Sensor_Lighting_Group` (Occupancy_Sensor) — 센서 Point, 장비 아님
- `Water_Meter_Main` (Water_Flow_Sensor) — 센서 Point, 장비 아님

### 30.8 수정/신규 파일 목록

| 파일 | 유형 | 변경 |
|------|------|------|
| `ontology/GEC_B_Ontology.ttl` | 수정 | +860줄, 123개 포인트 추가, v2.2.0 |
| `server-c/app/neo4j_loader.py` | 수정 | SIMULATABLE 14→39 타입 |
| `server-c/app/profiles/profile_factory.py` | 수정 | POWER_OVERRIDE +12 타입 |
| `server-a/backend/app/services/equipment_classification.py` | 수정 | _CATEGORY_MAP +25, CONTROLLABLE +11 |
| `server-b/app/neo4j_loader.py` | 수정 | CONTROLLABLE_EQUIPMENT +12 타입 |

## 31. 토폴로지 전체 장비 시뮬레이션 확장 + 분류 체계 정비 (2026.02.20)

### 31.1 문제

토폴로지 페이지에서 309개(실제 284개 장비) 중 201개만 ON, 나머지 83개가 OFF/N/A로 표시.
원인:
1. **토폴로지 트리 쿼리 깊이 부족** — 기존 4단계 고정 쿼리(`site→building→floor→zone→equip`)가 5~6단계 장비 미도달
2. **78개 장비에 포인트 0개** — Floor_Diffuser(48), CC_Distribution_Header(10), RH_Distribution_Header(10), RH_Panel(10)
3. **Server C에 8개 장비 타입 미등록** — Floor_Diffuser, Distribution_Header, Radiant_Heating_Panel, DSF_Louver 등
4. **19개 노드 잘못 분류** — Server_Room(10)→공간인데 장비로, DSF_Control_Mode(4)→모드인데 장비로, 센서/커맨드 포인트(5)→장비로

### 31.2 토폴로지 트리 쿼리 재설계

**`server-a/backend/app/services/neo4j_service.py`**:
- 기존 4단계 고정 쿼리 → `hasPart*1..6` 가변 깊이 순회로 변경
- `_build_tree_from_records()` → `_build_tree_from_pairs()` 신규 함수 (부모-자식 쌍 기반 트리 빌드)
- 고아 장비 쿼리 추가 (hasPart 부모 없는 23개 장비를 hasLocation 기반으로 배치)
- cycle 방지: `visited` set으로 순환 참조 차단
- 결과: 628 → 842 트리 노드, 201개 SSE 장비 전부 트리에 매칭

### 31.3 노드 분류 체계 정비

**백엔드 `_classify_node_type()` 수정:**
- **Sensor/Point 체크를 Equipment보다 먼저** 수행 → `Damper_Position_Command`가 장비 대신 Point로 정확 분류
- `"Mode"` 키워드 추가 → DSF_Control_Mode가 Point로 분류
- `"Room"` 부분 매칭 → `Server_Room`이 Location으로 분류 (기존: exact `"Room"` only)
- equipment_types에서 `"Server"` 제거, `"Louver"` 추가
- 결과: 19개 오분류 노드 정정 (Equipment 303 → 284)

**프론트엔드 `_isEquipmentByLabels()` 수정:**
- 백엔드 type이 Point/Zone/Location/Building/Floor/Site면 즉시 false 반환
- 라벨에 Sensor/Command/Setpoint/Status/Mode/Room 포함 시 false 반환
- 장비 키워드 매칭 전에 비장비 제외 로직 우선 적용

### 31.4 온톨로지 포인트 추가

**`ontology/GEC_B_Ontology.ttl`**:
- 78개 장비에 `brick:On_Off_Status` 포인트 추가
  - Floor_Diffuser × 48: `Floor_Diffuser_{층}_{존}_Status`
  - CC_Distribution_Header × 10: `CC_Distribution_Header_{층}_Status`
  - RH_Distribution_Header × 10: `RH_Distribution_Header_{층}_Status`
  - RH_Panel × 10: `RH_Panel_{층}_Int_Status`
- 각 포인트: rdf:type + rdfs:label(한국어) + bees:hasConfidence("estimated") + brick:isPointOf
- 양방향 hasPoint 78쌍 추가
- 트리플 수: 11,080 → **11,470** (+390)
- SHACL 검증 통과 (신규 위반 없음, 기존 GHG reportingEntity 이슈만)

### 31.5 Server C 시뮬레이션 확장

**`server-c/app/neo4j_loader.py`**:
- SIMULATABLE_EQUIPMENT_LABELS: +8 타입 (Floor_Diffuser, Distribution_Header, Radiant_Heating_Panel, DSF_Louver, Building_Automation_System, Fire_Safety_System, Security_System, Solar_PV_System)

**`server-c/app/profiles/profile_factory.py`**:
- EQUIPMENT_POWER_OVERRIDE: +4 타입 (Floor_Diffuser 0kW 패시브, Distribution_Header 0kW 패시브, Radiant_Heating_Panel 0.5kW, DSF_Louver 0.02kW)

### 31.6 Server A/B 확장

**`server-a/backend/app/services/equipment_classification.py`**:
- _CATEGORY_MAP: +8 매핑 (Floor_Diffuser→hvac/air_handling, Distribution_Header→hvac/distribution, Radiant_Heating_Panel→hvac/heating, DSF_Louver→hvac/special, Building_Automation_System→automation/bms, Fire_Safety_System→safety/fire, Security_System→safety/security, Solar_PV_System→electrical/renewable)
- CONTROLLABLE_TYPES: +8 동기화

**`server-b/app/neo4j_loader.py`**:
- CONTROLLABLE_EQUIPMENT: +8 타입 (모두 ON/OFF 명령)

### 31.7 Neo4j 동기화

- TTL → Neo4j 재임포트: 11,690 트리플, 1,732 노드
- `docker cp` + `n10s.rdf.import.fetch('file:///import/GEC_B_Ontology.ttl', 'Turtle')`

### 31.8 최종 결과

| 항목 | 이전 (섹션30) | 이후 |
|------|:------------:|:----:|
| TTL 트리플 | 11,080 | **11,470** |
| Neo4j 노드 | 1,516 | **1,732** |
| 시뮬레이션 장비 | 201 | **284** |
| 시뮬레이션 포인트 | 584 | **670** |
| SIMULATABLE 타입 | 39 | **47** |
| 제어 가능 장비 | 136 | **219** |
| 토폴로지 OFF/N/A 장비 | 102 | **0** |
| 프론트엔드 장비 판별 | 303 | **284** (19개 오분류 정정) |

### 31.9 수정/신규 파일 목록

| 파일 | 유형 | 변경 |
|------|------|------|
| `ontology/GEC_B_Ontology.ttl` | 수정 | +78 On_Off_Status 포인트, +390 트리플 |
| `server-a/backend/app/services/neo4j_service.py` | 수정 | 토폴로지 가변깊이 쿼리, _classify_node_type 정비 |
| `server-a/frontend/app/topology/page.tsx` | 수정 | _isEquipmentByLabels 분류 정비, isSimulated 로직 |
| `server-a/backend/app/services/equipment_classification.py` | 수정 | +8 카테고리, +8 CONTROLLABLE |
| `server-b/app/neo4j_loader.py` | 수정 | +8 CONTROLLABLE 타입 |
| `server-c/app/neo4j_loader.py` | 수정 | +8 SIMULATABLE 타입 |
| `server-c/app/profiles/profile_factory.py` | 수정 | +4 POWER_OVERRIDE |

---

## 32. 디지털 트윈 UI 리디자인 — Dark Glassmorphism 3D 테마 (2026.02.20)

### 32.1 배경

기존 BEES 프론트엔드는 밝은 기업 SaaS 스타일(white background, gray borders, blue accents)로, 디지털 트윈 플랫폼의 미래지향적 이미지와 맞지 않았음. 사용자 요청: "디지털 트윈 컨셉, 3D 입체감, 세련된 디자인".

### 32.2 디자인 시스템 변경

**컬러 팔레트 전환 (Light → Dark):**
- 배경: `bg-gray-50` → `bg-slate-950` + CSS gradient (`from-slate-950 via-blue-950/50`)
- 카드: `bg-white border-gray-200` → `bg-white/5 backdrop-blur-xl border-white/10`
- 텍스트: `text-gray-900/500` → `text-white/slate-400`
- 액센트: `blue-600` → `cyan-400` (#22d3ee)
- 상태색: green → emerald (glow), red → rose (glow), yellow → amber (glow)

**3D/깊이 효과:**
- glassmorphism 카드: `backdrop-blur-xl` + semi-transparent background
- neon glow shadow: `shadow-glow-sm/glow/glow-lg/glow-emerald/glow-rose/glow-amber`
- 장비 ON 상태: `shadow-[0_0_12px_rgba(52,211,153,0.4)]` (emerald glow)
- 사이드바/헤더: `bg-slate-900/80 backdrop-blur-2xl`

**Tailwind 확장:**
- `dt` 색상 팔레트 (bg, card, border, accent, glow)
- 6종 glow boxShadow
- `pulse-glow` animation (2s ease-in-out infinite)

**globals.css 추가:**
- 다크 스크롤바 (slate 계열)
- `.glass-card` 유틸리티 클래스
- `.bg-grid` 그리드 배경 패턴 (cyan 0.03 opacity)
- `.text-glow-cyan`, `.text-glow-emerald` 네온 텍스트

### 32.3 컴포넌트 변환

**UI 기반 컴포넌트 (6개):**
| 컴포넌트 | 핵심 변환 |
|---------|----------|
| `card.tsx` | `bg-white/5 backdrop-blur-xl border-white/10 shadow-glow-sm` |
| `badge.tsx` | 각 variant에 반투명 bg + glow border (`bg-cyan-500/10 border-cyan-500/20`) |
| `button.tsx` | gradient 버튼 (`from-cyan-500 to-blue-500`) + hover glow |
| `toast.tsx` | 다크 glassmorphism + variant별 glow |
| `sheet.tsx` | `bg-slate-900/95 backdrop-blur-2xl border-l border-white/10` |
| `layout.tsx` | body: `bg-slate-950 text-white` |

**레이아웃 컴포넌트 (4개):**
| 컴포넌트 | 핵심 변환 |
|---------|----------|
| `sidebar.tsx` | `bg-slate-900/80 backdrop-blur-2xl`, 활성: `bg-cyan-500/10 text-cyan-400` |
| `header.tsx` | `bg-slate-900/60 backdrop-blur-xl border-b border-white/5` |
| `client-layout.tsx` | main에 `bg-grid` 추가 |
| `alarm-banner.tsx` | critical: `bg-rose-500/10`, warning: `bg-amber-500/10` |

### 32.4 페이지 변환 (20개 전체)

모든 페이지에 동일 규칙 일관 적용:
```
bg-white → bg-white/5 backdrop-blur-xl
border-gray-200 → border-white/10
text-gray-900 → text-white
text-gray-500 → text-slate-400
hover:bg-gray-50 → hover:bg-white/5
text-blue-600 → text-cyan-400
bg-blue-600 → bg-cyan-500
shadow-sm → shadow-glow-sm
```

**특별 처리 페이지:**
- **로그인**: 그라디언트 배경 (`from-slate-950 via-blue-950`), 글로우 카드, 그라디언트 버튼
- **제어**: ON 장비 `shadow-glow-emerald`, OFF 장비 `shadow-glow-rose`
- **차트 (energy, history, monitoring, dashboard 위젯)**: Recharts 다크 테마 — CartesianGrid `rgba(255,255,255,0.05)`, 축 tick `#94a3b8`, Tooltip `rgba(15,23,42,0.9)` 배경, 라인 색상 `["#22d3ee","#34d399","#fbbf24","#818cf8","#f472b6"]`
- **온톨로지**: Cytoscape 노드 라벨/배경 다크 변환
- **토폴로지**: TreeItem, EquipmentCard 글로우 상태 표시

### 32.5 실행 방식

4개 에이전트 병렬 처리:
1. **Foundation** (직접): tailwind.config.ts, globals.css, layout.tsx, UI 컴포넌트 6개 → 8개 파일
2. **Agent-Layout**: sidebar, header, client-layout, alarm-banner, dashboard 위젯 8개, page.tsx → 13개 파일
3. **Agent-Pages-A**: login, monitoring, control, topology, ontology, energy, history, live-chart, floors 4개 → 14개 파일
4. **Agent-Pages-B**: alarms, chat, scenarios, data-quality, maintenance, reports, settings 3개 → 10개 파일

Phase 1(Foundation) 완료 후 Phase 2(3개 에이전트 병렬) → Phase 3(빌드 검증+배포).

### 32.6 결과

| 항목 | 수치 |
|------|:----:|
| 변환 파일 수 | **43** |
| 추가/삭제 라인 | +1,211 / -1,134 |
| 신규 Tailwind 토큰 | dt 색상 5종, glow shadow 6종, animation 1종 |
| CSS 유틸리티 | glass-card, bg-grid, text-glow-cyan, text-glow-emerald |
| Next.js 빌드 | 0 errors |
| TypeScript 검증 | 0 errors |

### 32.7 수정 파일 목록

| 레이어 | 파일 | 변경 |
|--------|------|------|
| 디자인 시스템 | `tailwind.config.ts` | dt 팔레트, glow shadow, animation |
| 디자인 시스템 | `globals.css` | 다크 스크롤바, glass-card, bg-grid |
| 디자인 시스템 | `app/layout.tsx` | body `bg-slate-950 text-white` |
| UI 컴포넌트 | `ui/card.tsx` | glassmorphism 기본 |
| UI 컴포넌트 | `ui/badge.tsx` | 다크 glow variant |
| UI 컴포넌트 | `ui/button.tsx` | gradient + glow |
| UI 컴포넌트 | `ui/toast.tsx` | 다크 glassmorphism |
| UI 컴포넌트 | `ui/sheet.tsx` | 다크 glass panel |
| 레이아웃 | `layout/sidebar.tsx` | 다크 glass sidebar |
| 레이아웃 | `layout/header.tsx` | 다크 glass header |
| 레이아웃 | `client-layout.tsx` | bg-grid 배경 |
| 레이아웃 | `alarm-banner.tsx` | rose/amber glow |
| 대시보드 | `dashboard/dashboard-grid.tsx` | 다크 그리드 |
| 대시보드 | `dashboard/widget-*.tsx` (7개) | KPI font-mono, neon 상태, 다크 차트 |
| 페이지 | 20개 전체 | 다크 글래스모피즘 일관 적용 |
| 차트 | `charts/live-chart.tsx` | Recharts 다크 테마 |
| 층별 | `floors/*.tsx` (4개) | 다크 히트맵/카드/리스트/상세 |

## 33. 토폴로지 페이지 리디자인 — 3D 프로세스 플로우 (2026.02.20)

### 33.1 배경

섹션 32에서 전체 다크 글래스모피즘 테마 적용 완료 후, 토폴로지 페이지를 **3D 디지털 트윈 프로세스 플로우** 스타일로 전면 리디자인.
기존: 왼쪽 트리 + 오른쪽 장비 그리드/리스트 단순 뷰 (896줄 단일 파일).
변경: 왼쪽 트리 유지 + 오른쪽 **4가지 뷰 모드** (건물 개요 / 층 상세 / 장비 상세 / 시스템 개요) 프로세스 플로우 다이어그램.

### 33.2 Agent Teams 실행

TeamCreate로 `topology-redesign` 팀 구성, 2명 병렬 작업:

| 팀원 | 역할 | 파일 수 | 결과 |
|------|------|:------:|------|
| component-builder | 신규 컴포넌트 9개 + CSS 유틸리티 | 10 | 완료 |
| page-integrator | page.tsx 리팩토링 + i18n 키 30+ | 3 | 완료 |

### 33.3 신규 컴포넌트 (`components/topology/`)

| 파일 | 줄 수 | 역할 |
|------|:-----:|------|
| `utils.ts` | 77 | 유틸 함수 추출 (getTypeIcon, _isEquipmentByLabels 등) |
| `flow-card.tsx` | 80 | 층/장비 공통 플로우 카드 (상태배지, 가동률바, 센서카운트) |
| `flow-connector.tsx` | 29 | CSS 기반 플로우 연결선 (수평/수직/화살표) |
| `group-container.tsx` | 50 | 색상 테두리 그룹 래퍼 (cyan/purple/emerald/amber/slate) |
| `status-indicator.tsx` | 72 | NORMAL/WARNING/CRITICAL 상태 배지 + 가동률 바 |
| `building-overview.tsx` | 183 | 건물 개요 뷰 — 지상/지하/옥상 그룹 + 층 카드 플로우 |
| `floor-detail-view.tsx` | 327 | 층 상세 뷰 — 룸 그리드 + 장비 카테고리별 프로세스 플로우 + 환경 |
| `equipment-detail-view.tsx` | 264 | 장비 상세 뷰 — 히어로 카드 + 부품 + 센서 테이블 + 모니터링 링크 |
| `system-overview.tsx` | 167 | 시스템 개요 뷰 — BAS 등 시스템 하위 장비 카테고리 플로우 |

### 33.4 4가지 뷰 모드

**1. BuildingOverview** (GEC_Tower_B 클릭)
- 층을 3그룹(지상 사무층/지하 기계층/옥상)으로 분류, GroupContainer(cyan/purple/emerald)로 묶음
- 각 층 FlowCard: 이름, 타입배지, 장비 가동률 프로그레스 바, E:n S:n 카운트
- 그룹 간 FlowConnector(수직 화살표) 연결

**2. FloorDetailView** (특정 층 클릭)
- 공간 섹션: Room 카드 그리드 (이름, 타입, 면적, 환경센서값) — getFloorDetails API 활용
- 장비 프로세스 플로우: 카테고리별 GroupContainer (HVAC/전기/수배관/기타)
- 환경 요약: 온도/습도/CO2 대시 카드 (SSE 실시간)

**3. EquipmentDetailView** (장비 클릭)
- 히어로 카드: 상태(ON/OFF), 운전 모드(auto/standby), 마지막 업데이트
- 하위 부품 FlowCard 그리드
- 센서 현재값 테이블
- 모니터링 상세 링크 (`/monitoring/{id}`)

**4. SystemOverview** (BAS 등 시스템 노드 클릭)
- 하위 장비를 카테고리별 GroupContainer + FlowCard로 표시
- BuildingOverview와 유사한 레이아웃이나 장비 카드 기반

### 33.5 수정 파일

| 파일 | 변경 |
|------|------|
| `app/topology/page.tsx` | 896줄 → 329줄 (뷰 라우팅 구조로 리팩토링) |
| `app/globals.css` | flow-line-h/v, flow-dot, flow-arrow CSS 유틸리티 추가 |
| `messages/ko.json` | topology 섹션 30+ 키 추가 |
| `messages/en.json` | topology 섹션 30+ 키 추가 |

### 33.6 핵심 디자인 요소

- **FlowCard**: dark glass bg + 상태 배지(emerald/amber/rose) + 가동률 바 + 센서 카운트
- **GroupContainer**: `border-l-2 border-{color}-500/50 bg-{color}-500/5` 색상 그룹 래퍼
- **FlowConnector**: CSS linear-gradient 기반 연결선 (SVG 없음)
- **카테고리 분류**: HVAC(cyan), 전기(amber), 수배관(indigo), 기타(slate)
- **SSE 실시간**: 장비 ON/OFF, 센서값, 가동률 모두 실시간 반영

### 33.7 검증

| 항목 | 결과 |
|------|------|
| `npx next build` | 21페이지 0 errors |
| Docker 재배포 | `bees-frontend` 정상 가동 |
| `/topology` 접속 | 200 OK |
| page.tsx 축소율 | 896줄 → 329줄 (63% 축소) |
| 신규 컴포넌트 | 9개, 총 1,249줄 |

## 34. 토폴로지 재설계 — 온톨로지 기반 건물 단면도 (2026.02.20)

### 34.1 배경

섹션 33의 하드코딩 프로세스 체인(4개 시스템: CHW/HW/CW/ELEC) 방식을 **폐기**하고,
**실제 온톨로지 계층 구조** 기반으로 건물 단면도(Cross-Section) 시각화를 전면 재설계.

**핵심 변경**: 하드코딩 → 온톨로지 데이터 드리븐. 18개 층을 RF(상단)→B4F(하단) 순서로 쌓고,
각 층에 실제 장비/존을 React Flow로 표현. 층간 feeds 연결을 애니메이션 엣지로 시각화.

### 34.2 데이터 아키텍처 발견

- **장비는 BAS 시스템 하위**에 위치 (층 하위가 아님)
- 층 노드에는 **존(Zone)과 실(Room)** 만 포함
- 장비→층 매핑은 **3단계 추론**: (1) 이름 패턴 (2) 기본 할당 (3) feeds 연결 분석
- 260개 feeds 연결 중 58개가 주요 장비 간 직접 연결

### 34.3 3단계 장비→층 추론

| 단계 | 방법 | 예시 |
|------|------|------|
| 1. 이름 패턴 | `CC_Panel_9F_Int` → B_9F | 정규식 `[_-](\d{1,2})F` |
| 2. 기본 할당 | `Chiller_1` → B_B1F (기계실) | 장비 유형별 고정 매핑 |
| 3. feeds 추론 | `AHU_UFAD_2` → B_6F | feeds 대상 존의 층을 투표 |

결과: 97개 주요 장비, 18개 층에 배치. __COMMON__ 잔여 1개만.

### 34.4 신규 파일 (`components/topology/`)

| 파일 | 역할 |
|------|------|
| `cs-utils.ts` | 층 정렬, 장비→층 추론, 카테고리 분류, 시스템 컬러, 주요 장비 필터 |
| `cs-nodes.tsx` | 커스텀 노드 3종 (FloorBandNode, CompactEquipCard, ZoneChipNode) |
| `cs-edges.ts` | 엣지 빌더 (층내 thin + 층간 bold, 시스템 컬러, 애니메이션) |
| `cs-layout.ts` | 레이아웃 엔진 (2200×dynamic 층 밴드 + 180×72 장비카드 + 90×32 존칩) |
| `cs-canvas.tsx` | React Flow 캔버스 + SSE 실시간 + MiniMap + 범례 |

### 34.5 React Flow 노드 3종

**1. FloorBandNode** (2200 × 동적 높이)
- 좌측 3px 컬러바: 옥상=emerald, 사무=cyan, 포디움=amber, 지하=purple
- 헤더: 층 이름 + 장비·존·실·센서 통계 + 가동률 미니바

**2. CompactEquipCard** (180 × 72px, parentNode로 층 밴드 내 배치)
- 3행: 이름+RUN/STOP | 카테고리배지+운전률바+% | 센서 수
- 좌측 2px 시스템 컬러 악센트, 클릭→모니터링 상세

**3. ZoneChipNode** (90 × 32px pill)
- 층 우측에 배치, 존 축약명 표시

### 34.6 엣지 설계

| 타입 | strokeWidth | animation | 글로우 |
|------|:-----------:|-----------|--------|
| 층내 (intra-floor) | 2 | 0.8s dash | 약한 |
| 층간 (cross-floor) | 3 | 2.5s dash | 강한, 라벨(냉수/온수/냉각수/전력) |

### 34.7 수정 파일

| 파일 | 변경 |
|------|------|
| `app/topology/page.tsx` | FlowCanvas → CsCanvas 교체 |
| `app/globals.css` | cs-canvas, cross-floor-edge, equip-card-active CSS 추가 |

### 34.8 층별 장비 배치 결과

| 층 | 장비 수 | 주요 장비 |
|:--:|:------:|----------|
| RF | 7 | 냉각탑×3, 배기팬×2, 태양광×2 |
| 5F~15F | 각 3 | CC_Panel×2 + AHU_UFAD×1 |
| 3F | 2 | FCU×2 |
| 2F | 2 | FCU + AHU_UFAD_11 |
| 1F | 15 | 엘리베이터×11, 에어커튼, PAC |
| B1F | 34 | 칠러×4, 보일러×3, 펌프×14, 변압기, UPS, DOAS×3 |
| B2F~B4F | 각 2 | 배기팬 + 급기팬 |

### 34.9 검증

| 항목 | 결과 |
|------|------|
| `npx next build` | 21페이지 0 errors |
| Docker 재배포 | `bees-frontend` 정상 가동 |
| `/topology` HTTP | 200 OK (43KB) |
| 주요 장비 | 97개 (중복 제거) |
| 층 배치 | 18개 층 + __COMMON__ 1개 |
| feeds 엣지 | 260개 connections, 주요 장비 간 58개 |

## 35. 온톨로지 그래프 Neo4j Bloom 스타일 리디자인 (2026.02.20)

### 35.1 배경

온톨로지 페이지의 Cytoscape.js 그래프를 **Neo4j Bloom** 스타일로 전면 리디자인.
기존 평면 노드 → 다크 fill + 네온 ring border + underlay glow halo 스타일로 변경.

### 35.2 노드 시각 스타일

| 타입 | fill (dark) | ring (neon) | shape |
|------|-------------|-------------|-------|
| Building | #0c1a3d | #60a5fa | round-rectangle |
| Floor | #150f2e | #a78bfa | round-rectangle |
| Zone | #0d2520 | #34d399 | hexagon |
| System | #1f1508 | #fbbf24 | diamond |
| Equipment | #081e28 | #22d3ee | ellipse |
| Sensor | #071a12 | #4ade80 | tag |

- 노드 크기 42px (Building 52px, Sensor 26px)
- `border-width: 3.5`, `underlay-opacity: 0.15`, `underlay-padding: 8` (glow halo)
- Per-type `radial-gradient` inner glow
- 엣지 7종 시스템별 컬러 + 스타일 (feeds=빨강 dashed, hasPart=파랑 solid, isPointOf=초록 dotted 등)
- 통계 오버레이 (NODE / EDGE / TYPE 카운트)
- cose-bilkent 레이아웃: idealEdgeLength 250, nodeRepulsion 18000, gravity 0.08

### 35.3 수정 파일

| 파일 | 변경 |
|------|------|
| `app/ontology/page.tsx` | NODE_3D, NODE_SHAPES, EDGE_STYLES, 스타일 전면 교체, 통계 바 추가 |
| `app/globals.css` | `.ontology-graph` ambient 배경 (radial-gradient 3중 겹침) |
| `lib/api.ts` | fetchJSON 타임아웃 15s→45s |

---

## 36. 대시보드 장비 가동률 버그 수정 (2026.02.20)

### 36.1 문제

대시보드 KPI "장비 가동률"이 **284/175 = 162%** 표시.
- `activeDevices`: MQTT 전체 devices (컴포넌트 포함 284개) 중 is_active 카운트
- `totalDevices`: equipmentList (category≠component 필터) 기준 175개

### 36.2 수정

`app/page.tsx`의 `activeDevices` 계산을 `equipmentList` 기준으로 변경:

```typescript
const activeDevices = useMemo(() => {
  if (equipmentList.length === 0) return summary?.kpi.active_devices || 0;
  let count = 0;
  for (const eq of equipmentList) {
    const dev = devices[`bldg:${eq.id}`] || devices[eq.id];
    if (dev?.is_active) count++;
  }
  return count;
}, [devices, equipmentList, summary]);
```

---

## 37. 토폴로지 장비 카드 아이콘 + 3× 스케일업 (2026.02.20)

### 37.1 장비 타입별 아이콘

lucide-react 아이콘 19개 매핑 규칙으로 장비명/라벨 기반 자동 매핑:

| 장비 | 아이콘 | 장비 | 아이콘 |
|------|--------|------|--------|
| Chiller | Snowflake | Transformer | Zap |
| Boiler | Flame | UPS | BatteryCharging |
| AHU/DOAS | Wind | Solar/PV | Sun |
| FCU/Fan | Fan | Elevator | ArrowUpDown |
| Cooling Tower | Droplets | CC_Panel | Cpu |
| Pump | Gauge | Heat Exchanger | ArrowLeftRight |
| VAV/Damper | SlidersHorizontal | 기타 | Box |

카드 좌측에 56×56 아이콘 박스 (시스템 컬러 배경 + Active 시 glow).

### 37.2 가로 배치 제한

`MAX_EQUIP_PER_ROW = 5` — 카테고리별 한 줄 최대 5개, 초과 시 다음 줄 자동 배치.

### 37.3 3× 스케일업 (원본 대비)

fitView가 18개 층 전체를 화면에 우겨넣어 줌아웃되는 문제 해결.
fitView 제거 → **고정 줌 0.7**로 시작, 마우스 스크롤/드래그로 건물 탐색.

| 항목 | 원본 | 최종 | 배율 |
|------|------|------|:----:|
| 장비 카드 | 180×72 | 380×140 | 2.1× |
| 아이콘 박스 | — | 56×56 | 신규 |
| 카드 이름 폰트 | 11px | 18px | 1.6× |
| 층 이름 폰트 | 18px | 36px | 2.0× |
| 존 칩 | 90×32 | 180×64 | 2.0× |
| 층 밴드 너비 | 1300 | 2800 | 2.2× |
| 층 헤더 영역 | 110 | 260 | 2.4× |
| 프로그레스 바 높이 | 5px | 8px | 1.6× |
| 기본 줌 | fitView 0.3~ | 고정 0.7 | 2.3× |

### 37.4 수정 파일

| 파일 | 변경 |
|------|------|
| `cs-nodes.tsx` | lucide-react 아이콘 매핑, 카드/존칩/층 헤더 크기 3× |
| `cs-layout.ts` | 모든 치수 3×, MAX_EQUIP_PER_ROW=5 |
| `cs-canvas.tsx` | fitView 제거 → setViewport(zoom: 0.7) |

---

*이 파일은 프로젝트 컨텍스트 보존을 위해 생성되었습니다. `/clear` 후 이 파일을 읽으면 전체 맥락을 복원할 수 있습니다.*

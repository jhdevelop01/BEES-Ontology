# BEES Ontology 프로젝트 히스토리

> **최종 업데이트:** 2026.02.12 (Phase 9 — 디지털 트윈 IoT 시뮬레이션 플랫폼 구축)
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
| **GEC_B_SHACL.ttl** | `ontology/` | ~480줄, 19개 Shape |

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

### SHACL 검증 Shape 19개 (v2.0)
**기존 11개:**
1. SiteShape — Site 필수 속성 (label, hasPart)
2. BuildingShape — Building 필수 속성 (label, isPartOf)
3. FloorShape — Floor 필수 속성 (label, isPartOf Building)
4. HVACZoneShape — HVAC Zone 필수 속성 (label, isPartOf)
5. ChillerShape — Chiller 필수 속성 (label, isPartOf)
6. AHUShape — AHU 필수 속성 (label, isPartOf)
7. BoilerShape — Boiler 필수 속성 (label, isPartOf)
8. TemperatureSensorShape — 센서 연결 (label, isPointOf/hasLocation)
9. EstimatedDataShape — hasConfidence 값 범위 (confirmed/estimated/inferred)
10. LEEDCategoryShape — LEED 크레딧 (category, achieved/available)
11. GSEEDCategoryShape — G-SEED 분야 (category, achievedScore)

**Phase 8 추가 8개:**
12. AHUFeedsShape — AHU feeds >= 1
13. ChillerFeedsShape — Chiller feeds >= 1
14. PumpFeedsShape — Pump feeds >= 1 (Warning)
15. CoolingTowerFeedsShape — Cooling Tower feeds >= 1
16. EquipmentLocationShape — Equipment hasLocation 권장 (Warning)
17. ElevatorShape — Elevator 필수 속성 (label, hasLocation)
18. FCUShape — FCU 필수 속성 (label, feeds)
19. OccupancySensorShape — Occupancy Sensor 연결 (label, isPointOf/hasLocation)

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
BEES Ontology/
├── CLAUDE.md                                  # 프로젝트 설정 및 규칙
├── ontology/
│   ├── GEC_B_Ontology.ttl                     # ★ 메인 온톨로지 (v2.0.1)
│   └── GEC_B_SHACL.ttl                        # ★ SHACL 검증 Shape (v2.0)
└── _docs/
    ├── 01_건물_설비_정보.md                    # 건물정보+인증+입주+HVAC+설비+스마트빌딩 (6파일 통합)
    ├── 02_에너지_ESG_데이터.md                 # GHG, 에너지사용량, ESG보고서
    ├── 03_참고자료.md                          # Brick Schema + 학술논문 (2파일 통합)
    ├── 04_인증_벤치마킹_설비추론.md             # LEED 크레딧, 유사건물 벤치마킹
    ├── 05_데이터_확보_및_출처추적.md            # 확보현황 + 출처추적표 (2파일 통합)
    ├── 06_온톨로지_구축_방법론.md               # ★ 구축 프로세스 재현 가이드 (1,054줄)
    ├── 07_온톨로지_통계_요약.md                 # 온톨로지 인스턴스 통계 (rdflib 추출)
    ├── 08_개발_원칙.md                         # ★ TTL-First 원칙, 변경 워크플로우, Neo4j 동기화 규칙
    ├── history.md                              # ★ 이 파일 (프로젝트 히스토리)
    ├── 세션요약_20260211.md                    # 세션별 작업 요약
    ├── GEC_B동_온톨로지_통계.xlsx               # ★ 층별 중심 통계 엑셀 (5시트, rdflib 추출)
    ├── GEC_B동_데이터_요청서.pdf                # 내부 데이터 요청서
    └── 검증_쿼리/
        ├── SPARQL_검증_쿼리_결과_20260211.md   # SPARQL 10개 쿼리 검증 결과
        └── rdfs_comment_보강_결과_20260211.md  # rdfs:comment 45건 보강 결과
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
| 23 | "Phase 8 계획 세워줘" | Phase 8: v1.9.1→v2.0, 에너지 흐름 완성(feeds +78), hasPart 미러링(6시스템), 엘리베이터 개별화(10대), 2F/3F 보강, SHACL v2.0(19 shapes) |
| 24 | "검증 쿼리 결과를 파일로 저장해줘" | `_docs/검증_쿼리/SPARQL_검증_쿼리_결과_20260211.md` 생성 (SPARQL 10개 쿼리) |
| 25 | "온톨로지가 LLM 자연어 쿼리에 적합한지 평가" | LLM 적합성 분석: 83/100점, 한글 라벨 100%, 관계 3,349개, Neo4j 임포트 준비 완료 |
| 26 | "개발 원칙 파일 생성해줘" | `_docs/08_개발_원칙.md` 생성 (TTL-First 원칙, Neo4j 동기화 규칙, 변경 워크플로우) |
| 27 | "rdfs:comment 보강해줘" | v2.0→v2.0.1, 주요 장비/시스템 45건 comment 추가 (5,711→5,756 트리플) |
| 28 | "보강 결과 파일로 저장해줘" | `_docs/검증_쿼리/rdfs_comment_보강_결과_20260211.md` 생성 |
| 29 | "폴더 정리해줘 — Docs 폴더 생성, 통합, 중복 제거" | 7개 폴더→2개(ontology+_docs), 28파일→16파일, 10파일→3파일 통합, 5파일 삭제, 전체 경로 참조 업데이트 |
| 30 | "Neo4j 구축 진행하자" | Docker neo4j-bees 컨테이너 생성 (neo4j:5.26.0 + n10s), TTL 5,756 트리플 전량 임포트, 관계 6종 완전 일치 검증, `scripts/verify_neo4j.py` 생성 |
| 31 | "디지털 트윈 시뮬레이션 플랫폼 만들자" | Phase 9: 4-서버 아키텍처 설계 + MVP 구현. Server A(FastAPI+Next.js 대시보드), B(BAS Adapter), C(가상 건물 에뮬레이터), D(Data Historian). Docker Compose 8서비스 오케스트레이션 |
| 32 | "프론트엔드 데이터 안 보여" | SSE 크로스스레드 이슈 진단+수정(asyncio.Event→polling), 타임스탬프 포맷 변환(ISO→Unix), 센서ID 매핑 수정, Docker 포트 충돌 6건 해결 |

---

## 12. Phase 9: 디지털 트윈 IoT 시뮬레이션 플랫폼 (2026.02.11~12)

### 개요
Brick Schema 온톨로지(845 인스턴스)를 기반으로 4개 독립 서버 구성의 디지털 트윈 IoT 시뮬레이션 플랫폼 구축.

### 아키텍처
| 서버 | 역할 | 기술스택 | 호스트 포트 |
|------|------|----------|------------|
| Server A Backend | 온톨로지 웹 서비스 (REST API, SSE, Neo4j 연동) | FastAPI, Python | 8010 |
| Server A Frontend | 대시보드 + 모니터링 UI | Next.js, TypeScript, Tailwind, shadcn/ui | 3000 |
| Server B | BAS Adapter (프로토콜 게이트웨이) | FastAPI, Python | 8011 |
| Server C | 가상 건물 에뮬레이터 (센서 데이터 생성) | FastAPI, AsyncIO, Python | 8012 |
| Server D | Data Historian (시계열 수집/조회) | FastAPI, PostgreSQL, Python | 8013 |

### 인프라 (Docker Compose)
| 서비스 | 이미지 | 호스트 포트 |
|--------|--------|------------|
| Mosquitto | eclipse-mosquitto:2 | 1885 |
| InfluxDB | influxdb:2.7 | 8088 |
| PostgreSQL | postgres:16 | 5434 |
| Neo4j | neo4j:5.26.0 (기존 neo4j-bees) | 7476/7689 |

### 데이터 흐름
1. **센서 데이터**: Server C → MQTT(bees/points/#) → Server A(SSE) + Server D(저장)
2. **장비 제어**: Frontend → Server A → Server B → Server C
3. **온톨로지 조회**: Frontend → Server A → Neo4j (Cypher)

### MVP 구현 (Phase 1 완료)
- AHU_5F 장비 + 5개 센서 시뮬레이션 동작
- 5초 간격 데이터 생성 (온도, 습도, 급기온도, 필터차압, 전력)
- SSE 실시간 스트림 + 대시보드 KPI 표시
- 장비 제어 (ON/OFF, 모드 변경) End-to-End 동작

### 디버깅 이력
- **SSE 크로스스레드 이슈**: Python 3.12 `asyncio.Event`가 MQTT 백그라운드 스레드에서 동작 안함 → polling 방식(`_event_counter` + `threading.Lock`)으로 교체
- **타임스탬프 포맷**: Server C(ISO 8601) vs Frontend(Unix) → `_parse_ts()` 변환 함수 추가
- **센서 ID 불일치**: 프론트엔드 하드코딩 ID → 실제 온톨로지 point_id로 매핑 수정
- **Docker 포트 충돌**: hvac-*, bees-otel-* 등 기존 프로젝트와 6건 포트 충돌 → 전부 고유 포트로 변경

---

## 10. 검증 방법

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

## 11. 다음 작업 가이드

### 만약 내부 데이터가 확보되면 (Phase 4)
1. 평면도 → `brick:Room` 인스턴스 추가, Zone 세분화
2. BMS 포인트 리스트 → `brick:Point` 하위 센서/명령/설정값 정밀 모델링
3. 장비 대장 → 제조사/모델명/시리얼 속성 추가 (`brick:hasModel`, `ref:hasExternalReference`)
4. BEMS 데이터 → 실측 에너지 값으로 추정값 교체, `confirmed`로 신뢰도 변경
5. SHACL 검증 실행 → 오류 수정

### 온톨로지 수정 시 주의사항
- **TTL 수정 후 반드시 rdflib 파싱 검증** (구문 오류 방지)
- **신뢰도 태깅 유지**: 새 데이터 추가 시 `bees:hasConfidence` 반드시 기재
- **B동 범위 유지**: 새 인스턴스는 `bldg:GEC_Tower_B` 또는 그 하위에 연결
- **SHACL 대상 업데이트**: 새 클래스 추가 시 해당 Shape도 추가 검토
- **`bees:` 네임스페이스**: 커스텀 클래스/속성은 반드시 `bees:` 접두사 사용

---

*이 파일은 프로젝트 컨텍스트 보존을 위해 생성되었습니다. `/clear` 후 이 파일을 읽으면 전체 맥락을 복원할 수 있습니다.*

# GEC B동 Brick Schema 온톨로지 - 에너지 및 ESG 데이터

## 개요

Brick Schema 온톨로지 구축을 위해 삼성E&A(삼성엔지니어링) 및 삼성물산의 ESG/지속가능경영보고서에서 GEC 사옥 관련 에너지 및 설비 데이터를 조사한 결과.

> **조사 일자:** 2026.02.10
> **최종 업데이트:** 2026.02.10 (v1.6 — 서울시 에너지다소비건물 실측 데이터 반영)
> **조사 범위:** 삼성E&A 지속가능경영보고서 (2020~2024), 삼성물산 지속가능경영보고서, 공개 데이터, DART 사업보고서, **서울시 에너지다소비건물 공개자료**
> **온톨로지:** GEC_B_Ontology.ttl v1.6 (2,070줄, 1,464 트리플)

---

## 1. 삼성E&A(삼성엔지니어링) 지속가능경영보고서

### 1.1 보고서 다운로드 링크

| 연도 | 언어 | URL |
|------|------|-----|
| 2024 (14번째) | 한국어 | https://www.samsungena.com/filesview/2024%20SAMSUNG%20E&A%20Sustainability%20Report%20(Kor).pdf?folder=/upload/publishing/&storedfile=098f18f22d5d494594e63d389d5d3285.pdf |
| 2024 | 영문 | https://www.samsungena.com/filesview/2024%20SAMSUNG%20E&A%20Sustainability%20Report%20(Eng).pdf?folder=/upload/publishing/&storedfile=2801fc6fe3804df495385e42a2a300cc.pdf |
| 2023 | 영문 | https://www.samsungena.com/filesview/Interactive_2023_SAMSUNG%20E&A%20Sustainability%20Report%20(ENG).pdf?folder=/upload/publishing/&storedfile=7b04b82affae4a0daa74eea9677a664d.pdf |
| 2022 | 영문 | https://www.samsungena.com/filesview/Interactive_2022%20Samsung%20Engineering%20Sustainability%20Report%20(Eng)_r.pdf?folder=/upload/publishing/&storedfile=1a7353e9cbca4f46a215932b83c1fc92.pdf |
| 2021 | 영문 | https://www.samsungena.com/resources/en/file/2021_Samsung_Engineering_Sustainability_Report_En.pdf |
| 전체 보고서 목록 | - | https://www.samsungena.com/kr/newsroom/publications |
| 환경경영 페이지 | - | https://www.samsungena.com/kr/sustainability/environmental/environment |
| 지속가능경영 개요 | - | https://www.samsungena.com/kr/sustainability/overview |

### 1.2 확인된 환경 전략/목표

| 항목 | 내용 | 출처 |
|------|------|------|
| 넷제로 목표 | **2050년 탄소중립(Net Zero)** 달성 | 2024 보고서 |
| 재생에너지 목표 | **2030년 재생에너지 100% 사용** (RE100) | 2024 보고서 |
| 에너지 경영 인증 | **ISO 50001** 인증 (국내외 전 현장) | 2024 보고서 |
| 환경관리 인증 | **ISO 14001** 인증 (LRQA 발급) | 공식 웹사이트 |
| 환경에너지 관리 시스템 | **SEEM-S** (자체 개발, 국내외 전 현장 온실가스 통합 관리) | 2024 보고서 |
| 태양광 발전시설 | 총 용량 **1,893 kW** | 공식 웹사이트 |
| 무공해차 전환 | 국내 업무용 차량의 무공해차 전환 추진 중 | 2024 보고서 |
| 재생에너지 인증서 | 녹색프리미엄, REC 구매 (국내외) | 2024 보고서 |

### 1.3 ESG 등급/평가

| 연도 | KCGS 종합 | 환경(E) | 사회(S) | 지배구조(G) | CDP 등급 |
|------|----------|---------|---------|-------------|----------|
| 2024 | **A** | A | A | A | - |
| 2023 | **A** | A+ | A+ | A | - |
| 2022 | **A** | A | A+ | B+ | Management B |
| 2021 | - | - | - | - | Leadership A- |

> **참고:** CDP 기후변화 평가에 2009년부터 참여. 2014, 2018, 2021년에 Leadership A-, 2015~2017, 2019년에 Leadership A 등급.

### 1.4 환경 정량 데이터

#### 1.4.1 온실가스(GHG) 배출량 - 웹 공개 데이터 (DitchCarbon 기준)

아래 데이터는 DitchCarbon 플랫폼에서 수집된 삼성E&A의 CDP 응답 및 지속가능경영보고서 기반 데이터임. **두 개의 DitchCarbon 항목에서 수치가 상이**하여 양쪽 모두 기재함.

**출처 A: DitchCarbon - Samsung Engineering** (https://ditchcarbon.com/organizations/samsung-engineering)

| 항목 | 2022 | 2023 | 단위 |
|------|------|------|------|
| **Scope 1 (직접 배출)** | **약 34,690** | **약 33,042** | tCO2eq |
| **Scope 2 (간접 배출)** | **약 19,776** | **약 21,412** | tCO2eq |
| **Scope 1+2 합계** | **약 54,466** | **약 54,454** | tCO2eq |
| **Scope 3 (기타 간접)** | **약 323,878** | **약 550,671** | tCO2eq |

**출처 B: DitchCarbon - Samsung Engineering Company Limited** (https://ditchcarbon.com/organizations/samsung-engineering-company-limited-146f8002-b428-44aa-a8df-18c337370f8f)

| 항목 | 2022 | 2023 | 단위 |
|------|------|------|------|
| **Scope 1 (직접 배출)** | **약 30,390** | **약 31,441** | tCO2eq |
| **Scope 2 (간접 배출)** | **약 118,308** | **약 159,799** | tCO2eq |
| **Scope 1+2 합계** | **약 148,698** | **약 191,240** | tCO2eq |
| **Scope 3 (기타 간접)** | **약 3,708** | **약 26,511** | tCO2eq |

> **주의 - 데이터 불일치 분석:**
> - 출처 A의 Scope 1+2 합계(약 54,454 tCO2eq)는 **국내 사업장(본사+국내 현장)** 기준으로 추정됨
> - 출처 B의 Scope 1+2 합계(약 191,240 tCO2eq)는 **글로벌 전체(국내+해외 프로젝트 현장 포함)** 기준으로 추정됨
> - Scope 3 수치 역시 보고 범위(boundary)에 따라 크게 차이남
> - **정확한 수치 확인을 위해 PDF 보고서 부록(Appendix) 직접 열람 필수**

#### 1.4.2 기후 목표 및 감축 전략

| 항목 | 내용 | 출처 |
|------|------|------|
| Scope 1+2 감축 목표 | 2018년 기준 대비 **45% 감축** | DitchCarbon / CDP |
| 무공해차 전환 | 업무용 차량 **156대** 전량 ZEV 전환 (2030년 목표) | DitchCarbon |
| CDP 등급 이력 | 2015-2017, 2019: **Leadership A** / 2014, 2018, 2021: **Leadership A-** / 2022-2023: **Management B** | 공식 웹사이트 |
| 녹색경영대상 | 환경부/산업부 주관 **2024 대한민국 녹색경영대상** 수상 | 뉴스 |
| DJSI | 건설/엔지니어링 부문 **DJSI Asia Pacific 12년 연속**, **DJSI Korea 14년 연속** 편입 | 공식 웹사이트 |
| MSCI ESG | **A등급** (2024년) | 공식 웹사이트 |

#### 1.4.3 PDF 보고서 실데이터 (2024 보고서 직접 추출, Phase 2)

> **추출일:** 2026.02.10 (Phase 2 대안적 확보)
> **출처:** 2024 Samsung E&A Sustainability Report (Eng) PDF - ESG Data / Environmental 섹션

##### GHG 배출량 (Market-based, 제3자 검증)

| 항목 | 2022 | 2023 | 2024 | 단위 |
|------|------|------|------|------|
| **Scope 1+2 합계 (Market)** | **54,466** | **54,454** | **50,007** | tCO2e |
| - 한국 (Korea) | 34,690 | 33,042 | 29,609 | tCO2e |
| - 해외 (Overseas) | 19,776 | 21,412 | 20,398 | tCO2e |
| **본사(HQ) GHG** | **11,123** | **10,943** | **12,872** | tCO2e |
| 현장 보조시설 | 23,859 | 27,031 | 26,770 | tCO2e |
| 건설장비 | 5,799 | 6,833 | 6,112 | tCO2e |
| 차량 | 13,685 | 11,233 | 10,065 | tCO2e |
| **Scope 3 합계** | 323,878 | 550,671 | 3,148,023 | tCO2e |
| - 구매 재화/서비스 | 157,597 | 366,543 | 2,952,935 | tCO2e |
| GHG/매출 원단위 | 5.4 | 5.1 | 5.0 | tCO2e/10억원 |
| 목표 대비 감축량 | 1,647 | 953 | 2,020 | tCO2e |

> **핵심 발견:** 본사(HQ = GEC) GHG 배출량이 **별도 분리 보고**됨!
> - GEC 본사 GHG: **~11,000 tCO2e/년** (2022~2024 평균)
> - 이는 전체 Scope 1+2의 약 20~25% 수준

##### 에너지 소비량

| 항목 | 2022 | 2023 | 2024 | 단위 |
|------|------|------|------|------|
| **총 에너지 소비** | **663,839** | **660,408** | **635,091** | GJ |
| 비재생에너지 | 659,668 | 660,403 | 631,943 | GJ |
| **직접 에너지** | **501,999** | **477,683** | **429,317** | GJ |
| - 휘발유 | 115,924 | 92,370 | 92,607 | GJ |
| - 경유 | 368,196 | 366,070 | 312,573 | GJ |
| - 등유 | 325 | 1,798 | 6,232 | GJ |
| - LNG | 17,475 | 17,067 | 17,894 | GJ |
| - LPG | 79 | 378 | 11 | GJ |
| **간접 에너지** | **157,669** | **182,720** | **202,626** | GJ |
| - 전기 | 143,404 | 171,095 | 191,502 | GJ |
| - 열/증기 (지역난방) | 14,265 | 11,625 | 11,124 | GJ |
| **재생에너지** | **4,171** | **5** | **3,148** | GJ |
| - 태양광 | 17 | 5 | 16 | GJ |
| - 지열 | 4,154 | - | 3,132 | GJ |
| 에너지/매출 원단위 | 66.0 | 62.2 | 63.7 | GJ/10억원 |

> **참고:** 2023년 태양광/지열 = 0~5 GJ로 급감 → 발전시설 고장으로 가동 중단, 2024년 수리 후 재가동
> **2024 목표:** 649,063 GJ (실적 635,091 → 목표 달성)

##### 용수 소비량

| 항목 | 2022 | 2023 | 2024 | 단위 |
|------|------|------|------|------|
| **총 용수 소비** | **981,448** | **1,007,725** | **958,946** | 톤 |
| - 지표수 | 432 | - | - | 톤 |
| - 지하수 | 24,985 | 12,885 | 6,210 | 톤 |
| - 해수 | 104,003 | 118,796 | 103,355 | 톤 |
| - 상수도 | 660,084 | 659,136 | 668,780 | 톤 |
| - 재활용수 | 191,944 | 216,909 | 180,601 | 톤 |
| 용수 방류량 | 789,503 | 790,817 | 778,345 | 톤 |
| 재이용률 | 20% | 22% | 19% | |
| 용수/매출 원단위 | 97.6 | 94.8 | 96.2 | 톤/10억원 |

> **2024 목표:** 980,043톤 (실적 958,946 → 목표 달성)

##### 폐기물 발생 및 처리

| 항목 | 2022 | 2023 | 2024 | 단위 |
|------|------|------|------|------|
| **총 폐기물 발생** | **156,128** | **141,723** | **106,251** | 톤 |
| - 일반 폐기물 | 151,606 | 141,073 | 105,737 | 톤 |
| - 건설 폐기물 | 138,288 | 118,594 | 92,724 | 톤 |
| - 사업장 폐기물 | 13,318 | 22,479 | 13,013 | 톤 |
| - 유해 폐기물 | 4,522 | 650 | 514 | 톤 |
| 매립 | 53,928 | 46,424 | 42,205 | 톤 |
| 소각 | 4,019 | 295 | 285 | 톤 |
| **재활용** | **98,181** | **95,004** | **63,761** | 톤 |
| **재활용률** | **62.9%** | **67.0%** | **60.0%** | |
| 폐기물/매출 원단위 | 15.5 | 13.4 | 10.7 | 톤/10억원 |

##### 환경 인증

| 항목 | 2022 | 2023 | 2024 |
|------|:----:|:----:|:----:|
| ISO 14001 인증률 | 100% | 100% | 100% |
| ISO 50001 인증률 | - | 100% | 100% |
| - Scope 3 (기타 간접) | tCO2eq | 공급망, 출장 등 | 카테고리별 상세 |
| **용수 사용량** | 톤 또는 m3 | `brick:Water_Usage_Sensor` | 웹 미공개 |
| **폐기물 발생량** | 톤 | `brick:Waste_Generation_Sensor` (커스텀) | 웹 미공개 |
| - 일반폐기물 | 톤 | - | |
| - 지정폐기물 | 톤 | - | |
| - 재활용량/재활용률 | 톤/% | - | |
| **에너지 원단위** | TJ/억원 또는 GJ/m2 | 벤치마크용 | 매출 대비 산출 |
| **재생에너지 사용 비율** | % | RE100 진척도 | 2030년 100% 목표 |
| **사업장별 에너지 분류** | - | GEC 본사 분리 가능 여부 | 핵심 확인 사항 |

> **중요:** 삼성E&A는 EPC(설계/조달/시공) 기업으로, 보고서의 환경 데이터에는 전 세계 프로젝트 현장 데이터가 합산되어 있음. **본사(GEC A동+C동) 데이터만 별도로 분리되어 있는지 확인 필요.**
>
> **재생에너지 확대 현황:** 태국, 헝가리, 멕시코 등 해외 사업장에서도 재생에너지 인증서(REC) 구매를 통해 재생에너지 사용을 확대 중. 국내에서는 녹색프리미엄, REC 구매, 무공해차 전환 등 추진.

### 1.5 2024 보고서 ESG 5대 중요 이슈

| 이슈 | 내용 |
|------|------|
| 저탄소 산업 전환 | E&Able Low (저탄소), E&Able Zero (무탄소), E&Able Circle (환경) |
| 친환경 기술 혁신 | 에너지 전환/친환경 솔루션 (수소, 암모니아, CCS 등) |
| 기후변화 대응 | 넷제로 로드맵, 재생에너지, SEEM-S 관리 시스템 |
| 안전보건 강화 | - |
| 윤리경영 | - |

---

## 2. 삼성물산 지속가능경영보고서

### 2.1 보고서 다운로드 링크

| 연도 | URL |
|------|-----|
| 보고서 목록 | https://www.samsungcnt.com/esg/resource/report/sustainability.do |
| 건설부문 환경에너지경영 | https://www.secc.co.kr/ko/esg/echo-energy/highlight |
| 건설부문 환경에너지방침 | https://www.secc.co.kr/ko/esg/echo-energy/policy |

### 2.2 삼성물산 전사 온실가스 배출량 (2023년)

| 항목 | 수치 | 단위 |
|------|------|------|
| **총 탄소 배출량 (글로벌)** | **약 268,958** | tCO2eq |
| **Scope 1 (직접 배출)** | **약 100,589** | tCO2eq |
| **Scope 2 (간접 배출, Market-based)** | **약 75,854** | tCO2eq |
| **Scope 3 (기타 간접)** | **약 92,515** | tCO2eq |
| **국내 Scope 1+2 합산** | **약 90,709** | tCO2eq |
| - 국내 Scope 1 | **약 19,634** | tCO2eq |
| - 국내 Scope 2 (Market-based) | **약 71,075** | tCO2eq |

> **출처:** Tracenable - Samsung C&T Climate Targets (https://tracenable.com/company/samsung-candt/climate-targets)

### 2.3 삼성물산 기후 목표

| 항목 | 내용 |
|------|------|
| 감축 목표 | 2030년까지 Scope 1+2 배출량 **58% 감축** |
| 기준년도 | 2018년 (231,638 tCO2eq) |
| 탄소중립 목표 | **2050년 탄소중립** |
| CDP 평가 | "명예의 전당(플래티넘 클럽)" 유지 (2022년 기준) |

### 2.4 삼성물산 건설부문 환경/에너지 방침

| 항목 | 내용 |
|------|------|
| 에너지 절감 | 에너지, 수자원, 천연자원 소비 최소화 |
| 온실가스 감축 | 환경자원 보호 및 온실가스 배출량 감축 |
| 폐기물 관리 | 폐기물 발생 최소화, 재활용 활성화를 통한 자원순환 기여 |
| 미세먼지 저감 | 2022년부터 서울시와 '친환경공사장 운영 자발적 협약' |
| 숲 조성 | 트리플래닛과 협약, 2,382그루 국유림 식재 |

### 2.5 건설부문 환경 데이터 (PDF 확인 필요)

삼성물산의 보고서는 **건설, 상사, 패션, 리조트** 4개 부문 합산 데이터로 보고됨. 건설부문 단독 데이터 또는 GEC B동 단독 데이터 분리 여부 확인 필요.

> **B동 에너지 사용 추정 참고:** 연간 임차료 68.57억원 + 관리비(2.50만원/평/월 기준) → B동의 에너지 비용은 관리비에 포함될 것으로 추정.

---

## 3. GEC 건물 에너지 성능 데이터 (기확보)

### 3.1 에너지 효율 인증 데이터

| 항목 | 수치/등급 | 출처 |
|------|----------|------|
| 에너지효율등급 | **1등급** | AURUM 건축상 자료 |
| 1차 에너지 소요량 | **287.4 kWh/m2** (연간) | 에너지효율등급 인증 |
| 에너지 절감율 | 약 **40%** (일반 건물 대비) | HOK 설계 기준 |
| 연면적 (전체) | **186,023 m2** | 건축물대장 |

### 3.2 에너지 사용량 추산

#### 3.2.1 설계 기준 (1차 에너지 소요량)

| 항목 | 산출 | 수치 |
|------|------|------|
| GEC 전체 연간 1차 에너지 | 287.4 kWh/m2 x 186,023 m2 | **약 53,454,610 kWh/년** (**약 53.5 GWh/년**) |
| GEC 전체 연간 1차 에너지 (TJ) | 53,454,610 kWh x 0.0036 MJ/Wh / 1000 | **약 192.4 TJ/년** |

> **주의:** 1차 에너지 소요량은 설계 기준이며, 실제 운영 에너지와 차이가 있음 (아래 3.4절 참조).

#### 3.2.2 실운영 기준 (서울시 에너지다소비건물 실측, 2019)

| 항목 | 산출 | 수치 |
|------|------|------|
| GEC 전체 에너지 소비량 (실측) | 서울시 공개자료 | **6,143 TOE/년** (**≈ 71,443 MWh/년**) |
| GEC 전체 GHG 배출량 (실측) | 서울시 공개자료 | **11,671 tCO2eq/년** |
| GEC 면적당 GHG 배출량 | 서울시 공개자료 | **0.128 tCO2/m²** |
| GEC 실운영 EUI | 71,443 MWh / 186,023 m2 | **약 384 kWh/m²/년** |
| **설계 대비 실운영 차이** | 384 / 287.4 | **+34%** (OA/IT 기기 등 포함) |

#### 3.2.3 B동 면적비례 추정 (실운영 기반)

| 항목 | 산출 | 수치 | 신뢰도 |
|------|------|------|--------|
| B동 면적 비율 | ~60,000 / 186,023 | **32.3%** | estimated |
| B동 연간 에너지 (TOE) | 6,143 x 0.323 | **~1,984 TOE/년** | estimated |
| B동 연간 에너지 (MWh) | 1,984 x 11.63 | **~23.1 GWh/년** | estimated |
| B동 연간 GHG 배출량 | 11,671 x 0.323 | **~3,770 tCO2eq/년** | estimated |
| B동 EUI | GEC 전체 동일 적용 | **384 kWh/m²/년** | estimated |

> **교차검증:** ESG보고서 본사(HQ=GEC) GHG: 2022년 11,123 / 2023년 10,943 / 2024년 12,872 tCO2e → 서울시 실측 11,671 tCO2eq(2019)과 일관된 범위.
> **참고:** B동 면적 비율은 전체 186,023 m2 대비 약 60,000 m2로 추정(약 32.3%). 실제 B동 별도 계량 데이터 확보 시 정밀화 필요.

### 3.4 서울시 에너지다소비건물 공개자료 (Phase 4.1 신규 확보)

> **확보일:** 2026.02.10 (Phase 4.1)
> **출처:** 서울시 에너지다소비건물 온실가스배출량 공개 (2019년 기준, 에너지이용합리화법 시행령)
> **원본:** https://news.seoul.go.kr/env/files/2020/10/5f9a14f06622c0.97019033.pdf (PDF)

#### 데이터 요약

| 항목 | 값 | 비고 |
|------|------|------|
| **사업자명** | 삼성엔지니어링(GEC강동사옥) | 서울시 324개 에너지다소비건물 중 **94위** |
| **연간 에너지 소비량** | **6,143 TOE** | 연료/열/전기 합산 (2019) |
| **연간 온실가스 배출량** | **11,671 tCO2eq** | Scope 1+2 합산 |
| **면적당 온실가스 배출량** | **0.128 tCO2/m²** | GEC 전체 면적(186,023 m²) 기준 |
| **공개 근거** | 에너지이용합리화법 시행령 | 연간 2,000 TOE 이상 건물 공개 의무 |
| **데이터 신뢰도** | **confirmed** | 법정 공개 데이터, 정부 검증 |

#### 의의

1. **최초의 confirmed 건물 에너지 실측 데이터** — 설계 기준이 아닌 실운영 데이터
2. **실운영 EUI 384 kWh/m²/년** — 설계 기준 287.4 대비 +34% (OA/IT 기기 등 반영)
3. **ESG보고서 교차검증 일치** — 본사(HQ) GHG 2022~2024년 데이터와 일관된 범위
4. **B동 추정 정밀화 가능** — GEC 전체 실측 × B동 면적비율(32.3%)로 B동 에너지 추정

### 3.5 삼성E&A 태양광 발전 설비

| 항목 | 수치 | 비고 |
|------|------|------|
| 총 설치 용량 | **1,893 kW** | GEC 포함 전체 사업장 |
| 연간 발전량 추정 | 약 2,459 MWh/년 | (1,893kW x 3.6시간/일 x 365일 x 0.98 효율) |

> **참고:** GEC 건물 옥상에 태양광 패널 설치 여부 및 용량은 별도 확인 필요.
> 삼성E&A 전체 사업장 합산 수치임.

---

## 4. 강동구/서울시 에너지 관련 공개 데이터 소스

### 4.1 에너지 사용량 조회 사이트

| 사이트 | URL | 내용 |
|--------|-----|------|
| 서울특별시 에너지정보 | https://energyinfo.seoul.go.kr/ | 자치구/동별 에너지 사용량 통계 |
| 건물유형별 에너지 사용량 | https://energyinfo.seoul.go.kr/energy/energyUsage?menu-id=Z020200 | 건물유형별 전기/가스/열 |
| 에너지 사용량 통계 | https://energyinfo.seoul.go.kr/energy/energyUsagePattern?menu-id=Z020400 | 월별 에너지 패턴 |
| 온실가스 배출량 통계 | https://energyinfo.seoul.go.kr/energy/custEnergyUsage?menu-id=Z020700 | 자치구별 온실가스 |
| 에너지 사용량 현황 지도 | https://energyinfo.seoul.go.kr/map/energyMap?menu-id=Z040200 | 지역별 에너지 지도 |
| 저탄소건물지원센터 | https://ecobuilding.seoul.go.kr/user/mngEvalSystem/grade.do | 건물 에너지 등급 조회 |

### 4.2 건물 에너지 인증/효율 조회

| 사이트 | URL | 내용 |
|--------|-----|------|
| 건축물 에너지효율등급 인증시스템 | https://beec.energy.or.kr/ | 에너지효율등급 인증 정보 |
| 녹색건축포털 그린투게더 | https://www.greentogether.go.kr/ | 녹색건축 인증 정보 |
| 공공데이터포털 - 건물에너지 | https://www.data.go.kr/data/15054214/fileData.do | 전기에너지 데이터 (필지단위) |
| 건축데이터 민간개방 | https://open.eais.go.kr/ | 건축물대장 등 |

### 4.3 공개데이터 활용 방법

1. **서울시 에너지정보** (energyinfo.seoul.go.kr)
   - 강동구 > 상일동 > 업무용 건물 에너지 사용량 조회
   - 연도별, 에너지원별 (전기/도시가스/지역난방) 조회 가능
   - 엑셀 다운로드 가능

2. **건축물 에너지효율등급 인증시스템** (beec.energy.or.kr)
   - GEC 건물의 에너지효율등급 인증 세부 데이터 조회
   - 1차 에너지 소요량 상세 (냉방/난방/급탕/조명/환기 항목별)

3. **건물에너지 데이터 (공공데이터포털)**
   - 건물별 전기에너지 사용량 (필지 단위)
   - 상일동 500번지 (GEC 주소) 조회

4. **고소비 건물 공개 제도** ✅ **확보 완료 (Phase 4.1)**
   - 연간 연료/열/전기 합산 사용량 2,000 TOE 이상 건물은 에너지 사용량 공개 대상
   - **GEC 확인: 6,143 TOE/년** (324개 대상 건물 중 94위)
   - 출처: 서울시 에너지다소비건물 온실가스배출량 공개 (2019년 기준 PDF)

---

## 5. DART 사업보고서 (삼성엔지니어링, 028050)

### 5.1 조회 방법

| 항목 | 내용 |
|------|------|
| DART 시스템 | https://dart.fss.or.kr/ |
| 종목코드 | **028050** (삼성엔지니어링/삼성E&A) |
| 검색 경로 | 회사명 "삼성엔지니어링" → 사업보고서 → 유형자산 |

### 5.2 확인 필요 항목 (사업보고서 내)

| 항목 | 설명 | Brick Schema 활용 |
|------|------|-------------------|
| 유형자산 - 토지 | GEC 부지 (27,604 m2) 장부가액 | Site 메타데이터 |
| 유형자산 - 건물 | GEC 건물 장부가액, 감가상각 | Building 메타데이터 |
| 유형자산 - 기계장치 | HVAC, 발전설비 등 | Equipment 모델링 참조 |
| 유형자산 - 건설중인 자산 | 설비 교체/증설 내역 | 설비 이력 추적 |
| 시설투자 내역 | HVAC 장비 교체, 에너지 효율 개선 투자 | 설비 업그레이드 이력 |
| 임대차 계약 | B동 삼성물산 임차 조건 (보증금 57.14억, 연임차료 68.57억) | 기확보 |
| 직원 현황 | 국내 근무 인원 수 | 재실 밀도(Occupancy) 계산용 |

### 5.3 유형자산 개요 (2024년 기준)

| 항목 | 금액 |
|------|------|
| 유형자산 합계 | **약 443억원** (재무상태표 기준) |

> **참고:** 세부 항목(토지/건물/기계장치 등) 분류는 사업보고서 본문에서 확인 필요.

---

## 6. Brick Schema Point 모델링을 위한 에너지 데이터 매핑

### 6.1 에너지 모니터링 Point 구조 (확보 데이터 반영)

```turtle
# === 에너지 모니터링 Point ===

# 건물 전체 전력 계측
bldg:GEC_B_Total_Power_Meter a brick:Building_Electric_Meter ;
    brick:hasLocation bldg:GEC_Tower_B ;
    brick:hasUnit unit:kWh ;
    rdfs:comment "B동 전체 전력 사용량 계측" .

# 에너지 효율 기준점
bldg:GEC_B_Primary_Energy_Baseline a brick:Energy_Sensor ;
    brick:hasLocation bldg:GEC_Tower_B ;
    brick:hasUnit unit:kWh_per_m2 ;
    schema:value "287.4" ;
    rdfs:comment "에너지효율등급 1등급 기준, 1차 에너지 소요량 287.4 kWh/m2" .

# 태양광 발전 계측 (GEC 전체, 설치 확인 필요)
bldg:GEC_Solar_PV_Meter a brick:Solar_Generation_Meter ;
    brick:hasLocation bldg:Samsung_GEC ;
    brick:hasUnit unit:kWh ;
    rdfs:comment "태양광 발전량 계측 (삼성E&A 전사 1,893kW 중 GEC 분)" .

# 에너지 비용 모니터링
bldg:GEC_B_Energy_Cost_Sensor a brick:Energy_Cost_Sensor ;
    brick:hasLocation bldg:GEC_Tower_B ;
    rdfs:comment "자동화 디지털 네트워크 시스템에서 시장 에너지 비용 모니터링 확인됨" .
```

### 6.2 GHG/ESG 메타데이터 확장 (Brick + 커스텀)

```turtle
# === GHG 배출 관련 (Brick 표준 외 확장) ===
@prefix bees: <https://example.org/bees#> .

# 삼성E&A 전사 GHG - 2023년 (DitchCarbon 출처 A: 국내 추정)
bees:Samsung_EA_GHG_Scope1_2023_KR a bees:GHG_Scope1_Emission ;
    bees:reportingEntity "삼성E&A" ;
    bees:reportingYear "2023" ;
    bees:value "33042" ;
    bees:unit "tCO2eq" ;
    bees:boundary "국내 사업장 (추정)" ;
    rdfs:comment "DitchCarbon 출처 A 기준. PDF 보고서에서 정확한 범위 확인 필요" .

bees:Samsung_EA_GHG_Scope2_2023_KR a bees:GHG_Scope2_Emission ;
    bees:reportingEntity "삼성E&A" ;
    bees:reportingYear "2023" ;
    bees:value "21412" ;
    bees:unit "tCO2eq" ;
    bees:boundary "국내 사업장 (추정)" ;
    rdfs:comment "DitchCarbon 출처 A 기준. PDF 보고서에서 정확한 범위 확인 필요" .

# 삼성E&A 전사 GHG - 2022년 (DitchCarbon 출처 A: 국내 추정)
bees:Samsung_EA_GHG_Scope1_2022_KR a bees:GHG_Scope1_Emission ;
    bees:reportingEntity "삼성E&A" ;
    bees:reportingYear "2022" ;
    bees:value "34690" ;
    bees:unit "tCO2eq" ;
    bees:boundary "국내 사업장 (추정)" ;
    rdfs:comment "DitchCarbon 출처 A 기준" .

bees:Samsung_EA_GHG_Scope2_2022_KR a bees:GHG_Scope2_Emission ;
    bees:reportingEntity "삼성E&A" ;
    bees:reportingYear "2022" ;
    bees:value "19776" ;
    bees:unit "tCO2eq" ;
    bees:boundary "국내 사업장 (추정)" ;
    rdfs:comment "DitchCarbon 출처 A 기준" .

# 삼성E&A GHG - 2023년 (DitchCarbon 출처 B: 글로벌 추정)
bees:Samsung_EA_GHG_Scope1_2023_Global a bees:GHG_Scope1_Emission ;
    bees:reportingEntity "삼성E&A" ;
    bees:reportingYear "2023" ;
    bees:value "31441" ;
    bees:unit "tCO2eq" ;
    bees:boundary "글로벌 전체 (추정)" ;
    rdfs:comment "DitchCarbon 출처 B 기준. 출처 A와 불일치 - PDF 검증 필요" .

bees:Samsung_EA_GHG_Scope2_2023_Global a bees:GHG_Scope2_Emission ;
    bees:reportingEntity "삼성E&A" ;
    bees:reportingYear "2023" ;
    bees:value "159799" ;
    bees:unit "tCO2eq" ;
    bees:boundary "글로벌 전체 (추정)" ;
    rdfs:comment "DitchCarbon 출처 B 기준. 출처 A와 불일치 - PDF 검증 필요" .

# 삼성물산 전사 GHG (확보됨)
bees:Samsung_CT_GHG_Scope1 a bees:GHG_Scope1_Emission ;
    bees:reportingEntity "삼성물산" ;
    bees:reportingYear "2023" ;
    bees:value "100589" ;
    bees:unit "tCO2eq" ;
    rdfs:comment "삼성물산 전사 Scope 1 (글로벌)" .

bees:Samsung_CT_GHG_Scope2 a bees:GHG_Scope2_Emission ;
    bees:reportingEntity "삼성물산" ;
    bees:reportingYear "2023" ;
    bees:value "75854" ;
    bees:unit "tCO2eq" ;
    bees:method "market-based" ;
    rdfs:comment "삼성물산 전사 Scope 2 (글로벌, market-based)" .

bees:Samsung_CT_Korea_GHG a bees:GHG_Total_Emission ;
    bees:reportingEntity "삼성물산" ;
    bees:reportingYear "2023" ;
    bees:scope "Scope 1+2 (국내)" ;
    bees:value "90709" ;
    bees:unit "tCO2eq" ;
    rdfs:comment "삼성물산 국내 Scope 1+2 합산" .
```

### 6.3 에너지 사용량 (설계 vs 실운영)

#### 설계 기준 (에너지효율등급 인증, 287.4 kWh/m²)

| Point 유형 | GEC 전체 | B동 추정 (32.3%) | 단위 | 근거 |
|-----------|---------|----------------|------|------|
| 연간 1차 에너지 | 53,454,610 | 17,265,839 | kWh/년 | 287.4 kWh/m2 x 면적 |
| 연간 1차 에너지 (TJ) | 192.4 | 62.2 | TJ/년 | 환산 |

#### 실운영 기준 (서울시 에너지다소비건물, 384 kWh/m², 2019 confirmed)

| Point 유형 | GEC 전체 (실측) | B동 추정 (32.3%) | 단위 | 근거 |
|-----------|:-------------:|:---------------:|------|------|
| **연간 에너지 소비** | **6,143** | **~1,984** | TOE/년 | 서울시 공개자료 |
| **연간 에너지 소비** | **71,443,090** | **~23,074,000** | kWh/년 | 6,143 TOE x 11.63 MWh |
| **연간 GHG 배출량** | **11,671** | **~3,770** | tCO2eq/년 | 서울시 공개자료 |
| **EUI (면적당 에너지)** | **384** | **384** | kWh/m²/년 | 실측 역산 |
| 월평균 전력 | 5,953,591 | ~1,922,833 | kWh/월 | 12등분 |
| 일평균 전력 | 195,734 | ~63,217 | kWh/일 | 365등분 |

> **설계 vs 실운영 차이 (+34%):** 설계 기준 EUI 287.4에는 OA기기, IT장비, 조리 등의 내부발열 부하가 미포함됨. 실운영 384 kWh/m²는 이러한 부하 포함. 국내 대형 오피스 벤치마크(300~400 kWh/m²) 범위 내 합리적 수치.
> **온톨로지 반영:** GEC_B_Ontology.ttl v1.6에 `GEC_Energy_Consumption_2019` (confirmed) + `Annual_Energy_Estimate_B` (estimated) 반영 완료.

---

## 7. 추가 확인이 필요한 사항 (Action Items)

### 7.1 최우선 확인 (PDF 직접 열람)

| # | 항목 | 방법 | 기대 데이터 |
|---|------|------|------------|
| 1 | **삼성E&A 2024 지속가능경영보고서** PDF 열람 | 위 링크에서 다운로드 | 에너지 사용량(TJ), GHG Scope1/2(tCO2eq), 용수(톤), 폐기물(톤) |
| 2 | **삼성E&A 2022/2023 보고서** PDF 열람 | samsungena.com/kr/newsroom/publications | 연도별 추이 데이터 |
| 3 | 보고서에서 **"본사"** 또는 **"국내 사업장"** 데이터 분리 여부 확인 | 보고서 부록(Appendix) 확인 | GEC 사옥 단독 에너지 데이터 |
| 4 | **삼성물산 2024 지속가능경영보고서** PDF 열람 | samsungcnt.com ESG 메뉴 | 건설부문 단독 에너지 데이터 |

### 7.2 공개 데이터 조회

| # | 항목 | 방법 | 기대 데이터 |
|---|------|------|------------|
| 5 | **서울시 에너지정보** 강동구 상일동 조회 | energyinfo.seoul.go.kr | 동별 전기/가스/열 사용량 |
| 6 | **건물에너지효율등급 인증시스템** GEC 조회 | beec.energy.or.kr | 냉방/난방/급탕/조명/환기 항목별 1차 에너지 |
| 7 | **녹색건축포털** GEC 녹색건축인증 세부 | greentogether.go.kr | G-SEED 항목별 득점 |
| 8 | ~~**고소비건물 에너지 공개** GEC 해당 여부~~ | ✅ **확보 완료** | **6,143 TOE, 11,671 tCO2eq** (Phase 4.1) |
| 9 | **공공데이터포털** 건물에너지 필지 데이터 | data.go.kr (15054214) | 상일동 500번지 전기에너지 |

### 7.3 DART 사업보고서 확인

| # | 항목 | 방법 | 기대 데이터 |
|---|------|------|------------|
| 10 | **DART** 삼성엔지니어링(028050) 사업보고서 | dart.fss.or.kr | 유형자산 상세 (토지/건물/기계장치) |
| 11 | 시설투자 내역 | 사업보고서 내 투자 관련 항목 | HVAC 교체, 에너지효율 개선 투자 |
| 12 | 직원 현황 (국내) | 사업보고서 | 재실 밀도(Occupancy) 계산 |

### 7.4 온실가스 배출권거래제 데이터

| # | 항목 | 방법 | 기대 데이터 |
|---|------|------|------------|
| 13 | **할당대상업체 현황** 삼성엔지니어링 포함 여부 | data.go.kr (15053949) | 온실가스 배출 할당량 |
| 14 | 배출량 명세서 | 환경부 NGMS 시스템 | 연도별 실배출량 |

---

## 8. 데이터 출처 요약

### 8.1 직접 링크 (보고서 PDF)

- [삼성E&A 2024 지속가능경영보고서 (한국어 PDF)](https://www.samsungena.com/filesview/2024%20SAMSUNG%20E&A%20Sustainability%20Report%20(Kor).pdf?folder=/upload/publishing/&storedfile=098f18f22d5d494594e63d389d5d3285.pdf)
- [삼성E&A 2024 지속가능경영보고서 (영문 PDF)](https://www.samsungena.com/filesview/2024%20SAMSUNG%20E&A%20Sustainability%20Report%20(Eng).pdf?folder=/upload/publishing/&storedfile=2801fc6fe3804df495385e42a2a300cc.pdf)
- [삼성E&A 2022 지속가능경영보고서 (영문 PDF)](https://www.samsungena.com/filesview/Interactive_2022%20Samsung%20Engineering%20Sustainability%20Report%20(Eng)_r.pdf?folder=/upload/publishing/&storedfile=1a7353e9cbca4f46a215932b83c1fc92.pdf)
- [삼성물산 지속가능경영보고서 목록](https://www.samsungcnt.com/esg/resource/report/sustainability.do)

### 8.2 공식 웹사이트

- [삼성E&A 환경경영 페이지](https://www.samsungena.com/kr/sustainability/environmental/environment)
- [삼성E&A 지속가능경영 개요](https://www.samsungena.com/kr/sustainability/overview)
- [삼성E&A 보도자료/발간물](https://www.samsungena.com/kr/newsroom/publications)
- [삼성물산 건설부문 환경에너지경영](https://www.secc.co.kr/ko/esg/echo-energy/highlight)
- [삼성물산 건설부문 환경에너지방침](https://www.secc.co.kr/ko/esg/echo-energy/policy)

### 8.3 공개 데이터 / 정부 시스템

- [서울시 에너지정보](https://energyinfo.seoul.go.kr/)
- [서울시 에너지다소비건물 온실가스배출량 공개 (2019 PDF)](https://news.seoul.go.kr/env/files/2020/10/5f9a14f06622c0.97019033.pdf) ← **GEC 실측 데이터 출처 (Phase 4.1)**
- [건축물 에너지효율등급 인증시스템](https://beec.energy.or.kr/)
- [녹색건축포털 그린투게더](https://www.greentogether.go.kr/)
- [공공데이터포털 - 건물에너지 전기에너지](https://www.data.go.kr/data/15054214/fileData.do)
- [공공데이터포털 - 할당대상업체 현황](https://www.data.go.kr/data/15053949/fileData.do)
- [DART 전자공시시스템](https://dart.fss.or.kr/)
- [저탄소건물지원센터](https://ecobuilding.seoul.go.kr/)

### 8.4 뉴스 기사

- [삼성E&A 2024 지속가능경영보고서 발간 - 스마트투데이](https://www.smarttoday.co.kr/news/articleView.html?idxno=86899)
- [삼성E&A 지속가능경영보고서 발간 - 이투데이](https://www.etoday.co.kr/news/view/2491710)
- [삼성E&A 지속가능경영보고서 - 스마트에프엔](https://www.smartfn.co.kr/news/articleView.html?idxno=115716)
- [삼성E&A ESG 5대 성과 - 굿모닝경제](https://www.goodkyung.com/news/articleView.html?idxno=268580)
- [삼성E&A 탄소중립 에너지전환 - 아주경제](https://www.ajunews.com/view/20250728084143858)

### 8.5 ESG 평가/데이터 사이트

- [DitchCarbon - Samsung Engineering (출처 A)](https://ditchcarbon.com/organizations/samsung-engineering)
- [DitchCarbon - Samsung Engineering Company Limited (출처 B)](https://ditchcarbon.com/organizations/samsung-engineering-company-limited-146f8002-b428-44aa-a8df-18c337370f8f)
- [Tracenable - Samsung C&T Climate Targets](https://tracenable.com/company/samsung-candt/climate-targets)
- [DitchCarbon - Samsung C&T](https://ditchcarbon.com/organizations/samsung-c-t-corporation)
- [CDP - Samsung Engineering Response](https://www.cdp.net/en/responses/16191)
- [KRX ESG Portal](https://esg.krx.co.kr/contents/02/02030000/ESG02030000.jsp)
- [KCGS ESG 등급 조회](https://www.cgs.or.kr/business/esg_tab04.jsp)
- [환경정보공개시스템](https://www.env-info.kr/)

### 8.6 추가 뉴스 기사

- [삼성E&A 2024 지속가능경영보고서 발간 - 뉴스1](https://www.news1.kr/realestate/general/5860410)
- [삼성E&A ESG 전략체계 기반 5대 이슈별 성과 - 뉴스포스트](https://www.newspost.kr/news/articleView.html?idxno=216250)
- [삼성E&A 탄소중립 에너지전환 기술혁신 - FETV](https://www.fetv.co.kr/news/article.html?no=197688)
- [삼성E&A 2024 지속가능경영보고서 - 이코노미톡](http://www.economytalk.kr/news/articleView.html?idxno=410192)
- [삼성E&A 2050 넷제로 - 브릿지경제](https://www.viva100.com/article/20250728500216)
- [삼성E&A 14번째 지속가능경영보고서 - 뉴데일리](https://biz.newdaily.co.kr/site/data/html/2025/07/28/2025072800303.html)
- [남궁 홍 삼성E&A 사장 지속가능전략 - 헤럴드경제](https://biz.heraldcorp.com/article/10541150)

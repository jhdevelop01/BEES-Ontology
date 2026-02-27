# 작업 R-3: 온톨로지 변경 전체 플랫폼 적용 검증 + 수정

> **작성일**: 2026-02-24
> **완료일**: 2026-02-24
> **상태**: ✅ 완료

---

## 영향 분석 결과 (20개 페이지 + 4개 서버)

| 영역 | 판정 | 조치 |
|------|:----:|------|
| Dashboard, Monitoring, Alarms, Energy 등 16개 페이지 | 영향 없음 | — |
| Ontology Graph, Equipment Detail | 이미 OK | 모든 관계 타입 지원 |
| Server B/C/D | 영향 없음 | feeds 미사용 |
| **AI Chat SYSTEM_PROMPT** | **수정 완료** | 에너지 흐름 5개 루프 설명 업데이트 |
| **Topology Cross Section** | **검증 통과** | PumpGroup B_B1F 배치, feeds 엣지 정상 |
| **Fault Impact API** | **검증 통과** | Chiller_1: 182건, Boiler_1: 36건, AHU_UFAD_1: 9건 |
| **Neo4j 캐시** | **초기화 완료** | Server A 재시작 |

---

## 체크리스트

### Phase 1: AI Chat SYSTEM_PROMPT 업데이트
- [x] **1.1** openai_service.py 에너지 흐름 설명 5개 루프별 업데이트 (CHW/HW/CW/AIR/배기)
- [x] **1.2** Server A Backend 재시작 (캐시 초기화)

### Phase 2: Cross Section + Fault Impact + 서버 검증
- [x] **2.1** Cross Section: PumpGroup hasLocation B_B1F 확인, cs-edges/cs-layout 정상
- [x] **2.2** Fault Impact: 3개 장비 테스트 통과 (Chiller_1/Boiler_1/AHU_UFAD_1)
- [x] **2.3** 전체 서버 200 OK: Backend, Frontend, Server B/C/D, Neo4j

### Phase 3: 통합 검증
- [x] **3.1** DAG: Primary 92, Connected 92, L999 isolated: 0
- [x] **3.2** 전체 6개 서버 Health Check: All 200 OK
- [x] **3.3** todo.md 완료 표시

# BEES Ontology — 삼성물산 GEC B동 Brick Schema 온톨로지

## 프로젝트 개요
삼성물산 GEC(Green Energy Center) **B동(Tower B)**에 대한 **Brick Schema 기반 건물 온톨로지** 구축 프로젝트.
스마트빌딩 데이터 통합 플랫폼 "BEES"를 위한 시맨틱 모델링.

## 범위 (필수 준수)
- **삼성물산 GEC B동에만 한정** — Tower A, Tower C, Podium, 전사 ESG 데이터는 범위 밖
- `bldg:Samsung_GEC` (Site)는 최소 컨텍스트(상위 노드)로만 유지
- 새 인스턴스는 반드시 `bldg:GEC_Tower_B` 또는 그 하위에 연결

## 핵심 파일
| 파일 | 위치 | 설명 |
|------|------|------|
| GEC_B_Ontology.ttl | `05_온톨로지/` | 메인 온톨로지 (v1.7, 2,938줄, 2,024 트리플) |
| GEC_B_SHACL.ttl | `05_온톨로지/` | SHACL 검증 Shape (11개) |
| history.md | `06_프로젝트관리/` | 전체 프로젝트 히스토리 (Phase 1~5 상세) |
| 14_온톨로지_완성_현황.md | `06_프로젝트관리/` | 온톨로지 완성도 종합 (100%, 134건) |
| 11_데이터_확보_현황.md | `06_프로젝트관리/` | 7개 영역 134건 확보 현황 |
| 07_미확보_정보_목록.md | `06_프로젝트관리/` | 미확보 0건 (Phase 5에서 전수 추정 완료) |
| 15_온톨로지_구축_방법론.md | `06_프로젝트관리/` | 구축 프로세스 재현 가이드 (9단계, 계산식, 체크리스트) |
| 16_데이터_출처_및_생성과정_추적표.md | `06_프로젝트관리/` | 134건 항목별 데이터 출처 및 수집/생성 과정 추적 |
| 09_에너지_ESG_데이터.md | `03_에너지_ESG/` | 에너지/ESG 데이터 종합 (서울시 실측 포함) |

## 온톨로지 규칙
- **Brick Schema 1.3+** 준수: Location → System → Equipment → Point 위계
- **네임스페이스**: `brick:` (스키마), `bldg:` (인스턴스), `bees:` (커스텀 28클래스+45속성)
- **신뢰도 태깅 필수**: `bees:hasConfidence` — "confirmed" / "estimated" / "inferred"
- **추정 범위**: `bees:estimatedRange` — 정밀 수량 미확정 시 사용
- **TTL 수정 후 반드시 rdflib 파싱 검증** (구문 오류 방지)
- **SHACL Shape 동기화**: 새 클래스 추가 시 해당 Shape도 검토

## 검증 명령
```bash
# TTL 구문 검증
python3 -c "from rdflib import Graph; g=Graph(); g.parse('05_온톨로지/GEC_B_Ontology.ttl', format='turtle'); print(f'트리플: {len(g)}')"

# SHACL 유효성 검증
pyshacl -s 05_온톨로지/GEC_B_SHACL.ttl -d 05_온톨로지/GEC_B_Ontology.ttl

# 범위 검증 (Site 참조 ~12개 허용 - 최소 컨텍스트 + 에너지 실측)
grep -c "Samsung_GEC" 05_온톨로지/GEC_B_Ontology.ttl
# v1.7: 2,938줄, 2,024 트리플, 미확보 0건 (100% 모델링 완료)
```

## 작업 시작 전
새 세션에서 프로젝트 맥락이 필요하면 `06_프로젝트관리/history.md`를 먼저 읽을 것.

## 언어
사용자와의 대화 및 문서 작성은 **한국어**. 온톨로지(TTL) 내 식별자와 기술 용어는 영어.

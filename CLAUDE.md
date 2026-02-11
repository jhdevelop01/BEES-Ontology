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
| GEC_B_Ontology.ttl | `ontology/` | 메인 온톨로지 (v2.0.1, ~6,830줄, 5,756 트리플, 845 인스턴스) |
| GEC_B_SHACL.ttl | `ontology/` | SHACL 검증 Shape (v2.0, 19개) |
| history.md | `_docs/` | 전체 프로젝트 히스토리 (Phase 1~8 상세) |
| 01_건물_설비_정보.md | `_docs/` | 건물 기본정보, 인증, 입주현황, HVAC, 설비, 스마트빌딩 통합 |
| 02_에너지_ESG_데이터.md | `_docs/` | 에너지/ESG 데이터 종합 (서울시 실측 포함) |
| 03_참고자료.md | `_docs/` | Brick Schema 참고정보 + 학술논문/기술참고 |
| 04_인증_벤치마킹_설비추론.md | `_docs/` | 인증 역분석, 벤치마킹, 설비 추론 |
| 05_데이터_확보_및_출처추적.md | `_docs/` | 7개 영역 134건 확보 현황 + 데이터 출처/생성과정 추적표 |
| 06_온톨로지_구축_방법론.md | `_docs/` | 구축 프로세스 재현 가이드 (9단계, 계산식, 체크리스트) |
| 07_온톨로지_통계_요약.md | `_docs/` | 온톨로지 인스턴스 통계 (rdflib 추출, 845개, 전층 모델) |
| 08_개발_원칙.md | `_docs/` | **TTL-First 원칙, 변경 워크플로우, Neo4j 동기화 규칙** (모든 세션 필수 참조) |
| GEC_B동_온톨로지_통계.xlsx | `_docs/` | 층별 중심 통계 엑셀 |
| GEC_B동_데이터_요청서.pdf | `_docs/` | Phase 2 내부 데이터 요청서 |

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
python3 -c "from rdflib import Graph; g=Graph(); g.parse('ontology/GEC_B_Ontology.ttl', format='turtle'); print(f'트리플: {len(g)}')"

# SHACL 유효성 검증
pyshacl -s ontology/GEC_B_SHACL.ttl -d ontology/GEC_B_Ontology.ttl

# 범위 검증 (Site 참조 ~12개 허용 - 최소 컨텍스트 + 에너지 실측)
grep -c "Samsung_GEC" ontology/GEC_B_Ontology.ttl
# v2.0.1: ~6,830줄, 5,756 트리플, 845 인스턴스, 전층 모델 (지하~옥상)
```

## 작업 시작 전
1. **`_docs/08_개발_원칙.md`를 반드시 읽을 것** — TTL-First 원칙, 변경 워크플로우, Neo4j 동기화 규칙
2. 프로젝트 맥락이 필요하면 `_docs/history.md`를 읽을 것

## 언어
사용자와의 대화 및 문서 작성은 **한국어**. 온톨로지(TTL) 내 식별자와 기술 용어는 영어.

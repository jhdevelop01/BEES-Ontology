# 시스템 아키텍처 다이어그램 — 3D 디지털 트윈 시각 효과 강화

> **작성일**: 2026.02.24
> **이전 작업**: 좌→우 데이터 흐름 레이아웃 + 서버 이름 i18n 완료
> **플랜**: `.claude/plans/snoopy-dreaming-cosmos.md`

---

## 작업 J: 아이콘 구체 입체화 + 노드 카드 강화 (node-vfx)

### 배경
아이콘을 다층 그라디언트 + specular highlight + 부유 애니메이션으로 3D 구체처럼 개선.
카드에 그라디언트 보더 + 다층 깊이 그림자 + 호버 3D 틸트 추가.

### 체크리스트
- [x] J-1. `architecture-server-node.tsx` — specular highlight 레이어 추가 (흰색 빛점)
- [x] J-2. `architecture-server-node.tsx` — 아이콘 구체 다층 그림자 (부유감)
- [x] J-3. `architecture-server-node.tsx` — 부유 애니메이션 클래스 적용 (online 노드만)
- [x] J-4. `architecture-server-node.tsx` — 내부 원 그라디언트 강화 + 하단 반사광
- [x] J-5. `architecture-server-node.tsx` — 카드 그라디언트 보더 (노드 컬러)
- [x] J-6. `architecture-server-node.tsx` — 카드 다층 box-shadow (3층: 근/중/원)
- [x] J-7. `architecture-server-node.tsx` — 호버 3D 틸트 (perspective + rotateY)
- [x] J-8. `architecture-server-node.tsx` — 텍스트 글로우 text-shadow (online 시)

---

## 작업 K: 플로우 라인 파티클 + 글로우 강화 (flow-vfx)

### 배경
단순 dash 애니메이션을 파티클 트레일 + 강화 글로우 + 연결점 펄스로 역동적 데이터 흐름 표현.

### 체크리스트
- [x] K-1. `architecture-flow-line.tsx` — SVG 파티클 트레일 (`<circle>` + `<animateMotion>`, 연결당 3개)
- [x] K-2. `architecture-flow-line.tsx` — 파티클 글로우 필터 (개별 feGaussianBlur)
- [x] K-3. `architecture-flow-line.tsx` — 글로우 강화 (stdDeviation 2→3, strokeWidth 3→5)
- [x] K-4. `architecture-flow-line.tsx` — 연결점 펄스 (출발점 원형 펄스 애니메이션)

---

## 작업 L: 배경 + 앰비언트 효과 (ambient-vfx)

### 배경
평면 그리드를 원근 투시로 변환하고, 스캔라인/파티클/비네트로 디지털 트윈 분위기 극대화.

### 체크리스트
- [x] L-1. `system-architecture-diagram.tsx` — 그리드 배경 원근 투시 (perspective + rotateX 15deg)
- [x] L-2. `system-architecture-diagram.tsx` — 비네트 오버레이 (radial-gradient)
- [x] L-3. `system-architecture-diagram.tsx` — 플로팅 파티클 SVG (8개)
- [x] L-4. `system-architecture-diagram.tsx` — 스캔라인 스위프 div
- [x] L-5. `globals.css` — @keyframes arch-float (부유 3초)
- [x] L-6. `globals.css` — @keyframes arch-scanline (좌→우 8초)
- [x] L-7. `globals.css` — Dead Code `.arch-perspective-grid` 제거/교체
- [x] L-8. `globals.css` — @media prefers-reduced-motion 대응

---

## 작업 M: 통합 + 빌드 + 검증

- [x] M-1. 3명 작업물 통합 확인 (충돌 없음)
- [x] M-2. Frontend 재빌드 (`docker compose up -d --build server-a-frontend`) — 성공
- [x] M-3. `http://localhost:3000/monitoring` — HTTP 200 확인
- [x] M-4. `/api/platform/health` — 4/4 서버 online 확인
- [ ] M-5. 시각 검증: 아이콘 구체 하이라이트 + 부유감 — 브라우저 수동 확인 필요
- [ ] M-6. 시각 검증: 플로우 파티클 이동 + 글로우 — 브라우저 수동 확인 필요
- [ ] M-7. 시각 검증: 원근 그리드 + 스캔라인 + 파티클 — 브라우저 수동 확인 필요

---

## 작업 N: 문서 업데이트

- [x] N-1. history.md 섹션 추가 (3D 시각 강화 작업 내역)
- [x] N-2. doto.md 체크리스트 최종 갱신

---

## 작업 O: 토폴로지 페이지 — 탭 분리 + 장비 네트워크 토폴로지 (equip-topology)

> **작성일**: 2026.02.24
> **플랜**: `.claude/plans/snoopy-dreaming-cosmos.md`

### 배경
기존 `/topology` 페이지는 건물 단면도(Cross-Section)만 표시.
탭 2개로 분리하여 "설비 계층도"(기존) + "토폴로지"(신규 Cytoscape.js 장비 네트워크) 구현.

### O-1. 탭 UI + 페이지 구조 (tab-ui)
- [x] O-1-1. `app/topology/page.tsx` — 탭 네비게이션 UI (토폴로지 | 설비 계층도)
- [x] O-1-2. `app/topology/page.tsx` — 조건부 렌더링 (EquipTopologyCanvas / CsCanvas)
- [x] O-1-3. `app/topology/page.tsx` — 토폴로지 탭 기본 선택 (`useState("topology")`)
- [x] O-1-4. `messages/ko.json` — topology 섹션 i18n 키 추가 (탭 라벨, 토폴로지 뷰) — 18키
- [x] O-1-5. `messages/en.json` — 영문 키 추가 — 18키

### O-2. Cytoscape.js 장비 토폴로지 코어 (equip-graph)
- [x] O-2-1. `equip-topology-data.ts` — API 데이터 변환 (장비→노드, feeds→엣지, 시스템 감지)
- [x] O-2-2. `equip-topology-styles.ts` — Cytoscape 노드/엣지 스타일 정의 (시스템별 컬러)
- [x] O-2-3. `equip-topology-canvas.tsx` — Cytoscape 캔버스 (dynamic import, SSR 회피)
- [x] O-2-4. `equip-topology-canvas.tsx` — SSE 실시간 상태 반영 (ON/OFF 글로우)
- [x] O-2-5. `equip-topology-canvas.tsx` — cose-bilkent 레이아웃 + 적응형 파라미터

### O-3. 컨트롤 패널 + 인터랙션 (equip-controls)
- [x] O-3-1. `equip-topology-controls.tsx` — 시스템 필터 토글 (CHW/HW/CW/ELEC/AIR)
- [x] O-3-2. `equip-topology-controls.tsx` — 레이아웃 선택 버튼 그룹 (force/hierarchical/circle)
- [x] O-3-3. `equip-topology-controls.tsx` — 장비 검색 + 포커스/줌 (300ms debounce)
- [x] O-3-4. `equip-topology-canvas.tsx` — 클릭 하이라이트 (연결 장비만 밝게)
- [x] O-3-5. `equip-topology-canvas.tsx` — 더블클릭 → 장비 상세 페이지 이동

### O-4. 통합 + 빌드 + 검증
- [x] O-4-1. 3명 작업물 통합 + 인터페이스 불일치 수정 (onSearch→onSearchChange, z-index)
- [x] O-4-2. Frontend 재빌드 — 21페이지 빌드 성공
- [x] O-4-3. `http://localhost:3000/topology` — HTTP 200 확인
- [ ] O-4-4. "토폴로지" 탭 — Cytoscape 캔버스 + 장비 노드 표시 — 브라우저 수동 확인 필요
- [ ] O-4-5. "설비 계층도" 탭 — 기존 단면도 정상 동작 — 브라우저 수동 확인 필요
- [ ] O-4-6. 시스템 필터 + 레이아웃 전환 동작 — 브라우저 수동 확인 필요
- [ ] O-4-7. 장비 클릭 하이라이트 + 더블클릭 이동 — 브라우저 수동 확인 필요

### O-5. 문서 업데이트
- [x] O-5-1. history.md 섹션 44 추가
- [x] O-5-2. doto.md 체크리스트 최종 갱신

---

## 작업 P: 토폴로지 공정흐름도(P&ID) 스타일 리디자인 (flow-pid)

> **작성일**: 2026.02.24
> **플랜**: `.claude/plans/snoopy-dreaming-cosmos.md`

### 배경
Cytoscape.js 원형 노드 → ReactFlow 기반 공정흐름도로 전환.
시스템별 그룹 컨테이너 + 장비 카드 + 애니메이션 플로우 라인 + 3D 글래스모피즘.

### P-1. 커스텀 ReactFlow 노드 (flow-nodes)
- [x] P-1-1. `equip-topology-nodes.tsx` — SystemGroupNode (시스템 그룹 컨테이너)
- [x] P-1-2. `equip-topology-nodes.tsx` — FlowEquipCard (장비 카드 260×90px)
- [x] P-1-3. `equip-topology-nodes.tsx` — 3D 글래스모피즘 스타일 + 상태 배지 + 운전률 바

### P-2. 데이터 + 레이아웃 엔진 (flow-data)
- [x] P-2-1. `equip-topology-data.ts` — ReactFlow 노드/엣지 빌더 리라이트
- [x] P-2-2. `equip-topology-layout.ts` — 시스템 그룹 L→R 배치 + 그리드 레이아웃
- [x] P-2-3. `equip-topology-layout.ts` — AIR 시스템 서브그루핑 (AHU/FCU/VAV/DOAS)
- [x] P-2-4. `equip-topology-data.ts` — 인터시스템/인트라시스템 엣지 빌더

### P-3. 캔버스 + 컨트롤 + CSS (flow-canvas)
- [x] P-3-1. `equip-topology-canvas.tsx` — ReactFlow 캔버스 리라이트 (Cytoscape 교체)
- [x] P-3-2. `equip-topology-canvas.tsx` — SSE 실시간 상태 업데이트
- [x] P-3-3. `equip-topology-canvas.tsx` — 시스템 필터 + 검색 + 카드 클릭 이동
- [x] P-3-4. `equip-topology-controls.tsx` — 레이아웃 선택기 제거 + 흐름 방향 표시
- [x] P-3-5. `globals.css` — `.equip-flow-canvas` 엣지 애니메이션 + 글로우
- [x] P-3-6. `ko.json` / `en.json` — 시스템명/상태 i18n 키 추가
- [x] P-3-7. `equip-topology-styles.ts` — 삭제 (Cytoscape 전용)

### P-4. 통합 + 빌드 + 검증
- [x] P-4-1. 3명 작업물 통합 확인 — 미사용 import 수정 (CATEGORY_INFO)
- [x] P-4-2. Frontend 재빌드 — 21페이지 빌드 성공
- [x] P-4-3. `http://localhost:3000/topology` — HTTP 200 확인
- [ ] P-4-4. 시스템 그룹 5개 좌→우 배치 확인 — 브라우저 수동 확인 필요
- [ ] P-4-5. 장비 카드 ~120개 그룹 내부 표시 — 브라우저 수동 확인 필요
- [ ] P-4-6. 인터시스템 애니메이션 엣지 확인 — 브라우저 수동 확인 필요
- [ ] P-4-7. 시스템 필터 + 검색 + 카드 클릭 동작 — 브라우저 수동 확인 필요
- [ ] P-4-8. "설비 계층도" 탭 — 기존 단면도 정상 — 브라우저 수동 확인 필요

### P-5. 문서 업데이트
- [x] P-5-1. history.md 섹션 45 추가
- [x] P-5-2. doto.md 체크리스트 최종 갱신

---

## 작업 Q: 토폴로지 P&ID 7가지 개선 (topo-improve)

> **작성일**: 2026.02.24
> **플랜**: `.claude/plans/snoopy-dreaming-cosmos.md`

### 배경
작업 P의 P&ID 토폴로지가 "장비를 모아놓은 느낌". feeds 77.7% 손실, 장비 50% 고립, 순서 무의미.
7가지 개선: Distribution_Header 추가, 고립 구분, topological sort, 비-HVAC 제외, Zone 표시, 시스템 분류 정비.

### Q-1. Backend API 수정 (topo-backend) ✅
- [x] Q-1-1. `neo4j_service.py` — `get_equipment_list()` Cypher 라벨에 `Distribution_Header` 추가
- [x] Q-1-2. `neo4j_service.py` — `get_zone_feeds()` 신규 함수 (Zone+Equipment feeds)
- [x] Q-1-3. `ontology.py` — `GET /api/topology/zone-connections` 엔드포인트 등록
- [x] Q-1-4. curl 테스트 — Distribution_Header 20개 API 노출 확인
- [x] Q-1-5. curl 테스트 — zone-connections API: 61개 연결, 56개 Zone

### Q-2. 데이터 + 레이아웃 엔진 (topo-layout) ✅
- [x] Q-2-1. `cs-utils.ts` — `detectSystemFromEquip()` 수정 (Distribution_Header + distribution_panel)
- [x] Q-2-2. `equip-topology-data.ts` — PRIMARY_EQUIP_RE 확장 + EXCLUDE_RE (24개 제외)
- [x] Q-2-3. `equip-topology-data.ts` — Zone fetch 통합 (`getZoneConnections()` 병렬 호출)
- [x] Q-2-4. `lib/api.ts` — ZoneInfo + ZoneConnectionsResponse + getZoneConnections (graceful degradation)
- [x] Q-2-5. `equip-topology-layout.ts` — DAG 빌드 (buildSystemDAG, intra-system edges only)
- [x] Q-2-6. `equip-topology-layout.ts` — BFS 레벨 할당 (assignLevels, cycle-safe)
- [x] Q-2-7. `equip-topology-layout.ts` — 레벨 기반 열 배치 (source→sink 좌→우)
- [x] Q-2-8. `equip-topology-layout.ts` — connectedNames 전역 계산 + isIsolated 전달
- [x] Q-2-9. `equip-topology-layout.ts` — Zone 노드 시스템별 그룹 오른쪽 독립 배치 (default hidden)
- [x] Q-2-10. `equip-topology-layout.ts` — AIR 서브그루핑 유지 + isIsolated 통합

### Q-3. UI 컴포넌트 + 스타일 (topo-ui) ✅
- [x] Q-3-1. `equip-topology-nodes.tsx` — FlowEquipData.isIsolated + 고립 스타일 (점선, opacity 0.5)
- [x] Q-3-2. `equip-topology-nodes.tsx` — ZoneNode 커스텀 노드 (180×50px, target Handle only)
- [x] Q-3-3. `equip-topology-nodes.tsx` — equipFlowNodeTypes에 zoneNode 등록
- [x] Q-3-4. `equip-topology-controls.tsx` — Zone 토글 버튼 (보라색) + 존 수 통계
- [x] Q-3-5. `equip-topology-canvas.tsx` — showZones/zoneCount state + Zone 토글 핸들러
- [x] Q-3-6. `equip-topology-canvas.tsx` — SSE에 zoneNode 처리 (zone hidden 토글)
- [x] Q-3-7. `globals.css` — .equip-card-isolated hover + .zone-node + .zone-edge 스타일
- [x] Q-3-8. `ko.json` / `en.json` — 4개 i18n 키 추가 (topoShowZones 등)

### Q-4. 통합 + 빌드 + 검증 ✅
- [x] Q-4-1. 3명 작업물 인터페이스 호환 확인 (불일치 없음)
- [x] Q-4-2. Backend 재빌드 성공 (Distribution_Header 20개, Zone API 61개)
- [x] Q-4-3. Frontend 재빌드 성공 (Next.js 빌드 완료)
- [x] Q-4-4. `/topology` HTTP 200 확인
- [x] Q-4-5. 엣지 수: 108개 (기존 58 → +86%) + Zone 61개 = 총 169개 가용
- [x] Q-4-6. 고립 장비: 28/97 (28.9%) — 목표 20%보다 약간 높으나 대폭 개선 (기존 50%)
- [ ] Q-4-7. 검증: 시스템 그룹 내 좌→우 흐름 — 브라우저 수동 확인 필요
- [ ] Q-4-8. 검증: Zone 토글 동작 — 브라우저 수동 확인 필요
- [ ] Q-4-9. 검증: "설비 계층도" 탭 정상 — 브라우저 수동 확인 필요

### Q-5. 문서 업데이트
- [x] Q-5-1. history.md 섹션 추가
- [x] Q-5-2. doto.md 체크리스트 최종 갱신

### 결과 요약
| 지표 | 이전 (작업 P) | 이후 (작업 Q) | 변화 |
|------|:---:|:---:|:---:|
| 렌더링 엣지 | 58 (22%) | 108 (41.5%) | **+86%** |
| Zone 포함 가용 엣지 | — | 169 (65%) | **신규** |
| 고립 장비 | 48/96 (50%) | 28/97 (28.9%) | **-42%** |
| Primary 장비 수 | 96 | 97 | +1 (DH 추가, 비-HVAC 24개 제외) |
| Zone 노드 | 0 | 56 | **신규** |
| 레이아웃 | 그리드 (i%cols) | DAG topological sort | **신규** |
| 비-HVAC 제외 | 미적용 | 24개 제외 | **신규** |

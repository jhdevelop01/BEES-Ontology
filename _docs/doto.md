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

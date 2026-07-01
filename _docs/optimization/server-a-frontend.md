# Server A Frontend 최적화 분석

> 대상: `platform/server-a/frontend` (Next.js 14 App Router, React 18, Tailwind, shadcn/ui, ReactFlow, Cytoscape.js, recharts, next-intl)
> 방식: 소스 직접 정독(추측 배제), 모든 항목 `파일:라인` 근거 명시. 읽기 분석 전용.

---

## 1. 현행 구조 요약

- **App Router 19개 페이지**(`app/*/page.tsx`). 전부 `"use client"` 클라이언트 컴포넌트. 서버 컴포넌트/RSC 데이터 페칭은 미사용(루트 `app/layout.tsx`만 서버에서 locale/messages 로드).
- **레이아웃**: `app/layout.tsx` → `NextIntlClientProvider` → `ToastProvider` → `ClientLayout`(`components/client-layout.tsx`). `ClientLayout`이 **전 페이지 공통**으로 `<AlarmBanner/>` + `<Sidebar/>`를 렌더.
- **실시간 데이터**: `lib/sse.ts`의 `useSSE()` 훅이 `EventSource(/api/stream/points)` 연결 → `batch` 이벤트(0.5초 배치, 670포인트+284장비)를 받아 `points`/`pointHistory`/`devices`/`alarms` 4개 상태로 관리. `lib/ws.ts`는 동일 인터페이스 WebSocket 버전, `useRealtimeData()`(`sse.ts:198`)가 WS 우선·SSE 폴백을 의도.
- **API 계층**: `lib/api.ts`(1478행) — 단일 `fetchJSON` 래퍼 + 도메인별 함수 80여 개. JWT는 `localStorage`, 45초 타임아웃(AbortController). Server C(emulator)/Server D(historian)는 별도 `fetchEmulator`/`fetchHistorian`로 직접 호출. **클라이언트 캐시 계층 없음**(SWR/React Query 미사용) — 페이지마다 `useEffect`+`setInterval` 수동 폴링.
- **그래프 렌더**:
  - `app/ontology/page.tsx`(1358행) — Cytoscape.js. `import("cytoscape")`를 effect 내부에서 **동적 로드**(코드 스플리팅 양호).
  - `app/topology/page.tsx` → `EquipTopologyCanvas`/`CsCanvas`(ReactFlow). ReactFlow는 **정적 import**.
- **차트**: recharts(`components/charts/live-chart.tsx`) — `isAnimationActive={false}`로 적용(양호). energy/history/dashboard 위젯에서 정적 import.
- **코드 스플리팅**: `next/dynamic`는 **단 1곳**(`app/page.tsx:23` DashboardGrid)만 사용.
- **i18n**: `messages/ko.json`(32KB)+`en.json`(31KB) 전량을 `NextIntlClientProvider`로 클라이언트 전달. `middleware.ts`는 `NEXT_LOCALE` 쿠키만 세팅.

---

## 2. 발견된 병목/이슈

### [P0-1] `useSSE` 다중 인스턴스 → EventSource 중복 연결 + 중복 상태 메모리
- **근거**: `useSSE()`는 호출될 때마다 **독립적인** `new EventSource(...)`를 연다(`lib/sse.ts:63`). 공유 컨텍스트/싱글톤 없음.
  - `AlarmBanner`가 `ClientLayout`을 통해 **모든 페이지에 상주**하며 `useSSE()` 호출(`components/alarm-banner.tsx:22`, `components/client-layout.tsx:10`).
  - 동시에 각 페이지도 `useSSE()`를 또 호출: `app/topology/page.tsx:16`, `app/monitoring/page.tsx:221`, `app/page.tsx:30`, `app/control/page.tsx:246`, `app/alarms/page.tsx:234`, `app/monitoring/[equipmentId]/page.tsx:98`.
- **영향**: 실시간 페이지당 **최소 2개**의 SSE 연결이 동시에 670포인트×0.5초 배치를 각각 수신·파싱·setState. 각 인스턴스가 `points`/`pointHistory`(670포인트 × 최대 60이력)를 **중복 보관** → 메모리·GC 압박 2배, 0.5초마다 2배 리렌더. 서버측 SSE 동시 연결 수도 사용자당 2배로 증가.

### [P0-2] `AlarmBanner`가 `alarms`만 쓰면서 전체 포인트 파이프라인을 구동
- **근거**: `AlarmBanner`는 `const { alarms } = useSSE()`만 구조분해(`alarm-banner.tsx:22`)하지만, `useSSE` 내부는 `alarms`와 무관하게 670포인트 `batch`마다 `setPoints`/`setPointHistory`/`setDevices`를 모두 실행(`sse.ts:92-115`).
- **영향**: 전 페이지 상주 컴포넌트가 0.5초마다 사용하지도 않는 670포인트 이력 맵을 구축·리렌더. `AlarmBanner`는 `alarms.length` 변경에만 반응하면 충분(`alarm-banner.tsx:58`)하나 실제로는 매 배치 리렌더된다.

### [P0-3] `useSSE`가 차트용 `pointHistory`를 무조건 구축 (대부분 페이지 미사용)
- **근거**: `setPointHistory`는 670포인트 전부에 대해 매 배치 `[...arr, p].slice(-maxHistory)` 신규 배열 생성(`sse.ts:98-105`). 그러나 `pointHistory`를 실제 사용하는 곳은 `app/monitoring/[equipmentId]/page.tsx:98` 한 곳뿐. topology/monitoring/control/dashboard/alarms는 `points`·`devices`·`alarms`만 사용.
- **영향**: 0.5초마다 670개 배열 복사(670×최대60 요소) — 불필요한 CPU/GC. 단일 장비 상세 외에는 전부 낭비.

### [P1-1] 모니터링 카드 그리드: SSE 배치마다 ~284장 카드 전체 리렌더
- **근거**: `app/monitoring/page.tsx`는 `useSSE(60)`로 `devices`를 받고(`:221`), `filteredEquipment.map(...)`로 카드를 인라인 렌더(`:524`). 카드는 `memo` 미적용 + 카드 1장당 수십 개 인라인 스타일/`conic-gradient`/중첩 `div`(`:543-669`). `devices`는 매 배치 새 객체 참조 → 그리드 전체가 0.5초마다 재조정.
- **영향**: 284개 무거운 카드가 0.5초 주기로 리렌더. 실제로 변하는 장비는 극소수인데 전수 갱신. 저사양/모바일에서 프레임 드랍.

### [P1-2] `topology/page.tsx`: `deviceStatusMap`/`tabs` 매 렌더 재생성
- **근거**: `deviceStatusMap`을 `useMemo` 없이 매 렌더 `for` 루프로 재구축(`app/topology/page.tsx:19-23`), `tabs` 배열도 매 렌더 재생성(`:25-28`). 이 객체가 `EquipTopologyCanvas`/`CsCanvas`에 props로 전달.
- **영향**: SSE 0.5초 업데이트마다 새 `deviceStatusMap` 참조 → 캔버스 live-update effect(`equip-topology-canvas.tsx:110`, `cs-canvas.tsx:109`)가 `deviceStatusMap` 의존성으로 매번 발동. 캔버스 내부에서 전 노드를 순회(`prev.map`)하므로 노드 수×배치 빈도의 연산. (캔버스 내부는 값 동일 시 노드 객체 재사용하는 가드가 일부 있어 완화됨—`equip-topology-canvas.tsx:141`.)

### [P1-3] ReactFlow 정적 import — 비-토폴로지 페이지 번들에도 영향
- **근거**: `components/topology/cs-canvas.tsx:9`, `equip-topology-canvas.tsx:9`에서 `reactflow`를 정적 import. 토폴로지 페이지는 `next/dynamic` 미적용(`app/topology/page.tsx:8-9`에서 직접 import). Cytoscape는 동적 로드(`ontology/page.tsx:210`)와 대조적.
- **영향**: ReactFlow + dagre + 스타일이 토폴로지 라우트 초기 청크에 포함. 탭 전환 시 두 캔버스(`EquipTopologyCanvas`,`CsCanvas`) 모두 정적 의존되어 미사용 탭 코드도 로드.

### [P1-4] recharts 정적 import → 대형 벤더 청크
- **근거**: `app/energy/page.tsx`, `app/history/page.tsx`, `components/dashboard/widget-energy-trend.tsx`, `dashboard-grid.tsx`, `charts/live-chart.tsx`가 recharts 정적 import. recharts(+d3 하위 의존)는 무거운 라이브러리.
- **영향**: 차트 미표시 상태에서도 해당 라우트 번들에 recharts 포함. dashboard는 `DashboardGrid`만 dynamic이라 일부 완화되나 energy/history는 무방비.

### [P1-5] 페이지별 독립 폴링 + 클라이언트 캐시 부재로 중복 페치
- **근거**: 동일 데이터를 여러 페이지가 각자 폴링·재요청. 예) `getEquipmentList()`가 dashboard(`app/page.tsx:65`), monitoring(`monitoring/page.tsx:260`)에서 각각 호출. 폴링 타이머: dashboard 30초/5분(`app/page.tsx:57,84`), control 10초(`control/page.tsx:287`), server-health 15초(`use-server-health.ts:97`), energy(`energy/page.tsx:120`). 캐시/dedup 없음 → 페이지 이동마다 풀 재요청.
- **영향**: 라우트 전환 시마다 콜드 페치(로딩 스피너 재노출), 백엔드 `_graph_cache`(5분 TTL) 외에는 프론트 캐시 부재. 동일 응답 반복 전송.

### [P2-1] `useRealtimeData`는 사용처가 없는데 구조상 WS+SSE 동시 연결 버그 보유
- **근거**: `useRealtimeData`(`sse.ts:198-209`)는 `useWebSocket()`과 `useSSE()`를 **둘 다** 호출한 뒤 분기 반환. 훅 규칙상 둘 다 마운트되어 **WS와 SSE가 동시에** 연결된다. 단, 전 코드베이스에서 `useRealtimeData` 호출처 0건(grep 결과) → 현재는 死코드.
- **영향**: 지금은 무해하나, 이 훅을 채택하면 즉시 연결 2배(WS+SSE)·상태 2벌이 된다. `ws.ts` 전체가 현재 미사용 死코드.

### [P2-2] `fetchJSON` 401 처리의 전역 부작용
- **근거**: `lib/api.ts:54-65` — 401 시 `localStorage` 토큰 삭제 후 `setTimeout(...window.location.href="/login",100)`. 동시에 여러 API가 401을 받으면 다중 리다이렉트 예약.
- **영향**: 토큰 만료 시 여러 병렬 요청(예: dashboard `Promise.allSettled` 4건—`app/page.tsx:42`)이 각각 리다이렉트를 스케줄. 기능 버그는 아니나 중복 네비게이션/레이스. SPA 라우터(`next/navigation`) 대신 풀 페이지 리로드라 SSE 재연결 비용도 동반.

### [P2-3] monitoring의 분류 헬퍼가 매 렌더 재생성 (useMemo 의존성 일부 누락)
- **근거**: `matchesCategory`/`matchesSubcategory`/`API_CATEGORY_MAP` 등이 컴포넌트 본문에서 매 렌더 재정의(`monitoring/page.tsx:272-310`). `hvacSubCounts` useMemo 의존성이 `[equipment]`인데 본문은 `monitorableEquipment` 사용(`:386-396`) — 의존성 불일치(미세 버그/스테일 가능).
- **영향**: 경미. 다만 `categoryCounts`/`hvacSubCounts`가 `monitorableEquipment` 전수 필터를 반복 — 장비 284개 기준 매 의존성 변경 시 수 회 순회.

### [P2-4] i18n 전체 메시지 클라이언트 전송
- **근거**: `app/layout.tsx`에서 `getMessages()` 전량을 `NextIntlClientProvider`에 주입. ko 32KB/en 31KB 전 네임스페이스가 모든 페이지 하이드레이션에 포함.
- **영향**: 네임스페이스 분할 없이 전 페이지가 전체 번역 번들을 받음. 현재 규모(32KB)에선 치명적이지 않으나 증가 시 비용.

---

## 3. 최적화 권고

### P0 (즉시 — 실시간 비용 구조 개선)
1. **SSE 단일화(Context/싱글톤)** — `useSSE`를 React Context Provider(또는 모듈 싱글톤 EventSource + 구독)로 전환해 앱 전체 **연결 1개**만 유지. `AlarmBanner`/각 페이지는 동일 store를 구독. (P0-1, P0-2 동시 해소)
   - 구현안: `SSEProvider`를 `ClientLayout`에 1회 마운트 → `useSSEStore(selector)` 형태로 `alarms`/`devices`/`points`/`pointHistory`를 **선택 구독**. `useSyncExternalStore` 또는 zustand류 외부 스토어로 selector 기반 리렌더 최소화.
2. **`pointHistory` 지연 구축** — 히스토리는 단일 장비 상세에서만 필요하므로, 싱글톤 store에서 `pointHistory`를 **옵션화**(구독자가 요청한 point_id만 누적)하거나 상세 페이지에서 `getPointHistory` API(`api.ts:303`)로 대체. 670개 배열 복사 제거. (P0-3)
3. **`AlarmBanner` 구독 범위 축소** — 새 store의 `alarms` selector만 구독해 포인트 배치 리렌더에서 분리.

### P1 (단기 — 렌더/번들)
4. **모니터링 카드 `memo` 분리** — 카드를 `EquipmentCard = memo(...)`로 추출하고 `isActive`(원시값)만 props로. `devices` 객체 대신 장비별 boolean을 selector로 전달해 변경된 카드만 리렌더. (P1-1)
5. **`deviceStatusMap`/`tabs` 메모이즈** — `topology/page.tsx`에서 `useMemo([devices])`/모듈 상수화. (P1-2)
6. **ReactFlow 동적 로드 + 탭별 분할** — `EquipTopologyCanvas`/`CsCanvas`를 `next/dynamic(..., {ssr:false})`로, 활성 탭만 로드. (P1-3)
7. **recharts 동적 로드** — energy/history의 차트 블록을 `next/dynamic`으로 분리하거나 `LiveChart`/`MultiLineChart` 자체를 dynamic 래핑. (P1-4)
8. **공유 데이터 캐시 도입** — SWR 또는 React Query 도입으로 `getEquipmentList` 등 정적 성향 데이터의 dedup/캐시/배경 갱신. 최소한 모듈 레벨 in-memory 캐시 + TTL. (P1-5)

### P2 (개선/위생)
9. **死코드 정리** — `useRealtimeData`/`lib/ws.ts` 채택 여부 결정. 채택 시 WS+SSE 동시 연결 버그(조건부 훅 호출) 수정, 미채택 시 제거. (P2-1)
10. **401 단일화** — `fetchJSON`에 리다이렉트 중복 가드(플래그) + `next/router` 기반 클라이언트 네비게이션 검토. (P2-2)
11. **monitoring 헬퍼 안정화** — 분류 맵/헬퍼를 모듈 상수·`useCallback`으로, `hvacSubCounts` 의존성 `[monitorableEquipment]`로 교정. (P2-3)
12. **i18n 네임스페이스 분할** — 페이지별 필요한 네임스페이스만 클라이언트 전달(next-intl per-route messages). (P2-4)

---

## 4. Impact × Effort 랭킹

| 우선 | 이슈 | Impact | Effort | 비고 |
|:----:|------|:------:|:------:|------|
| **P0-1** | SSE 다중 연결 → 싱글톤화 | ★★★★★ | 중 | 실시간 페이지당 연결/상태/리렌더 2배 제거. 가장 큰 비용 절감 |
| **P0-3** | `pointHistory` 무조건 구축 제거 | ★★★★☆ | 소 | 0.5초마다 670배열 복사 제거. 싱글톤화와 함께 처리 |
| **P0-2** | AlarmBanner 포인트 파이프라인 분리 | ★★★★☆ | 소 | 전역 상주 컴포넌트의 0.5초 리렌더 제거 (P0-1에 종속) |
| **P1-1** | 모니터링 284카드 memo화 | ★★★★☆ | 중 | 0.5초 전수 리렌더 → 변경분만. 체감 큰 페이지 |
| **P1-3** | ReactFlow 동적 로드 | ★★★☆☆ | 소 | 토폴로지 라우트 초기 청크 축소 |
| **P1-4** | recharts 동적 로드 | ★★★☆☆ | 소 | energy/history 번들 축소 |
| **P1-5** | 공유 캐시(SWR/RQ) | ★★★★☆ | 대 | 라우트 전환 페치 dedup, 구조 변경 동반 |
| **P1-2** | topology props 메모이즈 | ★★★☆☆ | 소 | 캔버스 live-update effect 발동 빈도 완화 |
| **P2-1** | useRealtimeData/ws.ts 死코드 | ★★☆☆☆ | 소 | 향후 함정 제거 |
| **P2-2** | 401 리다이렉트 중복 | ★★☆☆☆ | 소 | 위생/UX |
| **P2-3** | monitoring 헬퍼/의존성 | ★★☆☆☆ | 소 | 미세 버그 + 경미 연산 |
| **P2-4** | i18n 네임스페이스 분할 | ★★☆☆☆ | 중 | 현재 32KB, 증가 대비 |

> **권고 실행 순서**: P0-1+P0-2+P0-3을 SSE 싱글톤 리팩터로 **한 번에** 처리(상호 종속) → P1-1(모니터링 memo) → P1-3/P1-4(동적 로드, 저비용) → P1-5(캐시, 구조 작업) → P2 위생 정리.

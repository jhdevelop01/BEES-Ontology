/**
 * 라이브 온톨로지 — 중첩 포함 트리 빌더 훅 (건물 ⊃ 층 ⊃ 공간 ⊃ 설비 ⊃ 센서)
 *
 * Neo4j(`/api/ontology/graph`)의 실제 온톨로지를 가져와 **물리적으로 감싸는 중첩 카드 트리**
 * (`BrickTreeCardNode`)로 빌드한다. 계층 판정 로직은 검증된 `brick-ontology-graph.ts`와 동일:
 *   1) 레벨 = **Brick 클래스(labels 마지막) 우선** 판정:
 *        `/Sensor|Setpoint|Command|Status|Alarm/` → 센서(L4). 아니면 type 기반
 *        (Building/Site=0 · Floor=1 · Location/Zone/Room=2 · Equipment/System=3 · Point=4).
 *   2) 컨테이너(부모) 방향 정정:
 *        hasPart(s→t)=부모 s · hasPoint(s→t)=부모 s ·
 *        isPartOf/isLocatedIn/isPointOf/**hasLocation**(s→t)=부모 t. feeds/controls 제외.
 *   3) 부모 = 후보 컨테이너 중 **레벨 정확히 (자기−1)** 인 것. 없으면 합성 그룹으로 라우팅.
 *
 * ★ graph.ts 대비 차이 (사용자 확정사항):
 *   · Q1 — 설비/센서 없는 **빈 공간 카드도 전부** 포함(children 빈 배열).
 *   · Q2 — 특정 공간이 없는 **층직속 설비(L3)·센서(L4)** 는 각 층 아래 합성
 *          **"층 공용"(isCommon, category space, L2)** 카드 안에 넣고 그 안에서 설비→센서 중첩.
 *          (건물 직계 = 층만.)
 *
 * 계약(BrickTreeCardNode 등)은 `brick-topology-data.ts`, UI는 `brick-nested-cards.tsx`와 공유.
 * ⚠ 이 파일은 트리 데이터만 생산한다 — graph.ts/nodes/canvas/panels/data 는 건드리지 않는다.
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getOntologyGraph,
  type GraphResponse,
  type GraphNode,
} from "@/lib/api";
import {
  categoryOfType,
  iconForNode,
  type BrickCategory,
  type BrickCategoryBreakdown,
  type BrickNodeRelations,
  type BrickTreeCardNode,
} from "./brick-topology-data";

/* ── 반환 타입 ── */

export interface UseBrickOntologyTreeResult {
  root: BrickTreeCardNode | null;
  loading: boolean;
  error: string | null;
}

/* ── 상수 ── */

const GRAPH_LIMIT = 2000;

/** Brick 타입 → 고정 레벨. 0 건물 · 1 층 · 2 공간 · 3 설비 · 4 센서. (graph.ts와 동일) */
const LEVEL_OF_TYPE: Record<string, number> = {
  Building: 0,
  Site: 0,
  Floor: 1,
  Location: 2,
  Zone: 2,
  Room: 2,
  Equipment: 3,
  System: 3,
  Point: 4,
};
/** 타입이 표에 없을 때 카테고리 기반 레벨 폴백. */
const LEVEL_BY_CATEGORY: Record<BrickCategory, number> = {
  space: 2,
  equipment: 3,
  point: 4,
};
function levelOfNode(type: string | undefined, cat: BrickCategory): number {
  if (type && type in LEVEL_OF_TYPE) return LEVEL_OF_TYPE[type];
  return LEVEL_BY_CATEGORY[cat];
}

/** 포인트(센서/설정값/명령/상태/알람) 지표 — 실제 Brick 클래스명(labels 마지막). (graph.ts와 동일) */
const POINT_CLASS_RE = /Sensor|Setpoint|Command|_Status|Status|Alarm/i;

/** ★ 라벨 우선 분류: 백엔드 coarse type이 센서/설정값을 뭉개므로 실제 Brick 클래스가
 *  포인트 지표면 무조건 point/L4. 아니면 type 기반. 미분류(Other)면 null. (graph.ts와 동일) */
function classifyNode(
  type: string | undefined,
  labels: string[] | undefined,
): { category: BrickCategory; level: number } | null {
  const brickClass = labels && labels.length ? labels[labels.length - 1] : "";
  if (brickClass && POINT_CLASS_RE.test(brickClass)) {
    return { category: "point", level: 4 };
  }
  const cat = categoryOfType(type);
  if (!cat) return null; // Other 제외
  return { category: cat, level: levelOfNode(type, cat) };
}

/** 컨테인먼트 관계 → [자식(child), 컨테이너(container)]. 트리 무관 관계는 null.
 *  hasLocation(s→t): s가 t에 위치 → 컨테이너 t(★정정). (graph.ts와 동일) */
function containmentChildContainer(
  source: string,
  target: string,
  type: string,
): [string, string] | null {
  switch (type) {
    case "hasPart": // s가 t를 포함 → 컨테이너 s
    case "hasPoint": // s가 포인트 t 보유 → 컨테이너 s
      return [target, source];
    case "isPartOf": // s가 t에 소속 → 컨테이너 t
    case "isLocatedIn": // s가 t 안에 위치 → 컨테이너 t
    case "isPointOf": // s가 t의 포인트 → 컨테이너 t
    case "hasLocation": // ★ s가 t에 위치 → 컨테이너 t
      return [source, target];
    default:
      return null; // feeds/isFedBy/controls 등은 계층 제외
  }
}

function addToSetMap(map: Map<string, Set<string>>, key: string, value: string): void {
  const s = map.get(key);
  if (s) s.add(value);
  else map.set(key, new Set([value]));
}

/* 합성 그룹 노드 id (실 GraphNode 아님).
 *  · 건물-공용(L1): 소속 층이 없는 고아를 건물 직계로 모음(안전망, 정상 데이터엔 미생성).
 *  · 층 공용(L2): 특정 공간 없는 층직속 설비·센서를 담음(그 안에서 설비→센서 중첩). */
const BUILDING_COMMON_ID = "__common__";
const floorCommonId = (anchorId: string): string => `common-space-${anchorId}`;

/** 합성 노드 표시 메타. */
interface SynthMeta {
  labelKo: string;
  category: BrickCategory;
  level: number;
  icon: string;
}

/* ── 트리 빌드 ── */

function buildTree(graph: GraphResponse): BrickTreeCardNode | null {
  const nodes = graph.nodes ?? [];
  const edges = graph.edges ?? [];

  // 1) 분류(레벨/카테고리) — Other 제외
  const nodeById = new Map<string, GraphNode>();
  const categoryOf = new Map<string, BrickCategory>();
  const levelOf = new Map<string, number>();
  const rootIds: string[] = [];
  for (const n of nodes) {
    const cls = classifyNode(n.data.type, n.data.labels);
    if (!cls) continue;
    nodeById.set(n.data.id, n);
    categoryOf.set(n.data.id, cls.category);
    levelOf.set(n.data.id, cls.level);
    if (n.data.type === "Building" || n.data.type === "Site") rootIds.push(n.data.id);
  }

  const buildingRoot =
    rootIds.find((r) => nodeById.get(r)?.data.type === "Building") ?? rootIds[0];
  if (!buildingRoot) return null; // 건물/사이트 루트 없으면 트리 불가

  // 2) 컨테인먼트(방향 정정) → 컨테이너 후보 + 컨테이너→자식 인접(층 소속 추적용)
  const containersOf = new Map<string, Set<string>>(); // child → 컨테이너 후보
  const containsAdj = new Map<string, Set<string>>(); // container → 직접 자식
  for (const e of edges) {
    const { source, target, type } = e.data;
    const cc = containmentChildContainer(source, target, type);
    if (!cc) continue;
    const [child, container] = cc;
    if (child === container) continue;
    if (!categoryOf.has(child) || !categoryOf.has(container)) continue;
    addToSetMap(containersOf, child, container);
    addToSetMap(containsAdj, container, child);
  }

  // 3) 층 소속: 각 Floor에서 containsAdj 하향 BFS(최초 배정 유지). node → Floor id.
  const floorOfNode = new Map<string, string>();
  for (const n of nodes) {
    if (n.data.type !== "Floor") continue;
    const floorId = n.data.id;
    const queue = [floorId];
    const seen = new Set<string>([floorId]);
    while (queue.length) {
      const cur = queue.shift()!;
      for (const child of Array.from(containsAdj.get(cur) ?? [])) {
        if (seen.has(child)) continue;
        seen.add(child);
        if (!floorOfNode.has(child)) floorOfNode.set(child, floorId);
        queue.push(child);
      }
    }
  }

  // 4) 부모 라우팅 — 부모 = 레벨 정확히 (자기−1)인 컨테이너, 없으면 합성 그룹으로.
  //    건물 직계 = 층(L1)만 · 층 직계 = 공간(L2)/층공용 · 공간 직계 = 설비(L3) · 설비 직계 = 센서(L4).
  const synthMeta = new Map<string, SynthMeta>();
  const childrenMap = new Map<string, string[]>(); // parentId → childIds (실+합성)
  const linkChild = (parent: string, child: string): void => {
    const arr = childrenMap.get(parent);
    if (arr) arr.push(child);
    else childrenMap.set(parent, [child]);
  };

  /** 레벨 정확히 lvl-1 인 실 컨테이너(여럿이면 id 최소). 없으면 null. */
  const exactContainer = (id: string, lvl: number): string | null => {
    let best: string | null = null;
    for (const c of Array.from(containersOf.get(id) ?? [])) {
      if (levelOf.get(c) === lvl - 1 && (best === null || c < best)) best = c;
    }
    return best;
  };

  /** 층-공용(L2) 합성 카드 확보 후 id 반환. anchor = 실 층 id 또는 건물-공용(둘 다 L1). */
  const ensureFloorCommon = (anchor: string): string => {
    // 건물-공용(L1) 앵커면 먼저 생성(층이 없는 고아 대비 안전망)
    if (anchor === BUILDING_COMMON_ID && !synthMeta.has(BUILDING_COMMON_ID)) {
      synthMeta.set(BUILDING_COMMON_ID, {
        labelKo: "공용",
        category: "space",
        level: 1,
        icon: "Boxes",
      });
      linkChild(buildingRoot, BUILDING_COMMON_ID);
    }
    const fcid = floorCommonId(anchor);
    if (!synthMeta.has(fcid)) {
      synthMeta.set(fcid, {
        labelKo: "층 공용",
        category: "space",
        level: 2,
        icon: "Boxes",
      });
      linkChild(anchor, fcid); // 실 층(L1) 또는 건물-공용(L1) 아래
    }
    return fcid;
  };

  nodeById.forEach((_n, id) => {
    const lvl = levelOf.get(id)!;
    if (lvl === 0) return; // 건물/사이트 = 루트(부모 없음)

    if (lvl === 1) {
      // 층 → 건물 직계 (건물 컨테이너 유무와 무관하게 항상 건물 아래)
      if (id !== buildingRoot) linkChild(buildingRoot, id);
      return;
    }
    if (lvl === 2) {
      // 공간 → 소속 층(L1). 층 없으면 건물-공용(L1)
      const exact = exactContainer(id, 2); // 레벨1 컨테이너
      if (exact) return void linkChild(exact, id);
      const f = floorOfNode.get(id);
      if (f && f !== id) return void linkChild(f, id);
      // 층 미상 공간 → 건물-공용
      ensureFloorCommon(BUILDING_COMMON_ID); // 건물-공용 생성 보장(층공용은 안 씀)
      linkChild(BUILDING_COMMON_ID, id);
      return;
    }
    if (lvl === 3) {
      // 설비 → 소속 공간(L2). 없으면 그 층의 "층 공용"
      const exact = exactContainer(id, 3); // 레벨2 컨테이너(공간)
      if (exact) return void linkChild(exact, id);
      const anchor = floorOfNode.get(id) ?? BUILDING_COMMON_ID;
      linkChild(ensureFloorCommon(anchor), id);
      return;
    }
    // lvl === 4: 센서 → 소속 설비(L3). 없으면 그 층의 "층 공용" 직속(설비 건너뜀)
    const exact = exactContainer(id, 4); // 레벨3 컨테이너(설비)
    if (exact) return void linkChild(exact, id);
    const anchor = floorOfNode.get(id) ?? BUILDING_COMMON_ID;
    linkChild(ensureFloorCommon(anchor), id);
  });

  // 5) 흐름/제어 관계 인덱스 (feeds/isFedBy/controls) — 계층 트리엔 안 나오는 관계를 카드에 노출.
  //    feeds↔isFedBy 대칭: "feeds" 엣지 하나로 양방향(공급/공급받음) 모두 채우고, 별도 "isFedBy"
  //    엣지가 있으면 합쳐서 dedupe(Set). 상대 노드는 분류된 실노드(nodeById)만 수집.
  const feedsOut = new Map<string, Set<string>>(); // id → 하류(공급 대상)
  const fedByIn = new Map<string, Set<string>>(); // id → 상류(공급 소스)
  const controlsOut = new Map<string, Set<string>>(); // id → 제어 대상
  for (const e of edges) {
    const { source, target, type } = e.data;
    if (type === "feeds") {
      if (nodeById.has(source) && nodeById.has(target)) {
        addToSetMap(feedsOut, source, target); // source가 target에 공급
        addToSetMap(fedByIn, target, source); // target은 source로부터 공급받음
      }
    } else if (type === "isFedBy") {
      // "source isFedBy target" = source가 target으로부터 공급받음 → 대칭 feeds 채움
      if (nodeById.has(source) && nodeById.has(target)) {
        addToSetMap(fedByIn, source, target);
        addToSetMap(feedsOut, target, source);
      }
    } else if (type === "controls") {
      if (nodeById.has(source) && nodeById.has(target)) {
        addToSetMap(controlsOut, source, target);
      }
    }
  }

  // 6) 카드 트리 재귀 조립. count = 하위 총 노드 수(재귀).
  const labelOf = (n: GraphNode) => n.data.rdfsLabel || n.data.label || n.data.id;
  /** 상대 노드 id Set → 한글 라벨 배열(분류된 실노드만, dedupe는 Set으로 이미 보장). */
  const labelsOfSet = (ids: Set<string> | undefined): string[] => {
    if (!ids) return [];
    const out: string[] = [];
    for (const rid of Array.from(ids)) {
      const rn = nodeById.get(rid);
      if (rn) out.push(labelOf(rn));
    }
    return out;
  };
  const displayLabel = (id: string): string => {
    const sm = synthMeta.get(id);
    if (sm) return sm.labelKo;
    const n = nodeById.get(id);
    return n ? labelOf(n) : id;
  };
  // 안정 정렬: 라벨(층 등 숫자 자연순) → id
  const cmp = (a: string, b: string): number => {
    const la = displayLabel(a);
    const lb = displayLabel(b);
    const byLabel = la.localeCompare(lb, undefined, { numeric: true });
    if (byLabel !== 0) return byLabel;
    return a < b ? -1 : a > b ? 1 : 0;
  };

  const buildCard = (id: string): BrickTreeCardNode => {
    const sm = synthMeta.get(id);
    const kidIds = (childrenMap.get(id) ?? []).slice().sort(cmp);
    const children = kidIds.map(buildCard);
    const count = children.reduce((s, c) => s + 1 + c.count, 0);

    // breakdown(모든 노드): 하위 REAL 노드를 카테고리별 재귀 누적. 합성 자식 자체는 세지 않되,
    //   합성 노드가 감싼 실 하위(그 breakdown)는 포함 → '층 공용' 카드도 내부 설비/센서 분해가 보임.
    const breakdown: BrickCategoryBreakdown = { space: 0, equipment: 0, point: 0 };
    for (const c of children) {
      if (!c.isCommon) breakdown[c.category] += 1; // 실 자식 자체 +1
      breakdown.space += c.breakdown?.space ?? 0;
      breakdown.equipment += c.breakdown?.equipment ?? 0;
      breakdown.point += c.breakdown?.point ?? 0;
    }

    if (sm) {
      // 합성 '층 공용/공용' — relations 없음, breakdown만.
      return {
        id,
        labelKo: sm.labelKo,
        brickClass: "(공용)",
        category: sm.category,
        level: sm.level,
        icon: sm.icon,
        isCommon: true,
        count,
        breakdown,
        children,
      };
    }
    const n = nodeById.get(id)!;
    const labels = n.data.labels ?? [];
    const lastLabel = labels.length ? labels[labels.length - 1] : n.data.type || "Thing";
    const category = categoryOf.get(id)!;

    // relations(실 노드만, 하나라도 비지 않을 때만 부착)
    const feeds = labelsOfSet(feedsOut.get(id));
    const isFedBy = labelsOfSet(fedByIn.get(id));
    const controls = labelsOfSet(controlsOut.get(id));
    const relations: BrickNodeRelations | undefined =
      feeds.length || isFedBy.length || controls.length
        ? { feeds, isFedBy, controls }
        : undefined;

    return {
      id,
      labelKo: labelOf(n),
      brickClass: `brick:${lastLabel}`,
      category,
      level: levelOf.get(id) ?? LEVEL_BY_CATEGORY[category],
      icon: iconForNode(labels, category),
      isCommon: false,
      count,
      breakdown,
      ...(relations ? { relations } : {}),
      children,
    };
  };

  return buildCard(buildingRoot);
}

/* ── 훅 ── */

export function useBrickOntologyTree(): UseBrickOntologyTreeResult {
  const [graph, setGraph] = useState<GraphResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // fetch: 최초 1회 (limit=2000 전체 온톨로지)
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getOntologyGraph({ limit: GRAPH_LIMIT })
      .then((res) => {
        if (!cancelled) setGraph(res);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "온톨로지 그래프 로드 실패");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 트리는 그래프 로드 시 1회만 파생
  const root = useMemo(() => (graph ? buildTree(graph) : null), [graph]);

  return { root, loading, error };
}

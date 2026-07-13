/**
 * 라이브 온톨로지 그래프 — DataLayer 훅 (전량 표시 · 좌→우 타입고정 계층 컬럼 + 드릴다운)
 *
 * Neo4j(`/api/ontology/graph`)의 실제 온톨로지를 가져와
 *   1) 3카테고리(space/equipment/point)로 분류(Other 제외)
 *   2) 각 노드의 **레벨을 Brick 타입으로 고정**(그래프 거리 사용 안 함):
 *        L0 Building/Site · L1 Floor · L2 Location/Zone/Room(공간) ·
 *        L3 Equipment/System(설비) · L4 Point(센서).
 *      컨테인먼트 관계로 각 노드의 "컨테이너(부모)"를 모으되 **방향을 정확히** 해석:
 *        hasPart(s→t)=부모 s · isPartOf(s→t)=부모 t · hasLocation(s→t)=부모 t(★정정) ·
 *        isLocatedIn(s→t)=부모 t · hasPoint(s→t)=부모 s · isPointOf(s→t)=부모 t.
 *      드릴다운 부모 = 후보 컨테이너 중 **자기보다 한 레벨 위(가장 높은 레벨)** 하나.
 *   3) `expanded`에 따라 "펼친 노드의 직계 자식만" 점진 노출.
 *   4) 배치: **x = level * COLUMN_W 고정 컬럼**(좌 건물 → 우 센서), y는 부모 근처로 tidy.
 * 하는 데이터 훅. UI(brick-topology-live-canvas.tsx)와는 brick-topology-data.ts 의 계약을 공유.
 *
 * ⚠ 노드 data 형태는 BrickTreeNodeData(data.ts) = BrickCard(nodes.tsx) 기대 형태와 동일해야 한다.
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import { MarkerType, type Node, type Edge } from "reactflow";
import {
  getOntologyGraph,
  type GraphResponse,
  type GraphNode,
} from "@/lib/api";
import {
  categoryOfType,
  iconForNode,
  RELATION_META,
  type BrickCategory,
  type BrickRelation,
  type BrickTreeNodeData,
  type BrickExpandedSet,
} from "./brick-topology-data";

/* ── 반환 타입 ── */

export interface BrickTreeStats {
  total: number; // 분류된 전체 노드(space+equipment+point, Other 제외)
  shown: number; // 현재 펼침 상태로 렌더되는 노드 수
}

export interface UseBrickOntologyGraphResult {
  rfNodes: Node[];
  rfEdges: Edge[];
  rootIds: string[];
  allExpandableIds: string[]; // 자식이 1개 이상인 모든 노드(전체 펼치기용)
  stats: BrickTreeStats;
  loading: boolean;
  error: string | null;
}

/* ── 배치 상수 ── */

const GRAPH_LIMIT = 2000;

/* 타입고정 계층 컬럼 배치 파라미터 */
const COLUMN_W = 340; // 레벨(컬럼) 간 가로 간격 — x = level * COLUMN_W
const ROW_H = 90; // 같은 컬럼 내 카드 세로 간격(tidy 리프 슬롯)

/** Brick 타입 → 고정 레벨(컬럼). 좌 0 건물 → 우 4 센서. */
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
/** 타입이 위 표에 없을 때 카테고리 기반 레벨 폴백. */
const LEVEL_BY_CATEGORY: Record<BrickCategory, number> = {
  space: 2,
  equipment: 3,
  point: 4,
};
function levelOfNode(type: string | undefined, cat: BrickCategory): number {
  if (type && type in LEVEL_OF_TYPE) return LEVEL_OF_TYPE[type];
  return LEVEL_BY_CATEGORY[cat];
}

/** 포인트(센서/설정값/명령/상태/알람) 지표 — 실제 Brick 클래스명(labels 마지막)으로 판정. */
const POINT_CLASS_RE = /Sensor|Setpoint|Command|_Status|Status|Alarm/i;

/** ★ 라벨 우선 분류: 백엔드 coarse type(예 "Zone")이 센서/설정값을 뭉개므로,
 *  실제 Brick 클래스(labels 마지막)가 포인트 지표면 무조건 point/L4로 판정.
 *  아니면 기존 type 기반(categoryOfType/levelOfNode). 미분류(Other)면 null. */
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

/* 합성 그룹 노드 — 완전 엄격 계층 라우팅용(부모는 항상 자기 레벨−1).
 *  · 건물-공용(L1): 소속 층이 없는 고아를 모아 건물 직계로.
 *  · 층별 공용 공간(L2) / 공용 설비(L3): 층직속 설비·센서(레벨 건너뜀)를
 *    "층 → 공용공간(L2) → 공용설비(L3) → 센서(L4)"로 정상 계층 라우팅.
 *  → 각 클릭이 정확히 한 레벨 타입만 드러남(층 직계=공간만, 공간 직계=설비만 ...). */
const COMMON_ID = "__common__"; // 건물-공용(L1)
const commonSpaceId = (floorId: string): string => `common-space-${floorId}`; // L2
const commonEquipId = (floorId: string): string => `common-equip-${floorId}`; // L3

/** 합성 노드의 표시 메타(실 GraphNode가 아니므로 별도 보관). */
interface SynthMeta {
  labelKo: string;
  brickClass: string;
  icon: string;
  category: BrickCategory;
  level: number;
}

/* ── 타입고정 계층 트리 구조(그래프 1회 로드분에서 파생, 펼침 무관) ── */

interface TreeStructure {
  nodeById: Map<string, GraphNode>; // 분류된 노드만
  categoryOf: Map<string, BrickCategory>; // id → 카테고리(Other 제외)
  levelOf: Map<string, number>; // id → 타입고정 레벨(컬럼)
  children: Map<string, string[]>; // 드릴다운 부모 id → 직계 자식 id[]
  parentOf: Map<string, string>; // 드릴다운 자식 id → 부모 id(레벨 정확히 −1)
  synthMeta: Map<string, SynthMeta>; // 합성 그룹 노드 표시 메타(실 노드엔 없음)
  rootIds: string[]; // 루트(Building/Site)
  allExpandableIds: string[]; // 자식≥1 노드 전체
  total: number; // 분류된 실노드 수(합성 제외)
}

/** 컨테인먼트 관계 → [자식(child), 컨테이너(container)] 정규화. 트리 무관 관계는 null.
 *  "X hasLocation Y = X가 Y에 위치 = Y가 컨테이너(부모)" → hasLocation은 부모=target(★정정). */
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
      return null; // feeds/isFedBy/controls 등은 계층 제외(엣지 표시는 원본대로)
  }
}

/** Set 값 Map에 안전 추가. */
function addToSetMap(map: Map<string, Set<string>>, key: string, value: string): void {
  const s = map.get(key);
  if (s) s.add(value);
  else map.set(key, new Set([value]));
}

function buildTree(graph: GraphResponse): TreeStructure {
  const nodes = graph.nodes ?? [];
  const edges = graph.edges ?? [];

  const nodeById = new Map<string, GraphNode>();
  const categoryOf = new Map<string, BrickCategory>();
  const levelOf = new Map<string, number>();
  const rootIds: string[] = [];
  for (const n of nodes) {
    const cls = classifyNode(n.data.type, n.data.labels); // ★ 라벨 우선 분류
    if (!cls) continue; // Other 제외
    nodeById.set(n.data.id, n);
    categoryOf.set(n.data.id, cls.category);
    levelOf.set(n.data.id, cls.level);
    if (n.data.type === "Building" || n.data.type === "Site") {
      rootIds.push(n.data.id);
    }
  }

  // 컨테인먼트(방향 정정) → 각 노드의 컨테이너 후보 + 컨테이너→자식 인접(층 소속 추적용)
  const containersOf = new Map<string, Set<string>>(); // child → 컨테이너 후보들
  const containsAdj = new Map<string, Set<string>>(); // container → 직접 포함 자식들
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

  // 층 소속 판정: 각 Floor에서 containsAdj로 하향 BFS(최초 배정 유지). node → Floor 노드 id.
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

  // 드릴다운 부모 = 반드시 "자기 레벨 − 1"인 컨테이너. 없으면 합성 그룹으로 라우팅.
  //  → 층 직계=공간(L2)만, 공간 직계=설비(L3)만, 설비 직계=센서(L4)만 보장(완전 엄격).
  const synthMeta = new Map<string, SynthMeta>();
  let needBuildingCommon = false;
  const needCommonSpace = new Set<string>(); // 앵커 층 id(실층 또는 COMMON_ID)
  const needCommonEquip = new Set<string>();

  const resolveParent = (id: string): string | null => {
    const lvl = levelOf.get(id)!;
    if (lvl === 0) return null; // 건물/사이트 = 루트

    // 정확히 (자기−1) 레벨인 실제 컨테이너(여럿이면 id 최소)
    let exact: string | null = null;
    for (const c of Array.from(containersOf.get(id) ?? [])) {
      if (levelOf.get(c) === lvl - 1 && (exact === null || c < exact)) exact = c;
    }
    if (exact !== null) return exact;

    // ── 고아 라우팅(레벨−1 실컨테이너 없음) ──
    if (lvl === 1) {
      // 층: 건물 컨테이너 없음 → 루트 건물로(건물 직계 = 층)
      for (const r of rootIds) if (r !== id) return r;
      return null;
    }
    if (lvl === 2) {
      // 공간: 소속 층(L1)으로. 층 없으면 건물-공용(L1)
      const f = floorOfNode.get(id);
      if (f && f !== id) return f;
      needBuildingCommon = true;
      return COMMON_ID;
    }
    // 설비(L3)/센서(L4): 소속 층(없으면 건물-공용을 유사층으로)의 합성 체인으로
    const anchor = floorOfNode.get(id) ?? COMMON_ID;
    if (anchor === COMMON_ID) needBuildingCommon = true;
    if (lvl === 3) {
      needCommonSpace.add(anchor);
      return commonSpaceId(anchor); // L2
    }
    // lvl === 4 (센서): 그 층의 공용 설비(L3) 아래 (공용 공간 → 공용 설비 체인)
    needCommonSpace.add(anchor);
    needCommonEquip.add(anchor);
    return commonEquipId(anchor); // L3
  };

  // parentOf 계산 → children 역인덱스 구성 (실노드)
  const parentOf = new Map<string, string>();
  const children = new Map<string, string[]>();
  const linkChild = (parent: string, child: string): void => {
    const arr = children.get(parent);
    if (arr) arr.push(child);
    else children.set(parent, [child]);
  };
  nodeById.forEach((_n, id) => {
    const p = resolveParent(id);
    if (!p) return;
    parentOf.set(id, p);
    linkChild(p, id);
  });

  const total = categoryOf.size; // 실노드 수(합성 제외)

  // ── 합성 노드 생성(필요할 때만). 부모는 항상 자기 레벨−1 ──
  const buildingRoot =
    rootIds.find((r) => nodeById.get(r)?.data.type === "Building") ?? rootIds[0];

  // 건물-공용(L1) → 건물 직계
  if (needBuildingCommon && buildingRoot) {
    synthMeta.set(COMMON_ID, {
      labelKo: "공용",
      brickClass: "(공용)",
      icon: "Boxes",
      category: "space",
      level: 1,
    });
    parentOf.set(COMMON_ID, buildingRoot);
    linkChild(buildingRoot, COMMON_ID);
  }
  // 층별 공용 공간(L2) → 부모 = 실층 또는 건물-공용(둘 다 L1)
  for (const f of Array.from(needCommonSpace)) {
    const parent = f; // 실층 id 또는 COMMON_ID(둘 다 level 1)
    const parentExists = parent === COMMON_ID ? synthMeta.has(COMMON_ID) : nodeById.has(parent);
    if (!parentExists) continue; // 부모 층이 없으면(건물 없음 등) 생략
    const csid = commonSpaceId(f);
    synthMeta.set(csid, {
      labelKo: "공용 공간",
      brickClass: "(공용)",
      icon: "Boxes",
      category: "space",
      level: 2,
    });
    parentOf.set(csid, parent);
    linkChild(parent, csid);
  }
  // 층별 공용 설비(L3) → 부모 = 그 층의 공용 공간(L2)
  for (const f of Array.from(needCommonEquip)) {
    const csid = commonSpaceId(f);
    if (!synthMeta.has(csid)) continue; // 공용 공간이 있어야 부착 가능
    const ceid = commonEquipId(f);
    synthMeta.set(ceid, {
      labelKo: "공용 설비",
      brickClass: "(공용)",
      icon: "Box",
      category: "equipment",
      level: 3,
    });
    parentOf.set(ceid, csid);
    linkChild(csid, ceid);
  }

  // 자식이 1개 이상인 모든 노드(전체 펼치기용) — 합성 편입 후 계산
  const allExpandableIds: string[] = [];
  children.forEach((arr, id) => {
    if (arr.length > 0) allExpandableIds.push(id);
  });

  return {
    nodeById,
    categoryOf,
    levelOf,
    children,
    parentOf,
    synthMeta,
    rootIds,
    allExpandableIds,
    total,
  };
}

/* ── 가시성: 루트 + 펼친 노드의 직계 자식 (BFS, 다중부모 안전) ── */

function computeVisible(
  tree: TreeStructure,
  expanded: BrickExpandedSet,
): Set<string> {
  const visible = new Set<string>();
  const queue: string[] = [];
  for (const r of tree.rootIds) {
    if (!visible.has(r)) {
      visible.add(r);
      queue.push(r);
    }
  }
  while (queue.length) {
    const cur = queue.shift()!;
    if (!expanded.has(cur)) continue;
    for (const child of tree.children.get(cur) ?? []) {
      if (visible.has(child)) continue;
      visible.add(child);
      queue.push(child);
    }
  }
  return visible;
}

/* ── 코어 변환: 트리 + 펼침 → ReactFlow 요소(타입고정 컬럼 + tidy y 배치) ── */

function buildElements(
  graph: GraphResponse,
  tree: TreeStructure,
  expanded: BrickExpandedSet,
): Omit<UseBrickOntologyGraphResult, "loading" | "error" | "allExpandableIds"> {
  const edges = graph.edges ?? [];
  const visible = computeVisible(tree, expanded);

  const labelOf = (n: GraphNode) => n.data.rdfsLabel || n.data.label || n.data.id;
  const displayLabelOf = (id: string): string => {
    const sm = tree.synthMeta.get(id);
    if (sm) return sm.labelKo;
    const n = tree.nodeById.get(id);
    return n ? labelOf(n) : id;
  };
  const isKnown = (id: string): boolean =>
    tree.nodeById.has(id) || tree.synthMeta.has(id);

  // 1) 가시 드릴다운 포레스트 구성(가시 부모→가시 자식). 루트=부모가 없거나 안 보이는 노드.
  const visChildren = new Map<string, string[]>();
  const visRoots: string[] = [];
  visible.forEach((id) => {
    if (!isKnown(id)) return;
    const p = tree.parentOf.get(id);
    if (p && visible.has(p)) {
      const arr = visChildren.get(p);
      if (arr) arr.push(id);
      else visChildren.set(p, [id]);
    } else {
      visRoots.push(id);
    }
  });

  // 안정적 순서(라벨 → id)로 정렬
  const sortKeyOf = (id: string): string => displayLabelOf(id);
  const cmp = (a: string, b: string): number => {
    const ka = sortKeyOf(a);
    const kb = sortKeyOf(b);
    if (ka !== kb) return ka.localeCompare(kb);
    return a < b ? -1 : a > b ? 1 : 0;
  };
  visChildren.forEach((arr) => arr.sort(cmp));
  visRoots.sort(cmp);

  // 2) tidy y 배치: 리프는 순차 슬롯, 내부 노드는 자식 y의 평균(부모가 자식 근처).
  //    x는 배치에서 건드리지 않음 → 아래 노드 변환에서 level*COLUMN_W 고정.
  const yOf = new Map<string, number>();
  let cursor = 0;
  const assignY = (id: string): void => {
    const kids = visChildren.get(id) ?? [];
    if (kids.length === 0) {
      yOf.set(id, cursor);
      cursor += ROW_H;
      return;
    }
    for (const k of kids) assignY(k);
    const first = yOf.get(kids[0])!;
    const last = yOf.get(kids[kids.length - 1])!;
    yOf.set(id, (first + last) / 2);
  };
  for (const r of visRoots) assignY(r);

  // 3) 가시 노드 → ReactFlow 노드 변환 (x = level * COLUMN_W 고정 컬럼)
  //    합성 그룹 노드는 synthMeta로, 실노드는 GraphNode로 data 구성.
  const rfNodes: Node[] = [];
  let contentShown = 0;
  visible.forEach((id) => {
    const sm = tree.synthMeta.get(id);
    const cat = sm ? sm.category : tree.categoryOf.get(id);
    if (!cat) return; // 미분류 방어(있을 수 없음)
    const level = sm ? sm.level : tree.levelOf.get(id) ?? LEVEL_BY_CATEGORY[cat];
    const childCount = (tree.children.get(id) ?? []).length;

    let labelKo: string;
    let brickClass: string;
    let icon: string;
    if (sm) {
      labelKo = sm.labelKo;
      brickClass = sm.brickClass;
      icon = sm.icon;
    } else {
      const n = tree.nodeById.get(id);
      if (!n) return;
      const labels = n.data.labels ?? [];
      const lastLabel = labels.length ? labels[labels.length - 1] : n.data.type || "Thing";
      labelKo = labelOf(n);
      brickClass = `brick:${lastLabel}`;
      icon = iconForNode(labels, cat);
    }

    const data: BrickTreeNodeData = {
      labelKo,
      brickClass,
      icon,
      category: cat,
      expandable: childCount > 0,
      expanded: expanded.has(id),
      childCount,
    };
    rfNodes.push({
      id,
      type: cat, // brickNodeTypes 키(space/equipment/point)
      position: { x: level * COLUMN_W, y: yOf.get(id) ?? 0 },
      data,
    });
    contentShown++;
  });

  // ReactFlow 엣지 변환 (원본 관계, 양끝 노드가 모두 visible일 때만)
  const rfEdges: Edge[] = [];
  for (const e of edges) {
    const { id, source, target, type } = e.data;
    if (!visible.has(source) || !visible.has(target)) continue;
    const meta = RELATION_META[type as BrickRelation] as
      | (typeof RELATION_META)[BrickRelation]
      | undefined;
    const color = meta?.color ?? "#94A3B8"; // 미매핑 관계 = 회색
    const dashed = meta?.dashed ?? false;
    rfEdges.push({
      id,
      source,
      target,
      type: "default",
      style: {
        stroke: color,
        strokeWidth: 1.5,
        ...(dashed ? { strokeDasharray: "5 4" } : {}),
      },
      markerEnd: { type: MarkerType.ArrowClosed, color, width: 16, height: 16 },
      data: { relation: type },
    });
  }

  return {
    rfNodes,
    rfEdges,
    rootIds: tree.rootIds,
    stats: { total: tree.total, shown: contentShown }, // 모든 가시 카드 수
  };
}

/* ── 훅 ── */

const EMPTY_STATS: BrickTreeStats = { total: 0, shown: 0 };

export function useBrickOntologyGraph(
  expanded: BrickExpandedSet,
): UseBrickOntologyGraphResult {
  const [graph, setGraph] = useState<GraphResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // fetch: 최초 1회 (limit=2000 전체 온톨로지 로드)
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

  // 트리 구조는 그래프 로드 시 1회만 파생 (펼침 변화와 무관)
  const tree = useMemo(() => (graph ? buildTree(graph) : null), [graph]);

  // 가시 노드/엣지/배치는 트리+펼침 변화에만 재계산
  const derived = useMemo(() => {
    if (!graph || !tree) {
      return {
        rfNodes: [] as Node[],
        rfEdges: [] as Edge[],
        rootIds: [] as string[],
        stats: EMPTY_STATS,
      };
    }
    return buildElements(graph, tree, expanded);
  }, [graph, tree, expanded]);

  return {
    rfNodes: derived.rfNodes,
    rfEdges: derived.rfEdges,
    rootIds: derived.rootIds,
    allExpandableIds: tree?.allExpandableIds ?? [],
    stats: derived.stats,
    loading,
    error,
  };
}

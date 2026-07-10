/**
 * 라이브 온톨로지 그래프 — DataLayer 훅 (점진적 드릴다운 트리)
 *
 * Neo4j(`/api/ontology/graph`)의 실제 온톨로지를 가져와
 *   1) 3카테고리(space/equipment/point)로 분류(Other 제외)
 *   2) 컨테인먼트(부모→자식) 트리를 구성하고, `expanded` 집합에 따라
 *      "펼친 노드의 직계 자식만" 점진적으로 노출
 *   3) 가시 노드/엣지를 dagre(TB)로 배치해 ReactFlow Node/Edge 로 변환
 * 하는 데이터 훅. UI(brick-topology-live-canvas.tsx)와는 brick-topology-data.ts 의 계약을 공유.
 *
 * ⚠ 노드 data 형태는 BrickTreeNodeData(data.ts) = BrickCard(nodes.tsx) 기대 형태와 동일해야 한다.
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import { MarkerType, type Node, type Edge } from "reactflow";
import dagre from "@dagrejs/dagre";
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
  stats: BrickTreeStats;
  loading: boolean;
  error: string | null;
}

/* ── 배치/스타일 상수 ── */

const GRAPH_LIMIT = 2000;
const NODE_W = 150;
const NODE_H = 64;

/* ── 컨테인먼트 트리 구조(그래프 1회 로드분에서 파생, 필터 무관) ── */

interface TreeStructure {
  /** 분류된 노드만: id → GraphNode */
  nodeById: Map<string, GraphNode>;
  /** id → 카테고리 (Other 제외) */
  categoryOf: Map<string, BrickCategory>;
  /** 부모 id → 직계 자식 id 배열 (컨테인먼트 관계만) */
  children: Map<string, string[]>;
  /** 루트 id (Building/Site) */
  rootIds: string[];
  /** 분류된 전체 노드 수 */
  total: number;
}

/** 컨테인먼트 관계에서 부모→자식 방향을 정규화. 트리 무관 관계는 null. */
function containmentParentChild(
  source: string,
  target: string,
  type: string,
): [string, string] | null {
  switch (type) {
    case "hasPart":
    case "hasLocation":
    case "hasPoint":
      return [source, target];
    case "isPartOf":
    case "isLocatedIn":
    case "isPointOf":
      return [target, source];
    default:
      return null; // feeds/isFedBy/controls 등은 트리 계층에서 제외
  }
}

function buildTree(graph: GraphResponse): TreeStructure {
  const nodes = graph.nodes ?? [];
  const edges = graph.edges ?? [];

  const nodeById = new Map<string, GraphNode>();
  const categoryOf = new Map<string, BrickCategory>();
  const rootIds: string[] = [];
  for (const n of nodes) {
    const cat = categoryOfType(n.data.type);
    if (!cat) continue; // Other 제외
    nodeById.set(n.data.id, n);
    categoryOf.set(n.data.id, cat);
    if (n.data.type === "Building" || n.data.type === "Site") {
      rootIds.push(n.data.id);
    }
  }

  // 부모→자식 인접 (분류된 노드끼리만, 중복 자식 제거)
  const children = new Map<string, string[]>();
  const seenPair = new Set<string>();
  for (const e of edges) {
    const { source, target, type } = e.data;
    const pc = containmentParentChild(source, target, type);
    if (!pc) continue;
    const [parent, child] = pc;
    if (parent === child) continue;
    if (!categoryOf.has(parent) || !categoryOf.has(child)) continue;
    const key = `${parent} ${child}`;
    if (seenPair.has(key)) continue;
    seenPair.add(key);
    const arr = children.get(parent);
    if (arr) arr.push(child);
    else children.set(parent, [child]);
  }

  return { nodeById, categoryOf, children, rootIds, total: categoryOf.size };
}

/* ── 가시성: 루트 + 펼친 노드의 직계 자식 (BFS, 다중부모 안전) ── */

function computeVisible(
  tree: TreeStructure,
  expanded: BrickExpandedSet,
): Set<string> {
  const visible = new Set<string>();
  const queue: string[] = [];
  // 루트는 항상 보임
  for (const r of tree.rootIds) {
    if (!visible.has(r)) {
      visible.add(r);
      queue.push(r);
    }
  }
  // 보이는 노드가 expanded면 그 직계 자식을 노출
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

/* ── 코어 변환: 트리 + 펼침 → ReactFlow 요소 ── */

function buildElements(
  graph: GraphResponse,
  tree: TreeStructure,
  expanded: BrickExpandedSet,
): Omit<UseBrickOntologyGraphResult, "loading" | "error"> {
  const edges = graph.edges ?? [];
  const visible = computeVisible(tree, expanded);

  // dagre 트리 배치 (가시 노드 + 컨테인먼트 부모→자식 엣지)
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: "TB",
    nodesep: 40,
    ranksep: 90,
    marginx: 24,
    marginy: 24,
    ranker: "network-simplex",
  });
  visible.forEach((id) => g.setNode(id, { width: NODE_W, height: NODE_H }));
  tree.children.forEach((childIds, parent) => {
    if (!visible.has(parent)) return;
    for (const child of childIds) {
      if (visible.has(child)) g.setEdge(parent, child);
    }
  });
  dagre.layout(g);

  // ReactFlow 노드 변환
  const rfNodes: Node[] = [];
  visible.forEach((id) => {
    const n = tree.nodeById.get(id);
    if (!n) return;
    const cat = tree.categoryOf.get(id)!;
    const labels = n.data.labels ?? [];
    const lastLabel = labels.length ? labels[labels.length - 1] : n.data.type || "Thing";
    const childCount = (tree.children.get(id) ?? []).length;
    const pos = g.node(id) as { x: number; y: number } | undefined;
    const data: BrickTreeNodeData = {
      labelKo: n.data.rdfsLabel || n.data.label || n.data.id,
      brickClass: `brick:${lastLabel}`,
      icon: iconForNode(labels, cat),
      category: cat,
      expandable: childCount > 0,
      expanded: expanded.has(id),
      childCount,
    };
    rfNodes.push({
      id,
      type: cat, // brickNodeTypes 키(space/equipment/point)
      position: pos
        ? { x: pos.x - NODE_W / 2, y: pos.y - NODE_H / 2 }
        : { x: 0, y: 0 },
      data,
    });
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
    stats: { total: tree.total, shown: rfNodes.length },
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
    stats: derived.stats,
    loading,
    error,
  };
}

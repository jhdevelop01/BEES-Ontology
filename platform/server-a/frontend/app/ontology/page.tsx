"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  getOntologyGraph,
  searchOntology,
  getNodeDetail,
  runCypherQuery,
  type GraphResponse,
  type CypherResponse,
  type NodeDetail,
  type SearchResult,
} from "@/lib/api";
import {
  Search,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  Loader2,
  X,
  ExternalLink,
  Play,
  ChevronDown,
  ChevronUp,
  Terminal,
  ArrowLeft,
} from "lucide-react";
import { useTranslations } from "next-intl";

/* ── 스타일 상수 ── */

const NODE_COLORS: Record<string, string> = {
  Building: "#3b82f6",
  Floor: "#8b5cf6",
  Zone: "#10b981",
  System: "#f59e0b",
  Equipment: "#ef4444",
  Sensor: "#06b6d4",
  Other: "#6b7280",
};

const NODE_SHAPES: Record<string, string> = {
  Building: "round-rectangle",
  Floor: "rectangle",
  Zone: "ellipse",
  System: "diamond",
  Equipment: "hexagon",
  Sensor: "triangle",
};

const EDGE_STYLES: Record<string, { color: string; style: string }> = {
  feeds: { color: "#ef4444", style: "solid" },
  isFedBy: { color: "#f97316", style: "solid" },
  isPartOf: { color: "#8b5cf6", style: "dashed" },
  hasPart: { color: "#a78bfa", style: "dashed" },
  hasLocation: { color: "#10b981", style: "dotted" },
  isPointOf: { color: "#06b6d4", style: "dotted" },
  hasPoint: { color: "#0891b2", style: "dotted" },
};

const TYPE_FILTERS = [
  { label: "typeEquipment", value: "Equipment" },
  { label: "typeSensor", value: "Sensor" },
  { label: "typeZone", value: "Zone" },
  { label: "typeSystem", value: "System" },
  { label: "typeFloor", value: "Floor" },
];

const LAYOUTS = [
  { label: "layoutForce", value: "cose-bilkent" },
  { label: "layoutHierarchical", value: "breadthfirst" },
  { label: "layoutCircular", value: "circle" },
];

const LIMIT_OPTIONS = [
  { label: "200", value: 200 },
  { label: "500", value: 500 },
  { label: "1000", value: 1000 },
  { label: "전체", value: 2000 },
];

const CYPHER_EXAMPLES = [
  {
    label: "AHU 관계",
    cypher: "MATCH (n)-[r]-(m) WHERE n.uri CONTAINS 'AHU' RETURN n, r, m LIMIT 50",
  },
  {
    label: "Chiller 시스템",
    cypher: "MATCH (n)-[r]-(m) WHERE any(l IN labels(n) WHERE l CONTAINS 'Chiller') RETURN n, r, m LIMIT 50",
  },
  {
    label: "5층 장비",
    cypher: "MATCH (n)-[r]-(m) WHERE (n.uri CONTAINS '5F' OR n.uri CONTAINS '_5_') AND any(l IN labels(n) WHERE l IN ['AHU','FCU','VAV','Fan','Pump']) RETURN n, r, m LIMIT 100",
  },
  {
    label: "시스템 구조",
    cypher: "MATCH (s)-[:hasPart]->(e) WHERE any(l IN labels(s) WHERE l CONTAINS 'System') RETURN s, e LIMIT 100",
  },
];

function uriBrickId(uri: string): string {
  if (uri.includes("https://example.org/gec-b#")) {
    return "bldg:" + uri.replace("https://example.org/gec-b#", "");
  }
  const last = uri.split("#").pop() || uri.split("/").pop() || uri;
  return "bldg:" + last;
}

function resolveNodeType(labels: string[]): string {
  for (const t of [
    "Building",
    "Floor",
    "Zone",
    "System",
    "Equipment",
    "Sensor",
  ]) {
    if (labels.some((l) => l.toLowerCase().includes(t.toLowerCase()))) return t;
  }
  return "Other";
}

export default function OntologyPage() {
  const t = useTranslations("ontology");

  /* ── 상태 ── */
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<unknown>(null);
  const [graphData, setGraphData] = useState<GraphResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 필터
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [layoutName, setLayoutName] = useState("cose-bilkent");
  const [nodeLimit, setNodeLimit] = useState(500);

  // 검색
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 노드 상세
  const [selectedNode, setSelectedNode] = useState<NodeDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // 이웃 확장 상태
  const [expanding, setExpanding] = useState(false);

  // 로딩 단계 표시
  const [loadingStage, setLoadingStage] = useState<"api" | "init" | "layout" | null>(null);

  // Cypher 쿼리
  const [cypherOpen, setCypherOpen] = useState(false);
  const [cypherQuery, setCypherQuery] = useState("");
  const [cypherLoading, setCypherLoading] = useState(false);
  const [cypherError, setCypherError] = useState<string | null>(null);
  const [cypherResult, setCypherResult] = useState<CypherResponse | null>(null);
  const [cypherMode, setCypherMode] = useState(false);

  /* ── 그래프 데이터 로딩 ── */
  const loadGraph = useCallback(
    async (nodeType?: string) => {
      setLoading(true);
      setError(null);
      setLoadingStage("api");
      try {
        const data = await getOntologyGraph({
          nodeType: nodeType || undefined,
          limit: nodeLimit,
        });
        setGraphData(data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : t("graphError")
        );
      } finally {
        setLoading(false);
      }
    },
    [t, nodeLimit]
  );

  useEffect(() => {
    if (cypherMode) return; // Cypher 모드에서는 loadGraph 스킵
    loadGraph(selectedType || undefined);
  }, [selectedType, loadGraph, cypherMode]);

  /* ── Cytoscape 초기화 ── */
  useEffect(() => {
    if (!graphData || !containerRef.current) return;

    let destroyed = false;
    let dragSimRAF: number | null = null;

    async function initCytoscape() {
      const [cytoscapeModule, coseBilkentModule] = await Promise.all([
        import("cytoscape"),
        import("cytoscape-cose-bilkent"),
      ]);
      const cytoscape = cytoscapeModule.default;
      const coseBilkent = coseBilkentModule.default;

      if (destroyed) return;
      setLoadingStage("init");

      // 플러그인 등록 (중복 등록 방지)
      try {
        cytoscape.use(coseBilkent);
      } catch {
        // 이미 등록됨
      }

      // 기존 인스턴스 제거
      if (cyRef.current) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (cyRef.current as any).destroy();
      }

      // 노드 엘리먼트 구성
      const elements: Array<{
        group: "nodes" | "edges";
        data: Record<string, unknown>;
      }> = [];

      for (const node of graphData!.nodes) {
        const nodeType = resolveNodeType(node.data.labels);
        const isSecondary = node.data.secondary === true;
        elements.push({
          group: "nodes",
          data: {
            ...node.data,
            nodeType,
            color: NODE_COLORS[nodeType] || NODE_COLORS.Other,
            shape: NODE_SHAPES[nodeType] || "ellipse",
            secondary: isSecondary,
          },
        });
      }

      for (const edge of graphData!.edges) {
        elements.push({
          group: "edges",
          data: {
            ...edge.data,
            lineColor:
              EDGE_STYLES[edge.data.type]?.color || "#94a3b8",
            lineStyle:
              EDGE_STYLES[edge.data.type]?.style || "solid",
          },
        });
      }

      setLoadingStage("layout");

      const cy = cytoscape({
        container: containerRef.current!,
        elements,
        style: [
          {
            selector: "node",
            style: {
              label: "data(label)",
              "background-color": "data(color)",
              shape: "data(shape)",
              width: 30,
              height: 30,
              "font-size": "10px",
              "text-valign": "bottom",
              "text-halign": "center",
              "text-margin-y": 5,
              color: "#374151",
              "text-max-width": "80px",
              "text-wrap": "ellipsis",
              "border-width": 2,
              "border-color": "data(color)",
              "border-opacity": 0.3,
              "background-opacity": 0.85,
            } as any,
          },
          {
            selector: "node:selected",
            style: {
              "border-width": 4,
              "border-color": "#1d4ed8",
              "border-opacity": 1,
              width: 40,
              height: 40,
            },
          },
          {
            selector: "edge",
            style: {
              width: 1.5,
              "line-color": "data(lineColor)",
              "line-style": "data(lineStyle)",
              "target-arrow-color": "data(lineColor)",
              "target-arrow-shape": "triangle",
              "curve-style": "bezier",
              "arrow-scale": 0.8,
              opacity: 0.6,
            } as any,
          },
          {
            selector: "edge:selected",
            style: {
              width: 3,
              opacity: 1,
              label: "data(label)",
              "font-size": "9px",
              "text-background-color": "#ffffff",
              "text-background-opacity": 0.9,
              "text-background-padding": "2px",
            },
          },
          // 이웃(secondary) 노드 — 작고 흐리게
          {
            selector: "node[?secondary]",
            style: {
              width: 18,
              height: 18,
              "background-opacity": 0.4,
              "border-opacity": 0.15,
              "font-size": "8px",
              "text-opacity": 0.45,
            } as any,
          },
          // 하이라이트 스타일
          {
            selector: "node.highlighted",
            style: {
              "border-width": 4,
              "border-color": "#1d4ed8",
              "border-opacity": 1,
              "background-opacity": 1,
              "z-index": 10,
            },
          },
          {
            selector: "edge.highlighted",
            style: {
              width: 3,
              opacity: 1,
              "z-index": 10,
            } as any,
          },
          {
            selector: "node.dimmed",
            style: {
              "background-opacity": 0.15,
              "border-opacity": 0.1,
              "text-opacity": 0.15,
            } as any,
          },
          {
            selector: "edge.dimmed",
            style: {
              opacity: 0.08,
            } as any,
          },
          // 확장된 새 노드 표시 (pulse 효과)
          {
            selector: "node.newly-added",
            style: {
              "border-width": 3,
              "border-color": "#f59e0b",
              "border-style": "dashed",
            },
          },
        ],
        layout: {
          name: layoutName === "cose-bilkent" ? "cose-bilkent" : layoutName,
          animate: false,
          nodeDimensionsIncludeLabels: true,
          ...(layoutName === "cose-bilkent"
            ? {
                idealEdgeLength: elements.length > 2000 ? 60 : elements.length > 600 ? 80 : 120,
                nodeRepulsion: elements.length > 2000 ? 3000 : elements.length > 600 ? 4500 : 6000,
                gravity: elements.length > 2000 ? 0.6 : elements.length > 600 ? 0.4 : 0.25,
                numIter: elements.length > 2000 ? 500 : elements.length > 600 ? 800 : 2500,
                tile: true,
              }
            : {}),
          ...(layoutName === "breadthfirst"
            ? { directed: true, spacingFactor: 1.2 }
            : {}),
        } as unknown as cytoscape.LayoutOptions,
        minZoom: 0.1,
        maxZoom: 5,
        wheelSensitivity: 0.3,
      });

      // 하이라이트 함수
      const highlightNode = (targetNode: any) => {
        // 연결된 노드와 엣지
        const neighborhood = targetNode.neighborhood().add(targetNode);
        // 전체 dimmed
        cy.elements().addClass("dimmed").removeClass("highlighted");
        // 이웃만 하이라이트
        neighborhood.removeClass("dimmed").addClass("highlighted");
      };

      const clearHighlight = () => {
        cy.elements().removeClass("dimmed").removeClass("highlighted");
      };

      // ── 부드러운 드래그 물리 (오프셋 보존 + 반발) ──
      const SPRING_1HOP = 0.02;
      const SPRING_2HOP = 0.005;
      const DAMPING = 0.85;
      const MIN_VEL = 0.1;
      const MIN_DIST = 40;
      const REPULSION = 0.5;

      const velocities = new Map<string, { vx: number; vy: number }>();
      let simNeighbors: { id: string; hop: number; node: any; ox: number; oy: number }[] = [];

      const runDragSim = (draggedNode: any) => {
        const pos = draggedNode.position();
        let anyMoving = false;

        // 1) 스프링: 각 이웃을 (dragPos + offset) 방향으로 당김
        for (const entry of simNeighbors) {
          if (entry.node.grabbed()) continue;
          const vel = velocities.get(entry.id);
          if (!vel) continue;
          const npos = entry.node.position();
          const targetX = pos.x + entry.ox;
          const targetY = pos.y + entry.oy;
          const strength = entry.hop === 1 ? SPRING_1HOP : SPRING_2HOP;
          vel.vx += (targetX - npos.x) * strength;
          vel.vy += (targetY - npos.y) * strength;
        }

        // 2) 반발: 이웃 간 너무 가까우면 밀어냄
        for (let i = 0; i < simNeighbors.length; i++) {
          for (let j = i + 1; j < simNeighbors.length; j++) {
            const a = simNeighbors[i], b = simNeighbors[j];
            const apos = a.node.position(), bpos = b.node.position();
            const rdx = apos.x - bpos.x, rdy = apos.y - bpos.y;
            const dist = Math.sqrt(rdx * rdx + rdy * rdy) || 1;
            if (dist < MIN_DIST) {
              const force = ((MIN_DIST - dist) * REPULSION) / dist;
              const va = velocities.get(a.id), vb = velocities.get(b.id);
              if (va) { va.vx += rdx * force; va.vy += rdy * force; }
              if (vb) { vb.vx -= rdx * force; vb.vy -= rdy * force; }
            }
          }
        }

        // 3) 감쇠 + 적용
        for (const entry of simNeighbors) {
          if (entry.node.grabbed()) continue;
          const vel = velocities.get(entry.id);
          if (!vel) continue;
          vel.vx *= DAMPING;
          vel.vy *= DAMPING;
          if (Math.abs(vel.vx) > MIN_VEL || Math.abs(vel.vy) > MIN_VEL) {
            const npos = entry.node.position();
            entry.node.position({ x: npos.x + vel.vx, y: npos.y + vel.vy });
            anyMoving = true;
          }
        }

        if (anyMoving || draggedNode.grabbed()) {
          dragSimRAF = requestAnimationFrame(() => runDragSim(draggedNode));
        } else {
          dragSimRAF = null;
        }
      };

      cy.on("grab", "node", (evt: unknown) => {
        const node = (evt as any).target;
        const pos = node.position();
        velocities.clear();
        simNeighbors = [];
        const visited = new Set<string>([node.id()]);

        node.neighborhood("node").forEach((n: any) => {
          if (n.grabbed()) return;
          visited.add(n.id());
          const npos = n.position();
          velocities.set(n.id(), { vx: 0, vy: 0 });
          simNeighbors.push({ id: n.id(), hop: 1, node: n, ox: npos.x - pos.x, oy: npos.y - pos.y });
        });

        node.neighborhood("node").neighborhood("node").forEach((n: any) => {
          if (visited.has(n.id()) || n.grabbed()) return;
          visited.add(n.id());
          const npos = n.position();
          velocities.set(n.id(), { vx: 0, vy: 0 });
          simNeighbors.push({ id: n.id(), hop: 2, node: n, ox: npos.x - pos.x, oy: npos.y - pos.y });
        });

        if (dragSimRAF) cancelAnimationFrame(dragSimRAF);
        dragSimRAF = requestAnimationFrame(() => runDragSim(node));
      });

      cy.on("free", "node", () => {
        // 관성: rAF가 velocity < MIN_VEL까지 자동 감속
      });

      // 노드 클릭 이벤트 — 하이라이트 + 상세 패널
      cy.on("tap", "node", async (evt: unknown) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tappedNode = (evt as any).target;
        const nodeData = tappedNode.data();
        const nodeId = nodeData.id;

        // 연결 하이라이트
        highlightNode(tappedNode);

        // 상세 정보 로딩
        setDetailLoading(true);
        try {
          const detail = await getNodeDetail(nodeId);
          setSelectedNode(detail);
        } catch {
          setSelectedNode({
            uri: nodeData.uri || nodeId,
            name: nodeData.label || nodeId,
            labels: nodeData.labels || [],
            type: nodeData.nodeType || "Unknown",
            properties: {},
            connections: [],
          });
        } finally {
          setDetailLoading(false);
        }
      });

      // 노드 더블클릭 — 이웃 확장
      cy.on("dbltap", "node", async (evt: unknown) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tappedNode = (evt as any).target;
        const nodeData = tappedNode.data();
        const nodeId = nodeData.id;

        setExpanding(true);
        try {
          const detail = await getNodeDetail(nodeId);
          const newElements: Array<{
            group: "nodes" | "edges";
            data: Record<string, unknown>;
          }> = [];

          for (const conn of detail.connections) {
            const targetId = conn.target_uri;
            // 이미 그래프에 있는 노드는 스킵
            if (cy.getElementById(targetId).length > 0) continue;

            const connNodeType = resolveNodeType(conn.target_labels);
            const connName = targetId.split("#").pop() || targetId.split("/").pop() || targetId;

            // 새 노드 추가
            newElements.push({
              group: "nodes",
              data: {
                id: targetId,
                label: connName,
                uri: targetId,
                labels: conn.target_labels,
                nodeType: connNodeType,
                color: NODE_COLORS[connNodeType] || NODE_COLORS.Other,
                shape: NODE_SHAPES[connNodeType] || "ellipse",
              },
            });

            // 엣지 추가
            const edgeId = conn.direction === "outgoing"
              ? `${nodeId}_${conn.rel}_${targetId}`
              : `${targetId}_${conn.rel}_${nodeId}`;

            if (cy.getElementById(edgeId).length === 0) {
              newElements.push({
                group: "edges",
                data: {
                  id: edgeId,
                  source: conn.direction === "outgoing" ? nodeId : targetId,
                  target: conn.direction === "outgoing" ? targetId : nodeId,
                  label: conn.rel,
                  type: conn.rel,
                  lineColor: EDGE_STYLES[conn.rel]?.color || "#94a3b8",
                  lineStyle: EDGE_STYLES[conn.rel]?.style || "solid",
                },
              });
            }
          }

          if (newElements.length > 0) {
            // 드래그 물리 중단 (layout 충돌 방지)
            if (dragSimRAF) {
              cancelAnimationFrame(dragSimRAF);
              dragSimRAF = null;
            }

            const added = cy.add(newElements as any);
            // 새로 추가된 노드에 표시
            added.nodes().addClass("newly-added");
            // 3초 후 표시 제거
            setTimeout(() => {
              added.nodes().removeClass("newly-added");
            }, 3000);

            // 추가된 노드 주변으로 레이아웃 재실행
            const layoutOpts: any = {
              name: "cose-bilkent",
              animate: true,
              animationDuration: 500,
              fit: false,
              nodeDimensionsIncludeLabels: true,
              idealEdgeLength: 120,
              nodeRepulsion: 6000,
              gravity: 0.25,
              numIter: 1000,
            };
            cy.layout(layoutOpts).run();
          }
        } catch {
          // 확장 실패 시 무시
        } finally {
          setExpanding(false);
        }
      });

      // 빈 공간 클릭 시 하이라이트 해제 + 상세 패널 닫기
      cy.on("tap", (evt: unknown) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((evt as any).target === cy) {
          clearHighlight();
          setSelectedNode(null);
        }
      });

      cyRef.current = cy;
      setLoading(false);
      setLoadingStage(null);
    }

    initCytoscape();

    return () => {
      destroyed = true;
      if (dragSimRAF) {
        cancelAnimationFrame(dragSimRAF);
        dragSimRAF = null;
      }
      if (cyRef.current) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (cyRef.current as any).destroy();
        cyRef.current = null;
      }
    };
  }, [graphData, layoutName]);

  /* ── 검색 (디바운스 300ms) ── */
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setSearchOpen(false);
      return;
    }
    searchTimerRef.current = setTimeout(async () => {
      try {
        const res = await searchOntology(searchQuery, 10);
        setSearchResults(res.results);
        setSearchOpen(true);
      } catch {
        setSearchResults([]);
      }
    }, 300);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [searchQuery]);

  /* ── Cytoscape 컨트롤 ── */
  const zoomIn = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cy = cyRef.current as any;
    if (cy) cy.zoom({ level: cy.zoom() * 1.3, renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } });
  };
  const zoomOut = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cy = cyRef.current as any;
    if (cy) cy.zoom({ level: cy.zoom() / 1.3, renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } });
  };
  const fitGraph = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cy = cyRef.current as any;
    if (cy) cy.fit(undefined, 40);
  };
  const reLayout = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cy = cyRef.current as any;
    if (!cy) return;
    const layout = cy.layout({
      name: layoutName,
      animate: true,
      animationDuration: 500,
      nodeDimensionsIncludeLabels: true,
      ...(layoutName === "cose-bilkent"
        ? {
            idealEdgeLength: cy.nodes().length > 1000 ? 60 : cy.nodes().length > 300 ? 80 : 120,
            nodeRepulsion: cy.nodes().length > 1000 ? 3000 : cy.nodes().length > 300 ? 4500 : 6000,
            gravity: cy.nodes().length > 1000 ? 0.6 : cy.nodes().length > 300 ? 0.4 : 0.25,
            numIter: cy.nodes().length > 1000 ? 500 : cy.nodes().length > 300 ? 800 : 2500,
            tile: true,
          }
        : {}),
      ...(layoutName === "breadthfirst" ? { directed: true, spacingFactor: 1.2 } : {}),
    });
    layout.run();
  };

  /* ── 검색 결과에서 노드 선택 ── */
  const handleSearchSelect = async (result: SearchResult) => {
    setSearchOpen(false);
    setSearchQuery(result.name);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cy = cyRef.current as any;
    if (cy) {
      const node = cy.getElementById(uriBrickId(result.uri));
      if (node && node.length > 0) {
        // 카메라 이동 + 하이라이트
        cy.animate({
          center: { eles: node },
          zoom: 2,
        }, { duration: 400 });
        node.select();

        // 연결 하이라이트
        const neighborhood = node.neighborhood().add(node);
        cy.elements().addClass("dimmed").removeClass("highlighted");
        neighborhood.removeClass("dimmed").addClass("highlighted");
      }
    }

    // 상세 정보 로딩
    setDetailLoading(true);
    try {
      const detail = await getNodeDetail(result.uri);
      setSelectedNode(detail);
    } catch {
      setSelectedNode({
        uri: result.uri,
        name: result.name,
        labels: result.labels,
        type: result.labels[0] || "Unknown",
        properties: {},
        connections: [],
      });
    } finally {
      setDetailLoading(false);
    }
  };

  /* ── Cypher 쿼리 실행 ── */
  const executeCypher = useCallback(async () => {
    if (!cypherQuery.trim()) return;
    setCypherLoading(true);
    setCypherError(null);
    try {
      const result = await runCypherQuery(cypherQuery);
      setCypherResult(result);
      setCypherMode(true);
      // Cypher 결과를 graphData 형태로 변환하여 Cytoscape에 표시
      setGraphData({
        nodes: result.nodes,
        edges: result.edges,
        stats: {
          node_count: result.stats.node_count,
          edge_count: result.stats.edge_count,
        },
      });
    } catch (err) {
      setCypherError(
        err instanceof Error ? err.message : "쿼리 실행 실패"
      );
    } finally {
      setCypherLoading(false);
    }
  }, [cypherQuery]);

  const exitCypherMode = useCallback(() => {
    setCypherMode(false);
    setCypherResult(null);
    setCypherError(null);
    loadGraph(selectedType || undefined);
  }, [loadGraph, selectedType]);

  /* ── 렌더 ── */
  return (
    <div className="min-h-screen">
      <Header title={t("title")} description={t("description")} />

      <div className="p-3 md:p-6 space-y-4">
        {/* 상단 컨트롤바 */}
        <div className="flex flex-wrap items-center gap-2 md:gap-3">
          {/* 검색 */}
          <div className="relative flex-1 min-w-[180px] md:min-w-[240px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder={t("searchPlaceholder")}
              className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => {
                if (searchResults.length > 0) setSearchOpen(true);
              }}
            />
            {searchQuery && (
              <button
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                onClick={() => {
                  setSearchQuery("");
                  setSearchResults([]);
                  setSearchOpen(false);
                }}
              >
                <X className="h-4 w-4" />
              </button>
            )}

            {/* 검색 드롭다운 */}
            {searchOpen && searchResults.length > 0 && (
              <div className="absolute z-50 top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {searchResults.map((r) => (
                  <button
                    key={r.uri}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-blue-50 border-b border-gray-50 last:border-0"
                    onClick={() => handleSearchSelect(r)}
                  >
                    <p className="font-medium text-gray-900">{r.name}</p>
                    <div className="flex gap-1.5 mt-1">
                      {r.labels.slice(0, 3).map((l) => (
                        <Badge key={l} variant="secondary" className="text-[10px] px-1.5 py-0">
                          {l}
                        </Badge>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 타입 필터 */}
          <div className="flex items-center gap-1.5">
            <Button
              variant={selectedType === null ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedType(null)}
            >
              {t("typeAll")}
            </Button>
            {TYPE_FILTERS.map((f) => (
              <Button
                key={f.value}
                variant={selectedType === f.value ? "default" : "outline"}
                size="sm"
                onClick={() =>
                  setSelectedType(selectedType === f.value ? null : f.value)
                }
              >
                {t(f.label)}
              </Button>
            ))}
          </div>

          {/* 레이아웃 선택 — 모바일에서 숨김 */}
          <div className="hidden md:flex items-center gap-1.5 border-l border-gray-200 pl-3">
            {LAYOUTS.map((l) => (
              <Button
                key={l.value}
                variant={layoutName === l.value ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setLayoutName(l.value)}
              >
                {t(l.label)}
              </Button>
            ))}
          </div>

          {/* 노드 수 제어 */}
          <div className="hidden md:flex items-center gap-1.5 border-l border-gray-200 pl-3">
            <span className="text-xs text-gray-500 mr-1">{t("nodeLimit") ?? "노드"}</span>
            {LIMIT_OPTIONS.map((opt) => (
              <Button
                key={opt.value}
                variant={nodeLimit === opt.value ? "secondary" : "ghost"}
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setNodeLimit(opt.value)}
              >
                {opt.label}
              </Button>
            ))}
          </div>

          {/* 줌 컨트롤 */}
          <div className="flex items-center gap-1 md:border-l md:border-gray-200 md:pl-3">
            <Button variant="ghost" size="icon" onClick={zoomIn} title={t("zoomIn")}>
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={zoomOut} title={t("zoomOut")}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={fitGraph} title={t("fitScreen")}>
              <Maximize2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={reLayout} title={t("reLayout")}>
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>

          {/* 통계 */}
          {graphData && (
            <div className="flex items-center gap-2 text-xs text-gray-500 border-l border-gray-200 pl-3">
              <span>{t("nodeCount", { count: graphData.stats.node_count })}</span>
              <span className="text-gray-300">|</span>
              <span>{t("edgeCount", { count: graphData.stats.edge_count })}</span>
            </div>
          )}
        </div>

        {/* Cypher 쿼리 바 */}
        <div className="bg-gray-900 rounded-lg overflow-hidden">
          {/* 토글 헤더 */}
          <button
            className="w-full flex items-center justify-between px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 transition-colors"
            onClick={() => setCypherOpen(!cypherOpen)}
          >
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-green-400" />
              <span className="font-mono text-green-400">neo4j$</span>
              <span className="text-gray-500">{t("cypherToggle")}</span>
            </div>
            <div className="flex items-center gap-2">
              {cypherMode && cypherResult && (
                <span className="text-xs text-gray-500">
                  {cypherResult.stats.node_count} nodes, {cypherResult.stats.edge_count} edges — {cypherResult.stats.execution_ms}ms
                </span>
              )}
              {cypherOpen ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </div>
          </button>

          {/* 쿼리 입력 영역 */}
          {cypherOpen && (
            <div className="border-t border-gray-700 p-3 space-y-2">
              <div className="flex gap-2">
                <textarea
                  className="flex-1 bg-gray-800 text-gray-100 font-mono text-sm px-3 py-2 rounded border border-gray-600 focus:outline-none focus:border-green-500 resize-none placeholder-gray-500"
                  rows={3}
                  placeholder={t("cypherPlaceholder")}
                  value={cypherQuery}
                  onChange={(e) => setCypherQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                      e.preventDefault();
                      executeCypher();
                    }
                  }}
                />
                <div className="flex flex-col gap-1">
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 text-white h-8"
                    onClick={executeCypher}
                    disabled={cypherLoading || !cypherQuery.trim()}
                  >
                    {cypherLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                  </Button>
                  {cypherMode && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs border-gray-600 text-gray-300 hover:bg-gray-700"
                      onClick={exitCypherMode}
                    >
                      <ArrowLeft className="h-3 w-3 mr-1" />
                      {t("cypherBack")}
                    </Button>
                  )}
                </div>
              </div>

              {/* 예시 쿼리 */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] text-gray-500 mr-1">예시:</span>
                {CYPHER_EXAMPLES.map((ex) => (
                  <button
                    key={ex.label}
                    className="text-[11px] px-2 py-0.5 rounded-full bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white transition-colors"
                    onClick={() => setCypherQuery(ex.cypher)}
                  >
                    {ex.label}
                  </button>
                ))}
              </div>

              {/* 에러 메시지 */}
              {cypherError && (
                <div className="text-xs text-red-400 bg-red-900/30 rounded px-3 py-1.5">
                  {cypherError}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 메인 컨텐츠: 그래프 + 상세 패널 */}
        <div className="flex flex-col md:flex-row gap-4" style={{ height: "calc(100vh - 200px)" }}>
          {/* 그래프 영역 */}
          <Card className="flex-1 relative overflow-hidden min-h-[300px]">
            <CardContent className="p-0 h-full">
              {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
                  <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">
                      {loadingStage === "api" ? t("loadingApi")
                        : loadingStage === "init" ? t("loadingInit")
                        : loadingStage === "layout" ? t("loadingLayout")
                        : t("graphLoading")}
                    </p>
                  </div>
                </div>
              )}
              {error && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
                  <div className="text-center">
                    <p className="text-sm text-red-500 mb-2">{error}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => loadGraph(selectedType || undefined)}
                    >
                      {t("retry")}
                    </Button>
                  </div>
                </div>
              )}
              <div ref={containerRef} className="w-full h-full" />

              {/* 이웃 확장 로딩 */}
              {expanding && (
                <div className="absolute top-4 right-4 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 shadow-sm flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
                  <span className="text-xs text-amber-700">{t("neighborLoading")}</span>
                </div>
              )}

              {/* 범례 — 모바일에서 숨김 */}
              <div className="hidden md:block absolute bottom-4 left-4 bg-white/95 border border-gray-200 rounded-lg p-3 shadow-sm">
                <p className="text-xs font-semibold text-gray-600 mb-2">
                  {t("nodeType")}
                </p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  {Object.entries(NODE_COLORS).map(([type, color]) => (
                    <div key={type} className="flex items-center gap-1.5">
                      <div
                        className="w-3 h-3 rounded-sm"
                        style={{ backgroundColor: color }}
                      />
                      <span className="text-[10px] text-gray-600">{type}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs font-semibold text-gray-600 mt-2 mb-1">
                  {t("relationship")}
                </p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  {Object.entries(EDGE_STYLES).map(([rel, style]) => (
                    <div key={rel} className="flex items-center gap-1.5">
                      <div className="w-5 h-0 border-t-2" style={{
                        borderColor: style.color,
                        borderStyle: style.style === "dotted" ? "dotted" : style.style === "dashed" ? "dashed" : "solid",
                      }} />
                      <span className="text-[10px] text-gray-600">{rel}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-2 pt-2 border-t border-gray-100">
                  <p className="text-[9px] text-gray-400">
                    {t("clickHint")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 상세 패널 — 모바일: 하단 시트, 데스크탑: 사이드 패널 */}
          {(selectedNode || detailLoading) && (
            <Card className="w-full md:w-80 flex-shrink-0 overflow-y-auto max-h-[50vh] md:max-h-none">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">{t("nodeDetail")}</CardTitle>
                  <button
                    className="text-gray-400 hover:text-gray-600"
                    onClick={() => setSelectedNode(null)}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {detailLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                  </div>
                ) : selectedNode ? (
                  <>
                    {/* 이름 */}
                    <div>
                      <h3 className="text-base font-semibold text-gray-900">
                        {selectedNode.name}
                      </h3>
                      <p className="text-xs text-gray-400 font-mono mt-1 break-all">
                        {selectedNode.uri}
                      </p>
                    </div>

                    {/* 레이블 배지 */}
                    <div className="flex flex-wrap gap-1.5">
                      {selectedNode.labels.map((l) => {
                        const nt = resolveNodeType([l]);
                        return (
                          <Badge
                            key={l}
                            className="text-[10px]"
                            style={{
                              backgroundColor: `${NODE_COLORS[nt] || NODE_COLORS.Other}20`,
                              color: NODE_COLORS[nt] || NODE_COLORS.Other,
                              borderColor: NODE_COLORS[nt] || NODE_COLORS.Other,
                            }}
                          >
                            {l}
                          </Badge>
                        );
                      })}
                    </div>

                    {/* 속성 */}
                    {Object.keys(selectedNode.properties).length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-gray-600 mb-1">
                          {t("properties")}
                        </p>
                        <div className="space-y-1">
                          {Object.entries(selectedNode.properties).map(
                            ([key, val]) => (
                              <div
                                key={key}
                                className="flex justify-between text-xs py-1 border-b border-gray-50"
                              >
                                <span className="text-gray-500">{key}</span>
                                <span className="text-gray-900 font-medium text-right max-w-[160px] truncate">
                                  {String(val)}
                                </span>
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    )}

                    {/* 연결 */}
                    {selectedNode.connections.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-gray-600 mb-1">
                          {t("connections")} ({selectedNode.connections.length})
                        </p>
                        <div className="space-y-1.5 max-h-64 overflow-y-auto">
                          {selectedNode.connections.map((conn, i) => (
                            <div
                              key={i}
                              className="flex items-start gap-2 text-xs py-1.5 px-2 rounded bg-gray-50 hover:bg-gray-100 cursor-pointer"
                              onClick={() => {
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                const cy = cyRef.current as any;
                                if (cy) {
                                  const node = cy.getElementById(uriBrickId(conn.target_uri));
                                  if (node && node.length > 0) {
                                    cy.animate(
                                      { center: { eles: node }, zoom: 2 },
                                      { duration: 400 }
                                    );
                                    node.select();
                                  }
                                }
                              }}
                            >
                              <span
                                className={`mt-0.5 font-mono text-[10px] flex-shrink-0 ${
                                  conn.direction === "outgoing"
                                    ? "text-red-500"
                                    : "text-blue-500"
                                }`}
                              >
                                {conn.direction === "outgoing" ? "->" : "<-"}
                              </span>
                              <div className="min-w-0">
                                <p className="font-medium text-gray-700 flex items-center gap-1">
                                  <span className="text-[10px] text-gray-400">
                                    [{conn.rel}]
                                  </span>
                                  <ExternalLink className="h-2.5 w-2.5 text-gray-300" />
                                </p>
                                <p className="text-gray-500 truncate">
                                  {conn.target_uri.split("/").pop() ||
                                    conn.target_uri}
                                </p>
                                <div className="flex gap-1 mt-0.5">
                                  {conn.target_labels.slice(0, 2).map((l) => (
                                    <Badge
                                      key={l}
                                      variant="secondary"
                                      className="text-[9px] px-1 py-0"
                                    >
                                      {l}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : null}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

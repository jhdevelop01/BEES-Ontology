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
  type GraphResponse,
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

  /* ── 그래프 데이터 로딩 ── */
  const loadGraph = useCallback(
    async (nodeType?: string) => {
      setLoading(true);
      setError(null);
      try {
        const data = await getOntologyGraph({
          nodeType: nodeType || undefined,
          limit: 200,
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
    [t]
  );

  useEffect(() => {
    loadGraph(selectedType || undefined);
  }, [selectedType, loadGraph]);

  /* ── Cytoscape 초기화 ── */
  useEffect(() => {
    if (!graphData || !containerRef.current) return;

    let destroyed = false;

    async function initCytoscape() {
      const cytoscapeModule = await import("cytoscape");
      const coseBilkentModule = await import("cytoscape-cose-bilkent");
      const cytoscape = cytoscapeModule.default;
      const coseBilkent = coseBilkentModule.default;

      if (destroyed) return;

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
        elements.push({
          group: "nodes",
          data: {
            ...node.data,
            nodeType,
            color: NODE_COLORS[nodeType] || NODE_COLORS.Other,
            shape: NODE_SHAPES[nodeType] || "ellipse",
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

      const cy = cytoscape({
        container: containerRef.current!,
        elements,
        style: [
          {
            selector: "node",
            style: {
              label: "data(label)",
              "background-color": "data(color)",
              shape: "ellipse",
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
              "line-style": "solid",
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
                idealEdgeLength: 120,
                nodeRepulsion: 6000,
                gravity: 0.25,
                numIter: 2500,
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
    }

    initCytoscape();

    return () => {
      destroyed = true;
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
        ? { idealEdgeLength: 120, nodeRepulsion: 6000, gravity: 0.25, numIter: 2500 }
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
      const node = cy.getElementById(result.uri);
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

        {/* 메인 컨텐츠: 그래프 + 상세 패널 */}
        <div className="flex flex-col md:flex-row gap-4" style={{ height: "calc(100vh - 200px)" }}>
          {/* 그래프 영역 */}
          <Card className="flex-1 relative overflow-hidden min-h-[300px]">
            <CardContent className="p-0 h-full">
              {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
                  <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">{t("graphLoading")}</p>
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
                                  const node = cy.getElementById(conn.target_uri);
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

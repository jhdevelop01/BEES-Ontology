/**
 * Brick Schema 라이브 토폴로지 — 점진적 드릴다운(트리) 캔버스
 *
 * 초기엔 전체 토폴로지(건물+층+존+설비+포인트)를 펼쳐서 표시 → 노드 클릭으로 개별 접기/펼치기.
 * "모두 펼치기/모두 접기" 버튼으로 일괄 전환. 확장 상태는 펼쳐진 노드 id 집합(Set)으로 관리한다.
 *
 * 데이터: useBrickOntologyGraph(expanded) [DataLayer: brick-ontology-graph.ts]
 *   반환 rfNodes.data = BrickTreeNodeData(labelKo,brickClass,icon,category,expandable,expanded,childCount).
 * 노드 렌더러: brickNodeTypes            [brick-topology-nodes.tsx]
 * 색/관계 계약: brick-topology-data.ts    (수정 금지)
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ReactFlow, {
  Controls,
  Background,
  BackgroundVariant,
  ReactFlowProvider,
  useReactFlow,
  useNodesState,
  useEdgesState,
  type Node,
} from "reactflow";
import "reactflow/dist/style.css";
import {
  Loader2,
  AlertTriangle,
  RotateCcw,
  Maximize2,
  ListTree,
  ListCollapse,
  MousePointerClick,
} from "lucide-react";
import { type BrickTreeNodeData } from "./brick-topology-data";
import { brickNodeTypes } from "./brick-topology-nodes";
import { BrickLegend, BrickRelationReference } from "./brick-topology-panels";
import { useBrickOntologyGraph } from "./brick-ontology-graph";

/* ── 컨트롤 바 (드릴다운용 간소화) ── */
function ControlBar({
  shown,
  total,
  onExpandAll,
  onCollapseAll,
  onFit,
}: {
  shown: number;
  total: number;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  onFit: () => void;
}) {
  return (
    <div className="absolute left-3 top-3 z-10 flex max-w-[calc(100%-1.5rem)] flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2 shadow-xl backdrop-blur-xl">
      {/* ④ 안내 */}
      <span className="flex items-center gap-1.5 text-[12px] text-slate-400">
        <MousePointerClick size={13} className="text-slate-500" />
        노드 클릭으로 접기/펼치기 · 버튼으로 모두 펼치기/접기
      </span>

      <div className="h-5 w-px bg-white/10" />

      {/* ① 모두 펼치기 */}
      <button
        type="button"
        onClick={onExpandAll}
        title="모두 펼치기 (전체 토폴로지 표시)"
        className="flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[12px] font-medium text-slate-300 transition-colors hover:bg-white/10"
      >
        <ListTree size={13} />
        <span>모두 펼치기</span>
      </button>

      {/* ① 모두 접기 */}
      <button
        type="button"
        onClick={onCollapseAll}
        title="모두 접기 (건물만 표시)"
        className="flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[12px] font-medium text-slate-300 transition-colors hover:bg-white/10"
      >
        <ListCollapse size={13} />
        <span>모두 접기</span>
      </button>

      {/* ② 표시 노드 수 */}
      <span className="text-[12px] text-slate-400 font-mono">
        표시 <span className="font-semibold text-cyan-300">{shown.toLocaleString()}</span>
        {" / "}
        {total.toLocaleString()}
      </span>

      {/* ③ fitView */}
      <button
        type="button"
        onClick={onFit}
        title="화면 맞춤 (fit view)"
        className="flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[12px] font-medium text-slate-300 transition-colors hover:bg-white/10"
      >
        <Maximize2 size={13} />
        <span>맞춤</span>
      </button>
    </div>
  );
}

/* ── 로딩/에러 오버레이 ── */
function StatusOverlay({
  loading,
  error,
  onRetry,
}: {
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  if (!loading && !error) return null;
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm">
      {loading ? (
        <div className="flex items-center gap-2 text-slate-300">
          <Loader2 className="h-5 w-5 animate-spin text-cyan-400" />
          <span className="text-sm font-medium">온톨로지 그래프 불러오는 중…</span>
        </div>
      ) : (
        <div className="flex max-w-sm flex-col items-center gap-3 rounded-xl border border-rose-500/30 bg-slate-900/90 px-6 py-5 text-center shadow-xl backdrop-blur-xl">
          <AlertTriangle className="h-6 w-6 text-rose-400" />
          <div className="text-sm font-medium text-slate-200">그래프를 불러오지 못했습니다</div>
          <div className="text-[12px] text-slate-400">{error}</div>
          <button
            type="button"
            onClick={onRetry}
            className="flex items-center gap-1.5 rounded-md bg-white/10 border border-white/10 px-3 py-1.5 text-[12px] font-medium text-slate-100 transition-colors hover:bg-white/20"
          >
            <RotateCcw size={13} />
            재시도
          </button>
        </div>
      )}
    </div>
  );
}

/* ── 다이어그램 본체 (ReactFlowProvider 내부) ── */
function LiveCanvasInner() {
  // 확장 상태 = 펼쳐진 노드 id 집합.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const { rfNodes, rfEdges, rootIds, allExpandableIds, stats, loading, error } =
    useBrickOntologyGraph(expanded);

  // 초기 진입: 좌→우 드릴다운 트리에서 건물(root)만 펼쳐 **건물 + 층(레벨1-2)만** 표시.
  // 층 카드를 클릭하면 그 층의 하위(공간→설비→센서)가 오른쪽으로 전개된다.
  // rootIds(Building/Site)만 초기 펼침 → 그 직계 자식인 층까지 노출. 최초 1회.
  // 이후엔 사용자의 펼침/접기 조작을 유지한다.
  const initializedRef = useRef(false);
  useEffect(() => {
    if (
      !initializedRef.current &&
      !loading &&
      rootIds &&
      rootIds.length > 0
    ) {
      initializedRef.current = true;
      setExpanded(new Set(rootIds));
    }
  }, [loading, rootIds]);

  const { fitView } = useReactFlow();

  // 드래그 가능하도록 로컬 상태로 관리 후 라이브 데이터 변경 시 동기화
  const [nodes, setNodes, onNodesChange] = useNodesState(rfNodes ?? []);
  const [edges, setEdges, onEdgesChange] = useEdgesState(rfEdges ?? []);

  useEffect(() => {
    setNodes(rfNodes ?? []);
  }, [rfNodes, setNodes]);
  useEffect(() => {
    setEdges(rfEdges ?? []);
  }, [rfEdges, setEdges]);

  // 확장/데이터 변경 시 새 노드가 보이도록 살짝 delay 후 화면 맞춤
  useEffect(() => {
    if (!loading && (rfNodes?.length ?? 0) > 0) {
      const id = window.setTimeout(() => fitView({ padding: 0.2, duration: 300 }), 90);
      return () => window.clearTimeout(id);
    }
  }, [rfNodes, loading, fitView]);

  // 노드 클릭 → 확장 토글 (expandable 노드만)
  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node<BrickTreeNodeData>) => {
      if (!node.data?.expandable) return;
      setExpanded((prev) => {
        const next = new Set(prev);
        if (next.has(node.id)) next.delete(node.id);
        else next.add(node.id);
        return next;
      });
    },
    [],
  );

  const handleFit = useCallback(
    () => fitView({ padding: 0.2, duration: 300 }),
    [fitView],
  );
  const handleCollapseAll = useCallback(() => setExpanded(new Set()), []);
  const handleExpandAll = useCallback(
    () => setExpanded(new Set(allExpandableIds ?? [])),
    [allExpandableIds],
  );
  const handleRetry = useCallback(
    () => setExpanded((prev) => new Set(prev)), // 참조 변경으로 훅 재실행 유도
    [],
  );

  const shown = stats?.shown ?? nodes.length;
  const total = stats?.total ?? 0;

  return (
    <div className="relative h-full w-full">
      <ControlBar
        shown={shown}
        total={total}
        onExpandAll={handleExpandAll}
        onCollapseAll={handleCollapseAll}
        onFit={handleFit}
      />
      <StatusOverlay loading={loading} error={error ?? null} onRetry={handleRetry} />
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        nodeTypes={brickNodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={1.8}
        nodesConnectable={false}
        elementsSelectable
        proOptions={{ hideAttribution: true }}
        className="brick-dark-canvas"
        style={{
          background:
            "radial-gradient(ellipse at 50% 0%, #0f1e33 0%, #0a1220 55%, #060a14 100%)",
        }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={28}
          size={1}
          color="rgba(56,189,248,0.06)"
        />
        <Controls
          showInteractive={false}
          className="[&>button]:!bg-transparent [&>button]:!border-white/10 [&>button]:!fill-slate-200 [&>button:hover]:!bg-white/10"
          style={{
            background: "rgba(15,23,42,0.90)",
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.10)",
            boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
          }}
        />
      </ReactFlow>
    </div>
  );
}

/* ── Export: 라이브 드릴다운 캔버스 (다이어그램 + 범례 + 관계설명) ── */
export function BrickTopologyLiveCanvas() {
  return (
    <div className="p-3 md:p-6 space-y-4">
      {/* 다이어그램(flex-1) + 범례(우측 고정 컬럼) */}
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="relative flex-1 min-w-0 rounded-xl border border-white/10 bg-slate-950 overflow-hidden h-[520px] lg:h-[70vh]">
          <ReactFlowProvider>
            <LiveCanvasInner />
          </ReactFlowProvider>
        </div>
        <div className="w-full lg:w-[248px] lg:shrink-0">
          <BrickLegend />
        </div>
      </div>

      {/* 관계 설명 */}
      <BrickRelationReference />
    </div>
  );
}

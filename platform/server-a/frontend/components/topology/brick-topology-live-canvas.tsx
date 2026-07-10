/**
 * Brick Schema 라이브 토폴로지 — 점진적 드릴다운(트리) 캔버스
 *
 * 처음엔 건물만 → 노드 클릭 시 직계 자식 전개(건물→층→존/설비→포인트).
 * 다시 클릭하면 접힘. 확장 상태는 펼쳐진 노드 id 집합(Set)으로 관리한다.
 *
 * 데이터: useBrickOntologyGraph(expanded) [DataLayer: brick-ontology-graph.ts]
 *   반환 rfNodes.data = BrickTreeNodeData(labelKo,brickClass,icon,category,expandable,expanded,childCount).
 * 노드 렌더러: brickNodeTypes            [brick-topology-nodes.tsx]
 * 색/관계 계약: brick-topology-data.ts    (수정 금지)
 */

"use client";

import { useCallback, useEffect, useState } from "react";
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
  onCollapseAll,
  onFit,
}: {
  shown: number;
  total: number;
  onCollapseAll: () => void;
  onFit: () => void;
}) {
  return (
    <div className="absolute left-3 top-3 z-10 flex max-w-[calc(100%-1.5rem)] flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white/95 px-3 py-2 shadow-sm backdrop-blur">
      {/* ④ 안내 */}
      <span className="flex items-center gap-1.5 text-[12px] text-slate-500">
        <MousePointerClick size={13} className="text-slate-400" />
        노드를 클릭해 하위를 펼치세요
      </span>

      <div className="h-5 w-px bg-slate-200" />

      {/* ① 모두 접기 */}
      <button
        type="button"
        onClick={onCollapseAll}
        title="모두 접기 (건물만 표시)"
        className="flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-[12px] font-medium text-slate-600 transition-colors hover:bg-slate-50"
      >
        <ListCollapse size={13} />
        <span>모두 접기</span>
      </button>

      {/* ② 표시 노드 수 */}
      <span className="text-[12px] text-slate-500">
        표시 <span className="font-semibold text-slate-700">{shown.toLocaleString()}</span>
        {" / "}
        {total.toLocaleString()}
      </span>

      {/* ③ fitView */}
      <button
        type="button"
        onClick={onFit}
        title="화면 맞춤 (fit view)"
        className="flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-[12px] font-medium text-slate-600 transition-colors hover:bg-slate-50"
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
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/70 backdrop-blur-sm">
      {loading ? (
        <div className="flex items-center gap-2 text-slate-600">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm font-medium">온톨로지 그래프 불러오는 중…</span>
        </div>
      ) : (
        <div className="flex max-w-sm flex-col items-center gap-3 rounded-xl border border-rose-200 bg-white px-6 py-5 text-center shadow-sm">
          <AlertTriangle className="h-6 w-6 text-rose-500" />
          <div className="text-sm font-medium text-slate-700">그래프를 불러오지 못했습니다</div>
          <div className="text-[12px] text-slate-500">{error}</div>
          <button
            type="button"
            onClick={onRetry}
            className="flex items-center gap-1.5 rounded-md bg-slate-800 px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-slate-700"
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
  // 확장 상태 = 펼쳐진 노드 id 집합. 빈 집합 = 루트(건물)만.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const { rfNodes, rfEdges, stats, loading, error } = useBrickOntologyGraph(expanded);

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
        style={{ background: "#F8FAFC" }}
      >
        <Background variant={BackgroundVariant.Dots} gap={28} size={1} color="#CBD5E1" />
        <Controls
          showInteractive={false}
          style={{
            background: "#FFFFFF",
            borderRadius: 8,
            border: "1px solid #E2E8F0",
            boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
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
        <div className="relative flex-1 min-w-0 rounded-xl border border-slate-200 bg-[#F8FAFC] overflow-hidden h-[520px] lg:h-[70vh]">
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

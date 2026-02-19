/**
 * Cross-Section Topology — React Flow Canvas
 * Building cross-section view with real-time SSE data
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import ReactFlow, {
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
  type ReactFlowInstance,
} from "reactflow";
import "reactflow/dist/style.css";

import { Loader2, AlertCircle } from "lucide-react";
import { getTopologyTree, getTopologyConnections } from "@/lib/api";
import type { SSEPointEvent, SSEDeviceEvent } from "@/lib/sse";
import { csNodeTypes } from "./cs-nodes";
import type { CompactEquipData, FloorBandData } from "./cs-nodes";
import { buildCrossSectionLayout } from "./cs-layout";
import {
  SYSTEM_COLORS,
  type SystemKey,
  countSensors,
  computeOperationPct,
} from "./cs-utils";

/* ── System legend ── */
const SYSTEM_LEGEND: { key: SystemKey; label: string; color: string }[] = [
  { key: "chw", label: "CHW", color: SYSTEM_COLORS.chw.css },
  { key: "hw", label: "HW", color: SYSTEM_COLORS.hw.css },
  { key: "cw", label: "CW", color: SYSTEM_COLORS.cw.css },
  { key: "elec", label: "ELEC", color: SYSTEM_COLORS.elec.css },
  { key: "air", label: "AIR", color: SYSTEM_COLORS.air.css },
];

/* ── Props ── */
interface CsCanvasProps {
  points: Record<string, SSEPointEvent>;
  devices: Record<string, SSEDeviceEvent>;
  deviceStatusMap: Record<string, boolean>;
  connected: boolean;
}

function CsCanvasInner({
  points,
  devices,
  deviceStatusMap,
  connected,
}: CsCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const layoutRef = useRef(false);
  const rfInstance = useRef<ReactFlowInstance | null>(null);

  /* ── Totals for stats overlay ── */
  const [stats, setStats] = useState({ floors: 0, equip: 0, edges: 0 });

  /* ── Build initial layout ── */
  useEffect(() => {
    if (layoutRef.current) return;

    (async () => {
      try {
        const [treeRes, connRes] = await Promise.all([
          getTopologyTree(),
          getTopologyConnections(),
        ]);
        const { nodes: n, edges: e } = buildCrossSectionLayout(
          treeRes.tree,
          connRes.connections,
          deviceStatusMap,
          points
        );
        setNodes(n);
        setEdges(e);
        layoutRef.current = true;

        setStats({
          floors: n.filter((nd) => nd.type === "floorBand").length,
          equip: n.filter((nd) => nd.type === "compactEquipCard").length,
          edges: e.length,
        });

        /* Center horizontally, start at top with comfortable zoom */
        setTimeout(() => {
          rfInstance.current?.setViewport({ x: 20, y: 20, zoom: 0.7 });
        }, 250);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load topology"
        );
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Live SSE update: equipment cards ── */
  useEffect(() => {
    if (!layoutRef.current) return;

    setNodes((prev) =>
      prev.map((node) => {
        if (node.type === "compactEquipCard") {
          const d = node.data as CompactEquipData;
          const isActive =
            deviceStatusMap[d.name] || deviceStatusMap[d.name.replace("bldg:", "")] || false;
          const isSimulated =
            d.name in deviceStatusMap || d.name.replace("bldg:", "") in deviceStatusMap;
          const sensorCnt = countSensors(d.name, points);
          const opPct = computeOperationPct(d.name, points, isActive);

          return {
            ...node,
            data: {
              ...d,
              isActive,
              isSimulated,
              operationPct: opPct,
              sensorCount: sensorCnt,
            },
          };
        }

        if (node.type === "floorBand") {
          const d = node.data as FloorBandData;
          // Recalculate active count for this floor
          let activeCount = 0;
          let totalSensors = 0;
          for (const n of prev) {
            if (
              n.type === "compactEquipCard" &&
              n.parentNode === node.id
            ) {
              const ed = n.data as CompactEquipData;
              if (deviceStatusMap[ed.name] || deviceStatusMap[ed.name.replace("bldg:", "")]) {
                activeCount++;
              }
              totalSensors += countSensors(ed.name, points);
            }
          }
          return {
            ...node,
            data: { ...d, activeCount, sensorCount: totalSensors },
          };
        }

        return node;
      })
    );
  }, [points, deviceStatusMap, setNodes]);

  /* ── React Flow init ── */
  const onInit = useCallback((instance: ReactFlowInstance) => {
    rfInstance.current = instance;
  }, []);

  /* ── Loading / Error ── */
  if (loading) {
    return (
      <div
        className="flex items-center justify-center bg-slate-950"
        style={{ height: "calc(100vh - 80px)" }}
      >
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-cyan-400 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">
            건물 단면도 토폴로지 로딩 중...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="flex items-center justify-center bg-slate-950"
        style={{ height: "calc(100vh - 80px)" }}
      >
        <div className="text-center">
          <AlertCircle className="h-8 w-8 text-rose-400 mx-auto mb-3" />
          <p className="text-rose-400 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative"
      style={{ width: "100%", height: "calc(100vh - 80px)" }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onInit={onInit}
        nodeTypes={csNodeTypes}
        defaultViewport={{ x: 20, y: 20, zoom: 0.7 }}
        minZoom={0.05}
        maxZoom={1.2}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        className="cs-canvas"
        style={{ width: "100%", height: "100%" }}
      >
        <Controls
          position="bottom-right"
          showInteractive={false}
          className="!bg-slate-900/90 !border-white/10 !rounded-lg !shadow-xl [&>button]:!bg-transparent [&>button]:!border-white/10 [&>button]:!fill-white [&>button:hover]:!bg-white/10"
        />
        <MiniMap
          position="bottom-left"
          nodeColor={(n) => {
            if (n.type === "floorBand") {
              const d = n.data as FloorBandData | undefined;
              if (!d) return "rgba(148,163,184,0.15)";
              const ratio =
                d.equipCount > 0 ? d.activeCount / d.equipCount : 0;
              return ratio > 0.5
                ? "rgba(52,211,153,0.25)"
                : "rgba(251,113,133,0.15)";
            }
            if (n.type === "compactEquipCard") {
              const d = n.data as CompactEquipData | undefined;
              return d?.isActive
                ? "rgba(52,211,153,0.5)"
                : "rgba(251,113,133,0.3)";
            }
            return "rgba(148,163,184,0.1)";
          }}
          maskColor="rgba(2,6,23,0.85)"
          className="!bg-slate-950/95 !border-white/10 !rounded-lg"
          pannable
          zoomable
        />
        <Background
          variant={BackgroundVariant.Dots}
          gap={40}
          size={1}
          color="rgba(34,211,238,0.04)"
        />
      </ReactFlow>

      {/* ── System Legend ── */}
      <div className="absolute top-3 left-3 flex items-center gap-3 px-3 py-2 bg-slate-950/80 backdrop-blur-xl border border-white/10 rounded-lg z-10">
        <span className="text-[9px] text-slate-500 uppercase tracking-wider">
          Systems
        </span>
        {SYSTEM_LEGEND.map((s) => (
          <div key={s.key} className="flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-full"
              style={{
                backgroundColor: s.color,
                boxShadow: `0 0 4px ${s.color}40`,
              }}
            />
            <span className="text-[9px] text-slate-400 font-mono">
              {s.label}
            </span>
          </div>
        ))}
      </div>

      {/* ── Connection Status ── */}
      <div className="absolute top-3 right-14 flex items-center gap-1.5 px-2 py-1 bg-slate-950/80 backdrop-blur-xl border border-white/10 rounded-md z-10">
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            connected
              ? "bg-emerald-400 shadow-[0_0_4px_rgba(52,211,153,0.6)]"
              : "bg-rose-400"
          }`}
        />
        <span className="text-[9px] text-slate-400">
          {connected ? "LIVE" : "OFFLINE"}
        </span>
      </div>

      {/* ── Stats Overlay ── */}
      <div className="absolute top-3 right-[7.5rem] flex items-center gap-2 px-3 py-1.5 bg-slate-950/80 backdrop-blur-xl border border-white/10 rounded-md z-10 text-[9px] text-slate-400 font-mono">
        <span>F:{stats.floors}</span>
        <span>E:{stats.equip}</span>
        <span>C:{stats.edges}</span>
      </div>
    </div>
  );
}

/* ── Wrapper ── */
export function CsCanvas(props: CsCanvasProps) {
  return (
    <ReactFlowProvider>
      <CsCanvasInner {...props} />
    </ReactFlowProvider>
  );
}

/**
 * Topology Flow Diagram — React Flow Canvas
 * Interactive building energy flow visualization with real-time SSE data
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
import {
  getTopologyTree,
  getTopologyConnections,
} from "@/lib/api";
import type { SSEPointEvent, SSEDeviceEvent } from "@/lib/sse";
import { nodeTypes } from "./custom-nodes";
import {
  buildFlowLayout,
  getEquipSensors,
  computeOperationPct,
  type EquipNodeData,
} from "./flow-layout";

/* ── System color legend ── */
const SYSTEMS = [
  { id: "chw", label: "CHW", color: "rgb(34,211,238)" },
  { id: "hw", label: "HW", color: "rgb(251,113,133)" },
  { id: "cw", label: "CW", color: "rgb(129,140,248)" },
  { id: "elec", label: "ELEC", color: "rgb(251,191,36)" },
];

interface FlowCanvasProps {
  points: Record<string, SSEPointEvent>;
  devices: Record<string, SSEDeviceEvent>;
  deviceStatusMap: Record<string, boolean>;
  connected: boolean;
}

function FlowCanvasInner({
  points,
  devices,
  deviceStatusMap,
  connected,
}: FlowCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const layoutRef = useRef(false);
  const rfInstance = useRef<ReactFlowInstance | null>(null);

  /* ── Build initial layout from API data ── */
  useEffect(() => {
    if (layoutRef.current) return;

    (async () => {
      try {
        const [treeRes, connRes] = await Promise.all([
          getTopologyTree(),
          getTopologyConnections(),
        ]);
        const { nodes: n, edges: e } = buildFlowLayout(
          treeRes.tree,
          connRes.connections,
          deviceStatusMap,
          points
        );
        setNodes(n);
        setEdges(e);
        layoutRef.current = true;

        /* fitView after React Flow measures the new nodes */
        setTimeout(() => {
          rfInstance.current?.fitView({ padding: 0.15, maxZoom: 1.0 });
        }, 200);
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

  /* ── Live-update equipment data when SSE changes ── */
  useEffect(() => {
    if (!layoutRef.current) return;

    setNodes((prev) =>
      prev.map((node) => {
        if (node.type !== "equipmentCard") return node;
        const d = node.data as EquipNodeData;
        const isSimulated =
          d.name in deviceStatusMap || d.name.replace("bldg:", "") in deviceStatusMap;
        const isActive = isSimulated
          ? deviceStatusMap[d.name] ||
            deviceStatusMap[d.name.replace("bldg:", "")] ||
            false
          : false;
        const sensorValues = getEquipSensors(d.name, points);
        const operationPct = computeOperationPct(d.name, points, isActive);
        return {
          ...node,
          data: { ...d, isActive, isSimulated, sensorValues, operationPct },
        };
      })
    );
  }, [points, deviceStatusMap, setNodes]);

  /* ── Navigate to equipment detail on node click ── */
  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: { id: string; type?: string; data?: Record<string, unknown> }) => {
      if (node.type === "equipmentCard" && node.data) {
        const name = (node.data as unknown as EquipNodeData).name;
        const monId = `bldg:${name}`;
        window.open(`/monitoring/${encodeURIComponent(monId)}`, "_blank");
      }
    },
    []
  );

  /* ── Store React Flow instance ── */
  const onInit = useCallback((instance: ReactFlowInstance) => {
    rfInstance.current = instance;
  }, []);

  /* ── Loading / Error states ── */
  if (loading) {
    return (
      <div className="flex items-center justify-center bg-slate-950" style={{ height: "calc(100vh - 80px)" }}>
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-cyan-400 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">
            Building topology flow diagram...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center bg-slate-950" style={{ height: "calc(100vh - 80px)" }}>
        <div className="text-center">
          <AlertCircle className="h-8 w-8 text-rose-400 mx-auto mb-3" />
          <p className="text-rose-400 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative" style={{ width: "100%", height: "calc(100vh - 80px)" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onInit={onInit}
        nodeTypes={nodeTypes}
        defaultViewport={{ x: 20, y: 20, zoom: 0.7 }}
        minZoom={0.02}
        maxZoom={1.5}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        className="topology-flow-canvas"
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
            if (n.type === "equipmentCard") {
              const d = n.data as EquipNodeData | undefined;
              return d?.isActive
                ? "rgba(52,211,153,0.6)"
                : "rgba(251,113,133,0.4)";
            }
            return "rgba(148,163,184,0.2)";
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
          color="rgba(34,211,238,0.05)"
        />
      </ReactFlow>

      {/* System legend overlay */}
      <div className="absolute top-3 left-3 flex items-center gap-3 px-3 py-2 bg-slate-950/80 backdrop-blur-xl border border-white/10 rounded-lg z-10">
        <span className="text-[9px] text-slate-500 uppercase tracking-wider">
          Systems
        </span>
        {SYSTEMS.map((s) => (
          <div key={s.id} className="flex items-center gap-1.5">
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

      {/* Connection status */}
      <div className="absolute top-3 right-14 flex items-center gap-1.5 px-2 py-1 bg-slate-950/80 backdrop-blur-xl border border-white/10 rounded-md z-10">
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            connected ? "bg-emerald-400 shadow-[0_0_4px_rgba(52,211,153,0.6)]" : "bg-rose-400"
          }`}
        />
        <span className="text-[9px] text-slate-400">
          {connected ? "LIVE" : "OFFLINE"}
        </span>
      </div>

      {/* Stats overlay */}
      <div className="absolute top-3 right-[7.5rem] flex items-center gap-2 px-3 py-1.5 bg-slate-950/80 backdrop-blur-xl border border-white/10 rounded-md z-10 text-[9px] text-slate-400 font-mono">
        <span>N:{nodes.length}</span>
        <span>E:{edges.length}</span>
      </div>
    </div>
  );
}

/* ── Wrapper with ReactFlowProvider ── */
export function FlowCanvas(props: FlowCanvasProps) {
  return (
    <ReactFlowProvider>
      <FlowCanvasInner {...props} />
    </ReactFlowProvider>
  );
}

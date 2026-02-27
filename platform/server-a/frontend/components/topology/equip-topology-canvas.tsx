/**
 * Equipment Topology — React Flow Canvas (v3: Global DAG)
 * Hierarchical flow diagram with fault impact analysis
 */

"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import ReactFlow, {
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
  type Node,
  type ReactFlowInstance,
} from "reactflow";
import "reactflow/dist/style.css";
import { useTranslations } from "next-intl";
import { ArrowRight, Wifi, WifiOff, Loader2, X } from "lucide-react";
import type { SSEPointEvent, SSEDeviceEvent, SSEAlarmEvent } from "@/lib/sse";
import { getFaultImpact, type FaultImpactResponse } from "@/lib/api";
import {
  SYSTEM_COLORS,
  type SystemKey,
  countSensors,
  computeOperationPct,
} from "./cs-utils";
import { equipFlowNodeTypes, type HighlightState, type AlarmSeverity } from "./equip-topology-nodes";
import {
  fetchFlowTopologyElements,
  type FlowTopologyResult,
} from "./equip-topology-data";
import { EquipTopologyControls } from "./equip-topology-controls";

/* ── Props ── */

interface EquipTopologyCanvasProps {
  points: Record<string, SSEPointEvent>;
  devices: Record<string, SSEDeviceEvent>;
  deviceStatusMap: Record<string, boolean>;
  connected: boolean;
  alarms?: SSEAlarmEvent[];
}

/* ── Inner component ── */

function EquipTopologyCanvasInner({
  points,
  devices,
  deviceStatusMap,
  connected,
  alarms = [],
}: EquipTopologyCanvasProps) {
  const t = useTranslations("topology");

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);
  const [activeSystems, setActiveSystems] = useState<SystemKey[]>([
    "chw", "hw", "cw", "elec", "air",
  ]);
  const [searchQuery, setSearchQuery] = useState("");
  const [nodeCount, setNodeCount] = useState(0);
  const [edgeCount, setEdgeCount] = useState(0);
  const [levelCount, setLevelCount] = useState(0);
  const [showZones, setShowZones] = useState(false);
  const [zoneCount, setZoneCount] = useState(0);

  // Impact mode state
  const [impactMode, setImpactMode] = useState(false);
  const [selectedEquip, setSelectedEquip] = useState<string | null>(null);
  const [impactData, setImpactData] = useState<FaultImpactResponse | null>(null);
  const [impactLoading, setImpactLoading] = useState(false);

  const rfRef = useRef<ReactFlowInstance | null>(null);
  const initRef = useRef(false);

  /* ── Initial data load ── */
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    (async () => {
      try {
        setLoading(true);
        const result = await fetchFlowTopologyElements(deviceStatusMap, points);
        setNodes(result.nodes);
        setEdges(result.edges);
        setNodeCount(result.nodes.filter((n) => n.type === "flowEquipCard").length);
        setEdgeCount(result.edges.length);
        setLevelCount(result.levelCount ?? 0);
        setZoneCount(result.zoneCount ?? 0);
        setTimeout(
          () => rfRef.current?.fitView({ padding: 0.1, maxZoom: 1.0 }),
          300,
        );
      } catch (e) {
        console.error("Failed to load equipment flow topology:", e);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── SSE live update: equipment cards (no more systemGroup) ── */
  useEffect(() => {
    if (!initRef.current || loading) return;

    setNodes((prev) =>
      prev.map((node) => {
        if (node.type !== "flowEquipCard") return node;

        const d = node.data;
        const name = d.name;
        const isActive =
          deviceStatusMap[name] ?? deviceStatusMap[`bldg:${name}`] ?? true;
        const sensorCount = countSensors(name, points);
        const operationPct = computeOperationPct(name, points, isActive);
        const statusLabel: "NORMAL" | "WARNING" | "STOP" = !isActive
          ? "STOP"
          : operationPct > 50
          ? "NORMAL"
          : "WARNING";

        // Alarm severity from SSE
        let alarmSeverity: AlarmSeverity = null;
        for (const alarm of alarms) {
          const alarmEquip = alarm.equipment?.replace("bldg:", "") ?? "";
          if (alarmEquip === name) {
            const sev = alarm.severity?.toLowerCase();
            if (sev === "critical") { alarmSeverity = "critical"; break; }
            if (sev === "warning") { alarmSeverity = "warning"; }
            if (sev === "info" && !alarmSeverity) { alarmSeverity = "info"; }
          }
        }

        if (
          d.isActive === isActive &&
          d.sensorCount === sensorCount &&
          d.operationPct === operationPct &&
          d.alarmSeverity === alarmSeverity
        )
          return node;

        return {
          ...node,
          data: { ...d, isActive, sensorCount, operationPct, statusLabel, alarmSeverity },
        };
      }),
    );
  }, [points, deviceStatusMap, alarms, loading, setNodes]);

  /* ── Impact mode: apply highlight ── */
  const applyImpactHighlight = useCallback(
    (equipName: string, impact: FaultImpactResponse) => {
      const affectedMap = new Map<string, HighlightState>();
      affectedMap.set(equipName, "fault-source");
      for (const eq of impact.affected_equipment) {
        affectedMap.set(eq.name, eq.impact_level as HighlightState);
      }
      for (const z of impact.affected_zones) {
        affectedMap.set(z.name, "zone-affected");
      }

      setNodes((prev) =>
        prev.map((node) => {
          if (node.type !== "flowEquipCard") return node;
          const hs = affectedMap.get(node.data.name) ?? "dimmed";
          if (node.data.highlightState === hs) return node;
          return { ...node, data: { ...node.data, highlightState: hs } };
        }),
      );

      // Dim unrelated edges, keep affected ones bright
      const affectedNames = new Set(affectedMap.keys());
      setEdges((prev) =>
        prev.map((edge) => {
          const srcAffected = affectedNames.has(edge.source);
          const tgtAffected = affectedNames.has(edge.target.replace("zone-", ""));
          const isRelated = srcAffected && tgtAffected;
          return {
            ...edge,
            style: {
              ...edge.style,
              strokeOpacity: isRelated ? 1 : 0.08,
            },
          };
        }),
      );
    },
    [setNodes, setEdges],
  );

  const clearImpactHighlight = useCallback(() => {
    setSelectedEquip(null);
    setImpactData(null);
    setNodes((prev) =>
      prev.map((node) => {
        if (node.type !== "flowEquipCard") return node;
        if (node.data.highlightState === "none") return node;
        return { ...node, data: { ...node.data, highlightState: "none" } };
      }),
    );
    setEdges((prev) =>
      prev.map((edge) => {
        const origOpacity = edge.className?.includes("inter-system") ? 0.9 : 0.6;
        if ((edge.data as any)?.isZoneEdge) return edge;
        return {
          ...edge,
          style: { ...edge.style, strokeOpacity: origOpacity },
        };
      }),
    );
  }, [setNodes, setEdges]);

  /* ── Node click handler ── */
  const handleNodeClick = useCallback(
    async (_: React.MouseEvent, node: Node) => {
      if (!impactMode || node.type !== "flowEquipCard") return;

      const equipName = node.data.name;
      if (selectedEquip === equipName) {
        clearImpactHighlight();
        return;
      }

      setImpactLoading(true);
      setSelectedEquip(equipName);
      try {
        const impact = await getFaultImpact(equipName);
        setImpactData(impact);
        applyImpactHighlight(equipName, impact);
      } catch (e) {
        console.error("Fault impact fetch failed:", e);
      } finally {
        setImpactLoading(false);
      }
    },
    [impactMode, selectedEquip, applyImpactHighlight, clearImpactHighlight],
  );

  /* ── Impact mode toggle ── */
  const handleImpactToggle = useCallback(() => {
    setImpactMode((prev) => {
      if (prev) {
        clearImpactHighlight();
      }
      return !prev;
    });
  }, [clearImpactHighlight]);

  /* ── Pane click: clear impact ── */
  const handlePaneClick = useCallback(() => {
    if (impactMode && selectedEquip) {
      clearImpactHighlight();
    }
  }, [impactMode, selectedEquip, clearImpactHighlight]);

  /* ── System filter ── */
  const handleSystemFilter = useCallback(
    (systems: SystemKey[]) => {
      setActiveSystems(systems);
      setNodes((prev) =>
        prev.map((node) => {
          const sys = node.data?.systemKey;
          if (!sys) return node;
          const visible = systems.includes(sys);
          return { ...node, hidden: !visible };
        }),
      );
      setEdges((prev) => {
        let visibleEdges = 0;
        const updated = prev.map((edge) => {
          const sys = (edge.data as any)?.systemKey;
          const visible = !sys || systems.includes(sys);
          if (visible) visibleEdges++;
          return { ...edge, hidden: !visible };
        });
        setEdgeCount(visibleEdges);
        return updated;
      });
    },
    [setNodes, setEdges],
  );

  /* ── Search ── */
  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query);
      if (!query.trim() || !rfRef.current) return;

      const matching = nodes.filter(
        (n) =>
          n.type === "flowEquipCard" &&
          ((n.data.displayName || "").toLowerCase().includes(query.toLowerCase()) ||
            (n.data.name || "").toLowerCase().includes(query.toLowerCase())),
      );
      if (matching.length > 0) {
        rfRef.current.fitView({
          nodes: matching,
          padding: 0.3,
          maxZoom: 1.2,
          duration: 400,
        });
      }
    },
    [nodes],
  );

  /* ── Zone toggle ── */
  const handleToggleZones = useCallback(() => {
    setShowZones((prev) => {
      const next = !prev;
      setNodes((nodes) =>
        nodes.map((n) =>
          n.type === "zoneNode" ? { ...n, hidden: !next } : n,
        ),
      );
      setEdges((edges) =>
        edges.map((e) =>
          (e.data as any)?.isZoneEdge ? { ...e, hidden: !next } : e,
        ),
      );
      return next;
    });
  }, [setNodes, setEdges]);

  return (
    <>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={equipFlowNodeTypes}
        onInit={(inst) => { rfRef.current = inst; }}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        defaultViewport={{ x: 20, y: 20, zoom: 0.4 }}
        minZoom={0.05}
        maxZoom={1.5}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={true}
        proOptions={{ hideAttribution: true }}
        className="equip-flow-canvas"
        fitView
        fitViewOptions={{ padding: 0.1, maxZoom: 1.0 }}
      >
        <Controls position="bottom-right" showInteractive={false}
          style={{ background: "rgba(15,23,42,0.8)", borderColor: "rgba(255,255,255,0.1)", borderRadius: 8 }} />
        <MiniMap
          nodeColor={(n) => {
            if (n.type === "levelLabel") return "rgba(34,211,238,0.3)";
            if (n.type === "flowEquipCard") return n.data?.systemColor || "rgba(34,211,238,0.3)";
            return "#334155";
          }}
          style={{ background: "rgba(15,23,42,0.9)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)" }}
        />
        <Background variant={BackgroundVariant.Dots} gap={40} size={1} color="rgba(34,211,238,0.04)" />
      </ReactFlow>

      {/* ── Controls panel ── */}
      <div className="absolute top-3 left-3 right-3 z-10">
        <EquipTopologyControls
          activeSystems={activeSystems}
          onSystemFilter={handleSystemFilter}
          searchQuery={searchQuery}
          onSearchChange={handleSearch}
          nodeCount={nodeCount}
          edgeCount={edgeCount}
          levelCount={levelCount}
          showZones={showZones}
          onToggleZones={handleToggleZones}
          zoneCount={zoneCount}
          impactMode={impactMode}
          onImpactToggle={handleImpactToggle}
          impactLoading={impactLoading}
        />
      </div>

      {/* ── Flow direction indicator ── */}
      <div className="absolute top-16 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/60 backdrop-blur border border-slate-700/30 text-[10px] text-slate-400">
        <span>{t("topoFlowDirection")}</span>
        <ArrowRight className="h-3 w-3 flow-direction-arrow text-cyan-400" />
      </div>

      {/* ── Impact stats panel ── */}
      {impactMode && impactData && selectedEquip && (
        <div className="absolute bottom-16 right-3 z-10 w-64 rounded-lg border border-red-500/30 bg-slate-950/90 backdrop-blur-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-red-400">{t("topoImpactTitle")}</span>
            <button onClick={clearImpactHighlight}
              className="p-0.5 rounded hover:bg-slate-700/50 text-slate-400 hover:text-white">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="text-[11px] text-slate-300 mb-2 font-mono truncate">
            {selectedEquip}
          </div>
          <div className="grid grid-cols-2 gap-1.5 text-[10px]">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-orange-500" />
              <span className="text-slate-400">{t("topoImpactDirect")}</span>
              <span className="text-orange-400 font-bold ml-auto">{impactData.stats.direct}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
              <span className="text-slate-400">{t("topoImpactIndirect")}</span>
              <span className="text-yellow-400 font-bold ml-auto">{impactData.stats.indirect}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50" />
              <span className="text-slate-400">{t("topoImpactExtended")}</span>
              <span className="text-yellow-300 font-bold ml-auto">{impactData.stats.extended}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-purple-500" />
              <span className="text-slate-400">{t("topoImpactZone")}</span>
              <span className="text-purple-400 font-bold ml-auto">{impactData.affected_zones.length}</span>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-700/50 text-[10px] text-slate-500">
            {t("topoImpactTotal", { count: impactData.stats.total })}
          </div>
        </div>
      )}

      {/* ── Connection status ── */}
      <div className="absolute bottom-3 left-3 z-10 flex items-center gap-1.5 px-2 py-1 bg-slate-950/80 backdrop-blur-xl border border-white/10 rounded-md">
        {connected ? (
          <Wifi className="h-3 w-3 text-emerald-400" />
        ) : (
          <WifiOff className="h-3 w-3 text-rose-400" />
        )}
        <span className="text-[9px] text-slate-400">
          {connected ? "LIVE" : "OFFLINE"}
        </span>
      </div>

      {/* ── Loading overlay ── */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 z-20">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
            <p className="text-cyan-400 animate-pulse text-sm">{t("topoLoading")}</p>
          </div>
        </div>
      )}

      {/* ── Impact loading overlay ── */}
      {impactLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/40 z-15">
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900/90 border border-red-500/30">
            <Loader2 className="h-4 w-4 animate-spin text-red-400" />
            <span className="text-sm text-red-300">{t("topoImpactLoading")}</span>
          </div>
        </div>
      )}
    </>
  );
}

/* ── Wrapper with ReactFlowProvider ── */

export function EquipTopologyCanvas(props: EquipTopologyCanvasProps) {
  return (
    <div className="px-3 md:px-6 py-4">
      <div
        className="relative w-full rounded-lg border border-slate-700/50 bg-slate-900/50 overflow-hidden"
        style={{ height: "calc(100vh - 200px)" }}
      >
        <ReactFlowProvider>
          <EquipTopologyCanvasInner {...props} />
        </ReactFlowProvider>
      </div>
    </div>
  );
}

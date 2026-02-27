/**
 * Equipment Flow Topology — Custom React Flow Nodes
 * SystemGroupNode (legacy), FlowEquipCard (with highlight + alarm), LevelLabelNode, ZoneNode
 */

"use client";

import { memo, useCallback } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import { type SystemKey } from "./cs-utils";

/* ─────────────────────────────────────────────────
 * Types
 * ───────────────────────────────────────────────── */

export type HighlightState =
  | "none"
  | "fault-source"
  | "direct"
  | "indirect"
  | "extended"
  | "zone-affected"
  | "dimmed";

export type AlarmSeverity = "critical" | "warning" | "info" | null;

/* ─────────────────────────────────────────────────
 * 0. LevelLabelNode — Column header for DAG level
 * ───────────────────────────────────────────────── */

export interface LevelLabelData {
  level: number;
  label: string;
  count: number;
}

const LevelLabelNode = memo(function LevelLabelNode({
  data,
}: NodeProps<LevelLabelData>) {
  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 rounded-md select-none"
      style={{
        background: "rgba(15,23,42,0.6)",
        border: "1px solid rgba(255,255,255,0.06)",
        backdropFilter: "blur(8px)",
      }}
    >
      <span className="text-[11px] font-bold text-cyan-400/80 uppercase tracking-wider">
        {data.label}
      </span>
      <span className="text-[10px] text-slate-500 font-mono">
        ({data.count})
      </span>
    </div>
  );
});

/* ─────────────────────────────────────────────────
 * 1. SystemGroupNode — Legacy (kept for backward compatibility)
 * ───────────────────────────────────────────────── */

export interface SystemGroupData {
  systemKey: SystemKey;
  systemLabel: string;
  systemSubtitle: string;
  equipCount: number;
  activeCount: number;
  avgOperationPct: number;
  groupWidth: number;
  groupHeight: number;
  accentColor: string;
}

const SystemGroupNode = memo(function SystemGroupNode({
  data,
}: NodeProps<SystemGroupData>) {
  const opPct = data.avgOperationPct;
  const barColor =
    opPct > 80
      ? "linear-gradient(90deg, rgb(52,211,153), rgb(34,211,238))"
      : opPct > 50
      ? "linear-gradient(90deg, rgb(251,191,36), rgb(245,158,11))"
      : "linear-gradient(90deg, rgb(251,113,133), rgb(239,68,68))";

  return (
    <div
      className="relative rounded-xl overflow-hidden"
      style={{
        width: data.groupWidth,
        height: data.groupHeight,
        background: "rgba(15,23,42,0.70)",
        backdropFilter: "blur(24px)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <Handle type="target" position={Position.Left}
        className="!w-3 !h-3 !border-2 !border-slate-700 !-left-2"
        style={{ background: data.accentColor, top: "50%" }} />
      <Handle type="source" position={Position.Right}
        className="!w-3 !h-3 !border-2 !border-slate-700 !-right-2"
        style={{ background: data.accentColor, top: "50%" }} />
      <div className="absolute left-0 top-0 bottom-0 w-[5px] rounded-l-xl"
        style={{ background: data.accentColor }} />
      <div className="absolute left-5 top-4 select-none" style={{ maxWidth: 200 }}>
        <div className="text-[20px] font-bold leading-tight" style={{ color: data.accentColor }}>
          {data.systemLabel}
        </div>
        <div className="text-[11px] text-slate-500 mt-0.5">{data.systemSubtitle}</div>
        <div className="text-[11px] font-mono text-slate-400 mt-1.5">
          {opPct}% · {data.activeCount}/{data.equipCount}대
        </div>
        <div className="mt-1.5" style={{ width: 100 }}>
          <div className="w-full h-[4px] bg-white/[0.06] rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width: `${Math.max(opPct, 2)}%`, background: barColor }} />
          </div>
        </div>
      </div>
    </div>
  );
});

/* ─────────────────────────────────────────────────
 * 2. FlowEquipCard — Equipment card (260×90) with highlight + alarm badge
 * ───────────────────────────────────────────────── */

export interface FlowEquipData {
  name: string;
  displayName: string;
  equipId: string;
  type: string;
  labels: string[];
  systemKey: SystemKey;
  systemColor: string;
  isActive: boolean;
  operationPct: number;
  sensorCount: number;
  statusLabel: "NORMAL" | "WARNING" | "STOP";
  isIsolated: boolean;
  highlightState: HighlightState;
  alarmSeverity: AlarmSeverity;
}

const STATUS_STYLES: Record<FlowEquipData["statusLabel"], string> = {
  NORMAL: "bg-emerald-500/20 text-emerald-400",
  WARNING: "bg-amber-500/20 text-amber-400",
  STOP: "bg-rose-500/20 text-rose-400",
};

const HIGHLIGHT_STYLES: Record<HighlightState, { border: string; shadow: string; opacity: number; className?: string }> = {
  none: { border: "", shadow: "", opacity: 1 },
  "fault-source": { border: "2px solid rgb(239,68,68)", shadow: "0 0 20px rgba(239,68,68,0.6), 0 0 40px rgba(239,68,68,0.3)", opacity: 1, className: "fault-source-blink" },
  direct: { border: "2px solid rgb(251,146,60)", shadow: "0 0 16px rgba(251,146,60,0.5)", opacity: 1 },
  indirect: { border: "2px solid rgb(250,204,21)", shadow: "0 0 12px rgba(250,204,21,0.3)", opacity: 1 },
  extended: { border: "2px solid rgba(250,204,21,0.5)", shadow: "0 0 8px rgba(250,204,21,0.2)", opacity: 0.8 },
  "zone-affected": { border: "2px solid rgb(168,85,247)", shadow: "0 0 12px rgba(168,85,247,0.4)", opacity: 1 },
  dimmed: { border: "", shadow: "", opacity: 0.15 },
};

const ALARM_COLORS: Record<string, string> = {
  critical: "rgb(239,68,68)",
  warning: "rgb(251,146,60)",
  info: "rgb(59,130,246)",
};

const FlowEquipCard = memo(function FlowEquipCard({
  data,
}: NodeProps<FlowEquipData>) {
  const handleClick = useCallback((e: React.MouseEvent) => {
    if (data.highlightState !== "none" && data.highlightState !== "dimmed") return;
    const monId = `bldg:${data.name}`;
    window.open(`/monitoring/${encodeURIComponent(monId)}`, "_blank");
  }, [data.name, data.highlightState]);

  const hl = HIGHLIGHT_STYLES[data.highlightState];

  const opGrad =
    data.operationPct > 70
      ? `linear-gradient(90deg, ${data.systemColor}, rgba(52,211,153,0.8))`
      : data.operationPct > 30
      ? `linear-gradient(90deg, rgba(251,191,36,0.8), rgba(245,158,11,0.6))`
      : `linear-gradient(90deg, rgba(251,113,133,0.8), rgba(239,68,68,0.6))`;

  return (
    <div
      onClick={handleClick}
      className={`relative rounded-lg cursor-pointer transition-all duration-200 hover:scale-[1.02] hover:brightness-110 ${
        data.isActive ? "equip-card-active" : ""
      } ${data.isIsolated ? "equip-card-isolated" : ""} ${hl.className || ""}`}
      style={{
        width: 260,
        height: 90,
        background: data.isIsolated
          ? "rgba(255,255,255,0.02)"
          : "rgba(255,255,255,0.04)",
        backdropFilter: "blur(12px)",
        border: hl.border || (data.isIsolated
          ? "1px dashed rgba(255,255,255,0.12)"
          : "1px solid rgba(255,255,255,0.08)"),
        borderLeft: data.isIsolated
          ? `3px dashed ${data.systemColor}80`
          : `3px solid ${data.systemColor}`,
        opacity: hl.opacity * (data.isIsolated ? 0.5 : 1),
        boxShadow: hl.shadow || undefined,
      }}
    >
      {/* Handles */}
      <Handle type="target" position={Position.Left}
        className="!w-2 !h-2 !border !border-slate-700 !-left-1.5"
        style={{ background: data.systemColor, top: "50%" }} />
      <Handle type="source" position={Position.Right}
        className="!w-2 !h-2 !border !border-slate-700 !-right-1.5"
        style={{ background: data.systemColor, top: "50%" }} />

      {/* Alarm badge */}
      {data.alarmSeverity && (
        <div
          className={`absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white z-10 ${
            data.alarmSeverity === "critical" ? "alarm-badge-pulse" : ""
          }`}
          style={{ background: ALARM_COLORS[data.alarmSeverity] }}
        >
          !
        </div>
      )}

      <div className="h-full flex flex-col justify-between px-3 py-2">
        {/* Row 1: Equipment ID + status badge */}
        <div className="flex items-center justify-between gap-1">
          <span className="text-[9px] font-mono text-slate-500 truncate">
            {data.name}
          </span>
          <span className={`rounded px-1.5 py-0.5 text-[9px] font-mono font-bold flex-shrink-0 ${STATUS_STYLES[data.statusLabel]}`}>
            {data.statusLabel}
          </span>
        </div>
        {/* Row 2: Display name */}
        <div className="text-[13px] font-semibold text-white truncate leading-tight">
          {data.displayName}
        </div>
        {/* Row 3: Brick type */}
        <div className="text-[10px] font-mono text-slate-500 truncate">
          {data.type}
        </div>
        {/* Row 4: Operation bar + pct + sensor count */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-[6px] bg-white/[0.06] rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width: `${data.operationPct}%`, background: opGrad }} />
          </div>
          <span className="text-[11px] font-mono flex-shrink-0"
            style={{
              color: data.operationPct > 70 ? "rgb(52,211,153)"
                : data.operationPct > 30 ? "rgb(251,191,36)" : "rgb(251,113,133)",
            }}>
            {data.operationPct}%
          </span>
          {data.sensorCount > 0 && (
            <span className="text-[9px] font-mono text-slate-500 flex-shrink-0">
              S:{data.sensorCount}
            </span>
          )}
        </div>
      </div>
    </div>
  );
});

/* ─────────────────────────────────────────────────
 * 3. ZoneNode — HVAC Zone node (180×50)
 * ───────────────────────────────────────────────── */

export interface ZoneNodeData {
  name: string;
  displayName: string;
  floor: string | null;
  connectedEquipCount: number;
  systemKey: SystemKey;
  systemColor: string;
}

const ZoneNode = memo(function ZoneNode({ data }: NodeProps<ZoneNodeData>) {
  return (
    <div className="rounded-md px-3 py-1.5"
      style={{
        width: 180, height: 50,
        background: "rgba(255,255,255,0.03)",
        backdropFilter: "blur(8px)",
        border: `1px solid ${data.systemColor}40`,
        borderLeft: `2px solid ${data.systemColor}`,
      }}>
      <Handle type="target" position={Position.Left}
        className="!w-2 !h-2 !border !border-slate-700 !-left-1.5"
        style={{ background: data.systemColor, top: "50%" }} />
      <div className="text-[11px] font-medium text-slate-300 truncate leading-tight">
        {data.displayName}
      </div>
      <div className="text-[9px] text-slate-500 mt-0.5">
        {data.floor} · {data.connectedEquipCount} equip
      </div>
    </div>
  );
});

/* ── Export Node Types ── */

export const equipFlowNodeTypes = {
  systemGroup: SystemGroupNode,
  flowEquipCard: FlowEquipCard,
  zoneNode: ZoneNode,
  levelLabel: LevelLabelNode,
};

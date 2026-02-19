/**
 * Cross-Section Topology — Custom React Flow Nodes
 * FloorBandNode, CompactEquipCard, ZoneChipNode
 */

"use client";

import { memo, useCallback } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import type { FloorZone, EquipCategory } from "./cs-utils";
import { ZONE_COLORS, CATEGORY_INFO } from "./cs-utils";
import {
  Snowflake,
  Flame,
  Wind,
  Fan,
  Droplets,
  Gauge,
  Zap,
  BatteryCharging,
  ToggleLeft,
  Activity,
  Sun,
  ArrowUpDown,
  ArrowLeftRight,
  SlidersHorizontal,
  Cpu,
  Thermometer,
  Box,
  type LucideIcon,
} from "lucide-react";

/* ── Equipment Icon Mapping ── */

const EQUIP_ICON_RULES: { match: RegExp; icon: LucideIcon }[] = [
  { match: /chiller/i,                    icon: Snowflake },
  { match: /boiler/i,                     icon: Flame },
  { match: /ahu|doas|air_handling/i,      icon: Wind },
  { match: /fcu|fan_coil/i,              icon: Fan },
  { match: /vav/i,                        icon: SlidersHorizontal },
  { match: /cooling_tower/i,             icon: Droplets },
  { match: /heat_exchanger/i,            icon: ArrowLeftRight },
  { match: /pump/i,                       icon: Gauge },
  { match: /fan/i,                        icon: Fan },
  { match: /transformer/i,               icon: Zap },
  { match: /ups/i,                        icon: BatteryCharging },
  { match: /switchgear|distribution/i,   icon: ToggleLeft },
  { match: /generator/i,                  icon: Activity },
  { match: /solar|pv/i,                   icon: Sun },
  { match: /elevator/i,                   icon: ArrowUpDown },
  { match: /cc_panel/i,                   icon: Cpu },
  { match: /meter/i,                      icon: Gauge },
  { match: /damper|valve/i,              icon: SlidersHorizontal },
  { match: /sensor|thermometer|temp/i,   icon: Thermometer },
];

function getEquipIcon(name: string, labels: string[]): LucideIcon {
  const combined = (name + " " + labels.join(" ")).toLowerCase();
  for (const rule of EQUIP_ICON_RULES) {
    if (rule.match.test(combined)) return rule.icon;
  }
  return Box;
}

/* ─────────────────────────────────────────────────
 * 1. FloorBandNode — Large horizontal band per floor
 * ───────────────────────────────────────────────── */

export interface FloorBandData {
  floorKey: string;
  displayName: string;
  zone: FloorZone;
  equipCount: number;
  zoneCount: number;
  roomCount: number;
  activeCount: number;
  sensorCount: number;
  bandWidth: number;
  bandHeight: number;
}

const FloorBandNode = memo(function FloorBandNode({
  data,
}: NodeProps<FloorBandData>) {
  const zoneColor = ZONE_COLORS[data.zone];
  const activeRatio =
    data.equipCount > 0 ? data.activeCount / data.equipCount : 0;

  return (
    <div
      className="relative rounded-xl overflow-hidden"
      style={{
        width: data.bandWidth,
        height: data.bandHeight,
        background: "rgba(15,23,42,0.60)",
        backdropFilter: "blur(24px)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* Handles for cross-floor edges */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-1 !h-1 !bg-transparent !border-0"
        style={{ left: "50%" }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-1 !h-1 !bg-transparent !border-0"
        style={{ left: "50%" }}
      />

      {/* Left accent bar */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[5px] rounded-l-xl"
        style={{ background: zoneColor }}
      />

      {/* Floor header area */}
      <div className="absolute left-5 top-5 w-[220px] select-none">
        {/* Floor name */}
        <div
          className="text-[36px] font-black font-mono tracking-tight leading-none"
          style={{ color: zoneColor }}
        >
          {data.displayName}
        </div>

        {/* Stats row */}
        <div className="mt-4 space-y-1.5 text-[16px] font-mono text-slate-500">
          <div className="flex gap-4">
            <span>
              E:<span className="text-slate-400">{data.equipCount}</span>
            </span>
            <span>
              S:<span className="text-slate-400">{data.sensorCount}</span>
            </span>
          </div>
          <div className="flex gap-4">
            <span>
              Z:<span className="text-slate-400">{data.zoneCount}</span>
            </span>
            <span>
              R:<span className="text-slate-400">{data.roomCount}</span>
            </span>
          </div>
        </div>

        {/* Active ratio mini bar */}
        <div className="mt-4 w-full">
          <div className="flex justify-between text-[14px] text-slate-600 mb-1">
            <span>Active</span>
            <span>{(activeRatio * 100).toFixed(0)}%</span>
          </div>
          <div className="w-full h-[8px] bg-white/[0.06] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${Math.max(activeRatio * 100, 2)}%`,
                background:
                  activeRatio > 0.8
                    ? "linear-gradient(90deg, rgb(52,211,153), rgb(34,211,238))"
                    : activeRatio > 0.5
                    ? "linear-gradient(90deg, rgb(251,191,36), rgb(245,158,11))"
                    : "linear-gradient(90deg, rgb(251,113,133), rgb(239,68,68))",
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
});

/* ─────────────────────────────────────────────────
 * 2. CompactEquipCard — Small equipment card (180×72)
 * ───────────────────────────────────────────────── */

export interface CompactEquipData {
  name: string;
  displayName: string;
  type: string;
  labels: string[];
  category: EquipCategory;
  systemColor: string;
  isActive: boolean;
  isSimulated: boolean;
  operationPct: number;
  sensorCount: number;
  floorKey: string;
}

const CompactEquipCard = memo(function CompactEquipCard({
  data,
}: NodeProps<CompactEquipData>) {
  const catInfo = CATEGORY_INFO[data.category];
  const Icon = getEquipIcon(data.name, data.labels);

  const handleClick = useCallback(() => {
    const monId = `bldg:${data.name}`;
    window.open(`/monitoring/${encodeURIComponent(monId)}`, "_blank");
  }, [data.name]);

  const opGrad =
    data.operationPct > 70
      ? `linear-gradient(90deg, ${data.systemColor}, rgba(52,211,153,0.8))`
      : data.operationPct > 30
      ? `linear-gradient(90deg, rgba(251,191,36,0.8), rgba(245,158,11,0.6))`
      : `linear-gradient(90deg, rgba(251,113,133,0.8), rgba(239,68,68,0.6))`;

  return (
    <div
      onClick={handleClick}
      className={`relative rounded-lg cursor-pointer transition-all duration-200 hover:scale-[1.02] ${
        data.isActive ? "equip-card-active" : ""
      }`}
      style={{
        width: 380,
        height: 140,
        background: "rgba(255,255,255,0.04)",
        backdropFilter: "blur(12px)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderLeft: `4px solid ${data.systemColor}`,
      }}
    >
      {/* Handles */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !border-2 !border-slate-700 !-left-2"
        style={{ background: data.systemColor, top: "50%" }}
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !border-2 !border-slate-700 !-right-2"
        style={{ background: data.systemColor, top: "50%" }}
      />

      <div className="h-full flex items-stretch">
        {/* Icon area — 3D circular sci-fi style */}
        <div
          className="flex items-center justify-center flex-shrink-0"
          style={{ width: 100 }}
        >
          <div className="relative flex items-center justify-center" style={{ width: 80, height: 80 }}>
            {/* Outer rotating glow ring */}
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background: `conic-gradient(from 0deg, transparent 0%, ${data.systemColor}50 15%, transparent 30%, ${data.systemColor}30 50%, transparent 65%, ${data.systemColor}40 80%, transparent 100%)`,
                animation: data.isActive ? "spin 6s linear infinite" : "none",
                opacity: data.isActive ? 1 : 0.3,
              }}
            />
            {/* Ring gap / dark spacer */}
            <div
              className="absolute rounded-full"
              style={{
                inset: 3,
                background: "rgba(8,12,24,0.95)",
              }}
            />
            {/* Middle ring border */}
            <div
              className="absolute rounded-full"
              style={{
                inset: 5,
                border: `1.5px solid ${data.systemColor}35`,
                background: "transparent",
              }}
            />
            {/* Inner 3D circle with depth */}
            <div
              className="absolute rounded-full"
              style={{
                inset: 10,
                background: `radial-gradient(circle at 35% 30%, ${data.systemColor}18, rgba(8,12,24,0.95) 70%)`,
                border: `1px solid ${data.systemColor}20`,
                boxShadow: data.isActive
                  ? `0 0 24px ${data.systemColor}35, inset 0 1px 1px ${data.systemColor}15, inset 0 -4px 8px rgba(0,0,0,0.4)`
                  : `inset 0 1px 1px ${data.systemColor}08, inset 0 -4px 8px rgba(0,0,0,0.3)`,
              }}
            />
            {/* Top highlight arc (3D glossy) */}
            <div
              className="absolute rounded-full"
              style={{
                inset: 12,
                background: `linear-gradient(160deg, ${data.systemColor}12 0%, transparent 45%)`,
                pointerEvents: "none",
              }}
            />
            {/* Corner indicator dots */}
            {data.isActive && (
              <>
                <div
                  className="absolute rounded-full"
                  style={{
                    width: 4, height: 4, top: 6, right: 12,
                    background: data.systemColor,
                    boxShadow: `0 0 6px ${data.systemColor}`,
                  }}
                />
                <div
                  className="absolute rounded-full"
                  style={{
                    width: 3, height: 3, bottom: 8, left: 14,
                    background: data.systemColor,
                    boxShadow: `0 0 4px ${data.systemColor}`,
                    opacity: 0.6,
                  }}
                />
              </>
            )}
            {/* Icon */}
            <Icon
              size={30}
              strokeWidth={1.5}
              style={{
                color: data.systemColor,
                filter: data.isActive
                  ? `drop-shadow(0 0 8px ${data.systemColor}90) drop-shadow(0 0 3px ${data.systemColor}60)`
                  : `drop-shadow(0 0 3px ${data.systemColor}40)`,
                position: "relative",
                zIndex: 1,
              }}
            />
          </div>
        </div>

        {/* Content area — right column */}
        <div className="flex-1 py-3.5 pr-4 flex flex-col justify-between min-w-0">
          {/* Row 1: Name + status dot */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-[18px] font-semibold text-white truncate leading-tight flex-1">
              {data.displayName}
            </span>
            {data.isSimulated && (
              <span
                className={`w-3 h-3 rounded-full flex-shrink-0 ${
                  data.isActive
                    ? "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.7)]"
                    : "bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.5)]"
                }`}
              />
            )}
          </div>

          {/* Row 2: Category badge + operation % */}
          <div className="flex items-center justify-between gap-2">
            <span
              className="text-[14px] font-mono px-2 py-0.5 rounded bg-white/5 truncate"
              style={{ color: catInfo.color }}
            >
              {catInfo.label}
            </span>
            {data.isSimulated && (
              <span
                className="text-[16px] font-mono font-medium"
                style={{
                  color:
                    data.operationPct > 70
                      ? "rgb(52,211,153)"
                      : data.operationPct > 30
                      ? "rgb(251,191,36)"
                      : "rgb(251,113,133)",
                }}
              >
                {data.operationPct}%
              </span>
            )}
          </div>

          {/* Row 3: Progress bar + sensor count */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-[8px] bg-white/[0.06] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${data.operationPct}%`,
                  background: opGrad,
                }}
              />
            </div>
            {data.sensorCount > 0 && (
              <span className="text-[14px] font-mono text-slate-500 flex-shrink-0">
                S:{data.sensorCount}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

/* ─────────────────────────────────────────────────
 * 3. ZoneChipNode — Small zone pill (90×32)
 * ───────────────────────────────────────────────── */

export interface ZoneChipData {
  name: string;
  displayName: string;
  floorKey: string;
}

const ZoneChipNode = memo(function ZoneChipNode({
  data,
}: NodeProps<ZoneChipData>) {
  return (
    <div
      className="flex items-center gap-2 rounded-full select-none px-4"
      style={{
        width: 180,
        height: 64,
        background: "rgba(30,41,59,0.60)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* Handle for receiving feeds from AHU */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2.5 !h-2.5 !border !border-slate-700 !bg-slate-500 !-left-1.5"
      />

      <Wind size={18} className="text-emerald-400/60 flex-shrink-0" />
      <span className="text-[16px] text-slate-400 font-mono truncate">
        {data.displayName}
      </span>
    </div>
  );
});

/* ── Export Node Types ── */

export const csNodeTypes = {
  floorBand: FloorBandNode,
  compactEquipCard: CompactEquipCard,
  zoneChip: ZoneChipNode,
};

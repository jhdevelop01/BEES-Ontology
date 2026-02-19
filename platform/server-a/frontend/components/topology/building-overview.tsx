"use client";

import { useMemo } from "react";
import { Building2, Cpu, Activity } from "lucide-react";
import { useTranslations } from "next-intl";
import type { TopologyNode } from "@/lib/api";
import type { SSEPointEvent } from "@/lib/sse";
import { _isEquipmentByLabels } from "./utils";
import { StatusIndicator, OperationBar } from "./status-indicator";

interface BuildingOverviewProps {
  node: TopologyNode;
  deviceStatusMap: Record<string, boolean>;
  points: Record<string, SSEPointEvent>;
  onSelectFloor: (floorNode: TopologyNode) => void;
}

/* ── Building system definitions ── */
const SYSTEMS = [
  { id: "chw", label: "CHW", css: "rgb(34,211,238)" },
  { id: "hw", label: "HW", css: "rgb(251,113,133)" },
  { id: "cw", label: "CW", css: "rgb(129,140,248)" },
  { id: "elec", label: "ELEC", css: "rgb(251,191,36)" },
] as const;

type SysId = (typeof SYSTEMS)[number]["id"];

/* ── Helpers ── */

function shortName(name: string) {
  const m = name.match(/B_(.+)/);
  return m ? m[1] : name;
}

type Zone = "roof" | "upper" | "basement";

function getZone(name: string): Zone {
  const u = name.toUpperCase();
  if (u.includes("RF") || u.includes("PH")) return "roof";
  if (/B\d/.test(u)) return "basement";
  return "upper";
}

function sortOrder(name: string, z: Zone) {
  const n = parseInt(name.replace(/\D/g, ""), 10) || 0;
  return z === "roof" ? 1000 + n : z === "upper" ? 500 - n : -n;
}

/* ── Detect which building systems serve a floor ── */
function detectSystems(node: TopologyNode): Set<SysId> {
  const s = new Set<SysId>();
  const walk = (n: TopologyNode) => {
    if (!_isEquipmentByLabels(n)) {
      n.children?.forEach(walk);
      return;
    }
    const tp = (
      n.type +
      " " +
      n.name +
      " " +
      (n.labels?.join(" ") ?? "")
    ).toLowerCase();
    if (/ahu|fcu|vav|cooling_coil|heating_coil/.test(tp)) {
      s.add("chw");
      s.add("hw");
    }
    if (tp.includes("chiller")) {
      s.add("chw");
      s.add("cw");
    }
    if (tp.includes("boiler")) s.add("hw");
    if (tp.includes("cooling_tower")) s.add("cw");
    if (tp.includes("pump")) {
      if (/chw|chill/.test(tp)) s.add("chw");
      if (/\bhw\b|hot/.test(tp)) s.add("hw");
      if (/\bcw\b|cond/.test(tp)) s.add("cw");
    }
    if (tp.includes("heat_exchanger")) {
      s.add("chw");
      s.add("hw");
    }
    if (
      /transformer|ups|switchgear|emergency_generator|panel|meter|inverter/.test(
        tp
      )
    )
      s.add("elec");
    n.children?.forEach(walk);
  };
  node.children?.forEach(walk);
  return s;
}

/* ── Count equipment by simplified type ── */
const EQUIP_MAP: [RegExp, string][] = [
  [/ahu/, "AHU"],
  [/fcu/, "FCU"],
  [/vav/, "VAV"],
  [/chiller/, "Chiller"],
  [/boiler/, "Boiler"],
  [/cooling_tower/, "CT"],
  [/pump/, "Pump"],
  [/fan/, "Fan"],
  [/transformer/, "Tr"],
  [/ups/, "UPS"],
  [/elevator/, "EV"],
  [/heat_exchanger/, "HX"],
  [/vfd/, "VFD"],
  [/valve/, "Vlv"],
];

function equipTypes(node: TopologyNode): Record<string, number> {
  const c: Record<string, number> = {};
  const walk = (n: TopologyNode) => {
    if (_isEquipmentByLabels(n)) {
      const tp = (n.type + " " + (n.labels?.join(" ") ?? "")).toLowerCase();
      for (const [re, label] of EQUIP_MAP) {
        if (re.test(tp)) {
          c[label] = (c[label] || 0) + 1;
          break;
        }
      }
    }
    n.children?.forEach(walk);
  };
  node.children?.forEach(walk);
  return c;
}

function countStats(
  node: TopologyNode,
  dsm: Record<string, boolean>
) {
  let total = 0,
    active = 0,
    sensors = 0;
  const walk = (n: TopologyNode) => {
    if (_isEquipmentByLabels(n)) {
      total++;
      if (dsm[n.name] || dsm[n.id]) active++;
    }
    const tp = n.type.toLowerCase();
    if (tp.includes("sensor") || tp.includes("point")) sensors++;
    n.children?.forEach(walk);
  };
  node.children?.forEach(walk);
  return { total, active, sensors };
}

function statusOf(r: number): "normal" | "warning" | "critical" {
  return r > 0.8 ? "normal" : r > 0.5 ? "warning" : "critical";
}

const STATUS_GRADIENT = {
  normal:
    "linear-gradient(90deg, rgba(52,211,153,0.12), rgba(52,211,153,0.03))",
  warning:
    "linear-gradient(90deg, rgba(251,191,36,0.12), rgba(251,191,36,0.03))",
  critical:
    "linear-gradient(90deg, rgba(251,113,133,0.12), rgba(251,113,133,0.03))",
};

interface FloorRow {
  node: TopologyNode;
  short: string;
  zone: Zone;
  ord: number;
  stats: { total: number; active: number; sensors: number };
  systems: Set<SysId>;
  equips: Record<string, number>;
}

/* ── Component ── */

export function BuildingOverview({
  node,
  deviceStatusMap,
  points,
  onSelectFloor,
}: BuildingOverviewProps) {
  const t = useTranslations("topology");

  /* Process all floor data */
  const floors = useMemo<FloorRow[]>(
    () =>
      (node.children ?? [])
        .map((child): FloorRow => {
          const z = getZone(child.name);
          return {
            node: child,
            short: shortName(child.name),
            zone: z,
            ord: sortOrder(child.name, z),
            stats: countStats(child, deviceStatusMap),
            systems: detectSystems(child),
            equips: equipTypes(child),
          };
        })
        .sort((a, b) => b.ord - a.ord),
    [node.children, deviceStatusMap]
  );

  /* Building totals */
  const totals = useMemo(
    () => countStats(node, deviceStatusMap),
    [node, deviceStatusMap]
  );
  const bldgRatio = totals.total > 0 ? totals.active / totals.total : 0;

  /* System flow: source → consumer mapping */
  const flows = useMemo(() => {
    const m: Record<SysId, { src: string[]; dst: string[] }> = {
      chw: { src: [], dst: [] },
      hw: { src: [], dst: [] },
      cw: { src: [], dst: [] },
      elec: { src: [], dst: [] },
    };
    for (const f of floors) {
      const e = Object.keys(f.equips).map((k) => k.toLowerCase());
      if (e.includes("chiller")) m.chw.src.push(f.short);
      if (e.some((x) => ["ahu", "fcu", "vav"].includes(x)))
        m.chw.dst.push(f.short);
      if (e.includes("boiler")) m.hw.src.push(f.short);
      if (e.some((x) => ["ahu", "fcu"].includes(x))) m.hw.dst.push(f.short);
      if (e.includes("ct")) m.cw.src.push(f.short);
      if (e.includes("chiller")) m.cw.dst.push(f.short);
      if (e.some((x) => ["tr", "ups"].includes(x)))
        m.elec.src.push(f.short);
    }
    return m;
  }, [floors]);

  const flowDesc: Record<string, string> = {
    chw: t("flowCHW"),
    hw: t("flowHW"),
    cw: t("flowCW"),
    elec: t("flowELEC"),
  };

  const ARTERY_W = SYSTEMS.length * 28;

  return (
    <div className="space-y-4 animate-in">
      {/* ── KPI Header ── */}
      <div className="glass-card rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-cyan-400" />
            <span className="text-white font-semibold text-lg">
              {node.name}
            </span>
            <span className="text-xs text-slate-500">
              {t("buildingOverviewTitle")}
            </span>
          </div>
          <StatusIndicator status={statusOf(bldgRatio)} size="md" />
        </div>

        <div className="grid grid-cols-4 gap-3 mb-3">
          {[
            { v: floors.length, l: t("kpiFloors"), c: "text-white" },
            { v: totals.total, l: t("equipmentCountLabel"), c: "text-cyan-400" },
            { v: totals.active, l: t("kpiActive"), c: "text-emerald-400" },
            { v: totals.sensors, l: t("sensorCountLabel"), c: "text-slate-400" },
          ].map((k) => (
            <div key={k.l} className="text-center">
              <p className={`text-2xl font-bold font-mono ${k.c}`}>{k.v}</p>
              <p className="text-[10px] text-slate-500">{k.l}</p>
            </div>
          ))}
        </div>

        <div className="flex justify-between text-[10px] text-slate-500 mb-1">
          <span>{t("activeRatio")}</span>
          <span>{(bldgRatio * 100).toFixed(0)}%</span>
        </div>
        <OperationBar ratio={bldgRatio} size="md" />
      </div>

      {/* ── System Legend ── */}
      <div className="flex items-center gap-4 px-1">
        <span className="text-[10px] text-slate-600 uppercase tracking-wider">
          {t("systemArteries")}
        </span>
        {SYSTEMS.map((s) => (
          <div key={s.id} className="flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-full"
              style={{
                backgroundColor: s.css,
                boxShadow: `0 0 6px ${s.css}40`,
              }}
            />
            <span className="text-[10px] text-slate-400 font-mono">
              {s.label}
            </span>
          </div>
        ))}
      </div>

      {/* ── Building Cross-Section Schematic ── */}
      <div className="glass-card rounded-xl overflow-hidden">
        {/* Column headers */}
        <div className="flex items-center px-3 py-2 border-b border-white/5 text-[9px] text-slate-600 uppercase tracking-wider">
          <div className="w-12 text-right pr-2">{t("typeFloor")}</div>
          <div className="flex-1">{t("equipmentCountLabel")}</div>
          <div className="w-24 text-right">{t("activeRatio")}</div>
          <div className="flex" style={{ width: `${ARTERY_W}px` }}>
            {SYSTEMS.map((s) => (
              <div
                key={s.id}
                className="w-7 text-center font-mono"
                style={{ color: s.css }}
              >
                {s.label}
              </div>
            ))}
          </div>
        </div>

        {/* Floor rows with zone separators */}
        {floors.map((f, i) => {
          const prev = i > 0 ? floors[i - 1] : null;
          const zoneSep = !prev || prev.zone !== f.zone;
          const r =
            f.stats.total > 0 ? f.stats.active / f.stats.total : 0;
          const st = statusOf(r);

          const zLabel =
            f.zone === "roof"
              ? t("rooftopFloors")
              : f.zone === "upper"
              ? t("upperFloors")
              : t("lowerFloors");
          const zColor =
            f.zone === "roof"
              ? "text-emerald-500/60"
              : f.zone === "upper"
              ? "text-cyan-500/60"
              : "text-purple-500/60";

          return (
            <div key={f.node.id}>
              {/* Zone separator */}
              {zoneSep && (
                <div className="flex items-center px-3 py-1.5 bg-white/[0.015]">
                  <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                  <span
                    className={`px-3 text-[9px] uppercase tracking-widest ${zColor}`}
                  >
                    {zLabel}
                  </span>
                  <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                  {/* Artery pass-through lines */}
                  <div
                    className="flex"
                    style={{ width: `${ARTERY_W}px` }}
                  >
                    {SYSTEMS.map((s) => (
                      <div key={s.id} className="w-7 flex justify-center">
                        <div
                          className="w-px h-4"
                          style={{ backgroundColor: `${s.css}12` }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Floor row */}
              <button
                onClick={() => onSelectFloor(f.node)}
                className="w-full flex items-center px-3 py-2 hover:bg-white/[0.04] transition-colors group"
              >
                {/* Floor name */}
                <div className="w-12 flex-shrink-0 text-right pr-2">
                  <span
                    className={`text-xs font-bold font-mono ${
                      f.zone === "roof"
                        ? "text-emerald-400"
                        : f.zone === "basement"
                        ? "text-purple-400"
                        : "text-cyan-400"
                    }`}
                  >
                    {f.short}
                  </span>
                </div>

                {/* Equipment bar with type badges */}
                <div className="flex-1 relative h-7 min-w-0">
                  <div className="absolute inset-0 bg-white/[0.03] rounded border border-white/5 group-hover:border-white/10 transition-colors overflow-hidden">
                    {/* Active fill gradient */}
                    <div
                      className="absolute inset-y-0 left-0 rounded transition-all duration-700"
                      style={{
                        width: `${Math.max(r * 100, 2)}%`,
                        background: STATUS_GRADIENT[st],
                      }}
                    />
                    {/* Equipment type mini-badges */}
                    <div className="relative flex items-center h-full px-1.5 gap-1 overflow-hidden">
                      {Object.entries(f.equips)
                        .sort(([, a], [, b]) => b - a)
                        .slice(0, 5)
                        .map(([tp, cnt]) => (
                          <span
                            key={tp}
                            className="text-[9px] font-mono px-1 py-0.5 rounded bg-white/5 text-slate-400 whitespace-nowrap flex-shrink-0"
                          >
                            {tp}
                            {cnt > 1 && (
                              <span className="text-slate-600">
                                ×{cnt}
                              </span>
                            )}
                          </span>
                        ))}
                    </div>
                  </div>
                </div>

                {/* Stats */}
                <div className="w-24 flex items-center justify-end gap-2 flex-shrink-0 pl-2">
                  <span className="text-[10px] text-slate-500 font-mono">
                    <Cpu className="h-2.5 w-2.5 inline mr-0.5" />
                    {f.stats.active}/{f.stats.total}
                  </span>
                  <StatusIndicator status={st} size="sm" />
                </div>

                {/* System artery junction dots */}
                <div
                  className="flex items-center flex-shrink-0"
                  style={{ width: `${ARTERY_W}px` }}
                >
                  {SYSTEMS.map((s) => {
                    const on = f.systems.has(s.id);
                    return (
                      <div
                        key={s.id}
                        className="w-7 h-9 flex items-center justify-center relative"
                      >
                        {/* Vertical line segment */}
                        <div
                          className="absolute inset-y-0 w-px left-1/2 -translate-x-1/2"
                          style={{
                            backgroundColor: on
                              ? `${s.css}25`
                              : `${s.css}08`,
                          }}
                        />
                        {/* Junction dot */}
                        {on ? (
                          <span
                            className="relative z-10 w-2 h-2 rounded-full building-junction-dot"
                            style={{
                              backgroundColor: s.css,
                              boxShadow: `0 0 5px ${s.css}50`,
                            }}
                          />
                        ) : (
                          <span className="relative z-10 w-1 h-1 rounded-full bg-white/10" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </button>
            </div>
          );
        })}
      </div>

      {/* ── System Flow Summary ── */}
      <div className="grid grid-cols-2 gap-2">
        {SYSTEMS.map((s) => {
          const fl = flows[s.id];
          if (!fl.src.length && !fl.dst.length) return null;
          return (
            <div key={s.id} className="glass-card rounded-lg p-2.5">
              <div className="flex items-center gap-1.5 mb-1.5">
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: s.css }}
                />
                <span className="text-[10px] font-mono font-medium text-white">
                  {s.label}
                </span>
                <span className="text-[10px] text-slate-500">
                  {flowDesc[s.id]}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[9px]">
                {fl.src.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded bg-white/5 text-slate-400 font-mono">
                    {fl.src.join(", ")}
                  </span>
                )}
                {fl.src.length > 0 && fl.dst.length > 0 && (
                  <span
                    className="text-sm"
                    style={{ color: `${s.css}80` }}
                  >
                    →
                  </span>
                )}
                {fl.dst.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded bg-white/5 text-slate-400 font-mono truncate">
                    {fl.dst.length > 3
                      ? `${fl.dst[0]} ~ ${fl.dst[fl.dst.length - 1]}`
                      : fl.dst.join(", ")}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

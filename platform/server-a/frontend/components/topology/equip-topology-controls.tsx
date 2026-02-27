"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Search, Loader2 } from "lucide-react";
import { SYSTEM_COLORS, type SystemKey } from "./cs-utils";

/* ── Types ── */

interface EquipTopologyControlsProps {
  activeSystems: SystemKey[];
  onSystemFilter: (systems: SystemKey[]) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  nodeCount: number;
  edgeCount: number;
  levelCount: number;
  showZones: boolean;
  onToggleZones: () => void;
  zoneCount: number;
  impactMode: boolean;
  onImpactToggle: () => void;
  impactLoading: boolean;
}

/* ── Constants ── */

const ALL_SYSTEMS: SystemKey[] = ["chw", "hw", "cw", "elec", "air"];

const FILTER_KEYS: Record<SystemKey, string> = {
  chw: "topoFilterCHW",
  hw: "topoFilterHW",
  cw: "topoFilterCW",
  elec: "topoFilterELEC",
  air: "topoFilterAIR",
};

/* ── Component ── */

export function EquipTopologyControls({
  activeSystems,
  onSystemFilter,
  searchQuery,
  onSearchChange,
  nodeCount,
  edgeCount,
  levelCount,
  showZones,
  onToggleZones,
  zoneCount,
  impactMode,
  onImpactToggle,
  impactLoading,
}: EquipTopologyControlsProps) {
  const t = useTranslations("topology");
  const [localQuery, setLocalQuery] = useState(searchQuery);
  const timerRef = useRef<NodeJS.Timeout>();

  useEffect(() => { setLocalQuery(searchQuery); }, [searchQuery]);
  useEffect(() => { return () => clearTimeout(timerRef.current); }, []);

  const handleSearch = (val: string) => {
    setLocalQuery(val);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onSearchChange(val), 300);
  };

  const allActive = ALL_SYSTEMS.every((s) => activeSystems.includes(s));

  const toggleAll = () => {
    onSystemFilter(allActive ? [] : [...ALL_SYSTEMS]);
  };

  const toggleSystem = (sys: SystemKey) => {
    const next = activeSystems.includes(sys)
      ? activeSystems.filter((s) => s !== sys)
      : [...activeSystems, sys];
    onSystemFilter(next);
  };

  return (
    <div className="relative flex flex-col gap-2 rounded-lg border border-white/[0.06] bg-slate-950/80 px-3 py-2 backdrop-blur-md">
      {/* Row 1: System filters + Impact toggle */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {/* "All" toggle */}
          <button onClick={toggleAll}
            className="rounded-md px-2.5 py-1 text-xs font-medium transition-all duration-200"
            style={{
              background: allActive ? "rgba(34,211,238,0.12)" : "transparent",
              borderWidth: 1, borderStyle: "solid",
              borderColor: allActive ? "rgb(34,211,238)" : "rgb(51,65,85)",
              color: allActive ? "rgb(34,211,238)" : "rgb(100,116,139)",
              boxShadow: allActive ? "0 0 8px rgba(34,211,238,0.18)" : "none",
            }}>
            {t("topoFilterAll")}
          </button>

          {/* Per-system toggles */}
          {ALL_SYSTEMS.map((sys) => {
            const isActive = activeSystems.includes(sys);
            const c = SYSTEM_COLORS[sys];
            return (
              <button key={sys} onClick={() => toggleSystem(sys)}
                className="rounded-md px-2.5 py-1 text-xs font-medium transition-all duration-200"
                style={{
                  background: isActive ? `${c.css}20` : "transparent",
                  borderWidth: 1, borderStyle: "solid",
                  borderColor: isActive ? c.css : "rgb(51,65,85)",
                  color: isActive ? c.css : "rgb(100,116,139)",
                  boxShadow: isActive ? `0 0 8px ${c.css}30` : "none",
                }}>
                {t(FILTER_KEYS[sys])}
              </button>
            );
          })}

          <div className="w-px h-5 bg-slate-700/50 mx-1" />

          {/* Zone toggle */}
          <button onClick={onToggleZones}
            className="rounded-md px-2.5 py-1 text-xs font-medium transition-all duration-200"
            style={{
              background: showZones ? "rgba(168,85,247,0.12)" : "transparent",
              borderWidth: 1, borderStyle: "solid",
              borderColor: showZones ? "rgb(168,85,247)" : "rgb(51,65,85)",
              color: showZones ? "rgb(168,85,247)" : "rgb(100,116,139)",
              boxShadow: showZones ? "0 0 8px rgba(168,85,247,0.18)" : "none",
            }}>
            {t("topoShowZones")}
          </button>

          <div className="w-px h-5 bg-slate-700/50 mx-1" />

          {/* Impact mode toggle */}
          <button onClick={onImpactToggle}
            className="rounded-md px-2.5 py-1 text-xs font-medium transition-all duration-200 flex items-center gap-1"
            style={{
              background: impactMode ? "rgba(239,68,68,0.15)" : "transparent",
              borderWidth: 1, borderStyle: "solid",
              borderColor: impactMode ? "rgb(239,68,68)" : "rgb(51,65,85)",
              color: impactMode ? "rgb(239,68,68)" : "rgb(100,116,139)",
              boxShadow: impactMode ? "0 0 8px rgba(239,68,68,0.25)" : "none",
            }}>
            {impactLoading && <Loader2 className="h-3 w-3 animate-spin" />}
            {t("topoImpactBtn")}
          </button>
        </div>
      </div>

      {/* Row 2: Search + Stats */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <input type="text" value={localQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder={t("topoSearchPlaceholder")}
            className="w-full rounded-md border border-slate-700 bg-slate-800/50 py-1 pl-7 pr-2 text-xs text-slate-300 placeholder:text-slate-500 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/30 transition-all duration-200"
          />
        </div>
        <span className="shrink-0 text-xs text-slate-500">
          {t("topoLevelCount", { count: levelCount })}
          {" · "}
          {t("topoNodeCount", { count: nodeCount })}
          {" · "}
          {t("topoEdgeCount", { count: edgeCount })}
          {showZones && (
            <>
              {" · "}
              {t("topoZoneCount", { count: zoneCount })}
            </>
          )}
        </span>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect, useMemo } from "react";
import { useTranslations } from "next-intl";
import { Thermometer, Droplets, Wind, Cpu, Zap, Waves, Box } from "lucide-react";
import type { TopologyNode } from "@/lib/api";
import { getFloorDetails, type FloorDetails, type FloorRoom } from "@/lib/api";
import type { SSEPointEvent, SSEDeviceEvent } from "@/lib/sse";
import { _isEquipmentByLabels } from "./utils";
import { FlowCard } from "./flow-card";
import { GroupContainer } from "./group-container";

interface FloorDetailViewProps {
  node: TopologyNode;
  deviceStatusMap: Record<string, boolean>;
  points: Record<string, SSEPointEvent>;
  devices: Record<string, SSEDeviceEvent>;
  onSelectEquipment: (node: TopologyNode) => void;
}

/* ── Equipment categorization ── */
interface EquipmentCategory {
  key: string;
  label: string;
  color: "cyan" | "amber" | "indigo" | "slate";
  icon: React.ComponentType<{ className?: string }>;
  keywords: string[];
}

const categories: EquipmentCategory[] = [
  {
    key: "hvac",
    label: "catHVAC",
    color: "cyan",
    icon: Wind,
    keywords: ["ahu", "fcu", "vav", "fan", "chiller", "boiler", "cooling_tower", "heat_exchanger"],
  },
  {
    key: "electrical",
    label: "catElectrical",
    color: "amber",
    icon: Zap,
    keywords: ["transformer", "ups", "emergency_generator", "switchgear", "meter", "panel", "inverter"],
  },
  {
    key: "plumbing",
    label: "catPlumbing",
    color: "indigo",
    icon: Waves,
    keywords: ["pump", "valve", "water_pump", "tank"],
  },
  {
    key: "other",
    label: "catOther",
    color: "slate",
    icon: Box,
    keywords: ["elevator", "controller", "lighting", "vfd", "damper"],
  },
];

function categorizeEquipment(equips: TopologyNode[]): Record<string, TopologyNode[]> {
  const result: Record<string, TopologyNode[]> = {};
  for (const cat of categories) result[cat.key] = [];

  for (const eq of equips) {
    const tp = (eq.type + " " + (eq.labels?.join(" ") ?? "")).toLowerCase();
    let placed = false;
    for (const cat of categories) {
      if (cat.keywords.some((kw) => tp.includes(kw))) {
        result[cat.key].push(eq);
        placed = true;
        break;
      }
    }
    if (!placed) result["other"].push(eq);
  }
  return result;
}

/* ── Collect all equipment recursively ── */
function collectEquipment(node: TopologyNode): TopologyNode[] {
  const results: TopologyNode[] = [];
  const walk = (n: TopologyNode) => {
    if (_isEquipmentByLabels(n)) results.push(n);
    n.children?.forEach(walk);
  };
  node.children?.forEach(walk);
  return results;
}

/* ── Count child sensors ── */
function countSensors(node: TopologyNode): number {
  let count = 0;
  const walk = (n: TopologyNode) => {
    const tp = n.type.toLowerCase();
    if (tp.includes("sensor") || tp.includes("point")) count++;
    n.children?.forEach(walk);
  };
  node.children?.forEach(walk);
  return count;
}

/* ── Room card ── */
function RoomCard({
  room,
  points,
}: {
  room: FloorRoom;
  points: Record<string, SSEPointEvent>;
}) {
  const t = useTranslations("topology");

  const tempVal = room.sensor_ids.temperature
    ? points[room.sensor_ids.temperature]?.value
    : null;
  const humVal = room.sensor_ids.humidity
    ? points[room.sensor_ids.humidity]?.value
    : null;
  const co2Val = room.sensor_ids.co2
    ? points[room.sensor_ids.co2]?.value
    : null;

  return (
    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-lg p-3">
      <p className="text-sm font-medium text-white truncate">
        {room.label || room.id}
      </p>
      {room.spaceType && (
        <p className="text-[10px] text-slate-500 mb-2">{room.spaceType}</p>
      )}
      {room.area_m2 && (
        <p className="text-xs text-slate-400 mb-1">
          {room.area_m2.toFixed(0)} m&sup2;
        </p>
      )}
      <div className="flex items-center gap-3 mt-2 text-xs">
        {tempVal !== null && tempVal !== undefined && (
          <span className="flex items-center gap-0.5 text-slate-400">
            <Thermometer className="h-3 w-3 text-rose-400" />
            <span className="font-mono">{tempVal.toFixed(1)}</span>&deg;C
          </span>
        )}
        {humVal !== null && humVal !== undefined && (
          <span className="flex items-center gap-0.5 text-slate-400">
            <Droplets className="h-3 w-3 text-blue-400" />
            <span className="font-mono">{humVal.toFixed(1)}</span>%
          </span>
        )}
        {co2Val !== null && co2Val !== undefined && (
          <span className="flex items-center gap-0.5 text-slate-400">
            <Wind className="h-3 w-3 text-emerald-400" />
            <span className="font-mono">{co2Val.toFixed(0)}</span>ppm
          </span>
        )}
      </div>
    </div>
  );
}

/* ── Environment summary ── */
function EnvSummaryCards({
  points,
  floorName,
}: {
  points: Record<string, SSEPointEvent>;
  floorName: string;
}) {
  const t = useTranslations("topology");
  const floorKey = floorName.toLowerCase();

  const { temps, hums, co2s } = useMemo(() => {
    const temps: number[] = [];
    const hums: number[] = [];
    const co2s: number[] = [];
    for (const [pid, p] of Object.entries(points)) {
      if (!pid.toLowerCase().includes(floorKey)) continue;
      if (p.value === null) continue;
      const lp = pid.toLowerCase();
      if (lp.includes("temp")) temps.push(p.value);
      else if (lp.includes("hum")) hums.push(p.value);
      else if (lp.includes("co2")) co2s.push(p.value);
    }
    return { temps, hums, co2s };
  }, [points, floorKey]);

  const avg = (arr: number[]) =>
    arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

  const envCards = [
    { label: t("envTemp"), value: avg(temps), unit: "\u00B0C", icon: Thermometer, color: "text-rose-400" },
    { label: t("envHum"), value: avg(hums), unit: "%", icon: Droplets, color: "text-blue-400" },
    { label: t("envCO2"), value: avg(co2s), unit: "ppm", icon: Wind, color: "text-emerald-400" },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {envCards.map((ec) => (
        <div
          key={ec.label}
          className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-lg p-3 text-center"
        >
          <ec.icon className={`h-4 w-4 mx-auto mb-1 ${ec.color}`} />
          <p className="text-[10px] text-slate-500">{ec.label}</p>
          <p className="text-lg font-semibold font-mono text-white">
            {ec.value !== null ? ec.value.toFixed(1) : "--"}
          </p>
          <p className="text-[10px] text-slate-500">{ec.unit}</p>
        </div>
      ))}
    </div>
  );
}

/* ── Main component ── */

export function FloorDetailView({
  node,
  deviceStatusMap,
  points,
  devices,
  onSelectEquipment,
}: FloorDetailViewProps) {
  const t = useTranslations("topology");
  const [floorDetails, setFloorDetails] = useState<FloorDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Fetch floor details
  useEffect(() => {
    let cancelled = false;
    setLoadingDetails(true);
    const floorKey = node.name || node.id.split("#").pop() || "";
    getFloorDetails(floorKey)
      .then((data) => {
        if (!cancelled) setFloorDetails(data);
      })
      .catch(() => {
        if (!cancelled) setFloorDetails(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingDetails(false);
      });
    return () => {
      cancelled = true;
    };
  }, [node.id, node.name]);

  // Equipment by category
  const allEquipment = useMemo(() => collectEquipment(node), [node]);
  const grouped = useMemo(() => categorizeEquipment(allEquipment), [allEquipment]);

  return (
    <div className="space-y-6">
      {/* a) Rooms section */}
      {floorDetails && floorDetails.rooms.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-slate-200 mb-3">
            {t("sectionRooms")} ({floorDetails.rooms.length})
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {floorDetails.rooms.map((room) => (
              <RoomCard key={room.id} room={room} points={points} />
            ))}
          </div>
        </div>
      )}

      {/* b) Equipment process flow */}
      <div>
        <h4 className="text-sm font-semibold text-slate-200 mb-3">
          {t("sectionEquipment")} ({allEquipment.length})
        </h4>
        <div className="space-y-4">
          {categories.map((cat) => {
            const items = grouped[cat.key];
            if (!items || items.length === 0) return null;
            return (
              <GroupContainer
                key={cat.key}
                title={t(cat.label)}
                color={cat.color}
                icon={cat.icon}
                count={items.length}
              >
                <div className="flex flex-wrap gap-2">
                  {items.map((eq) => {
                    const isActive =
                      deviceStatusMap[eq.name] ||
                      deviceStatusMap[eq.id] ||
                      false;
                    const isSimulated =
                      eq.name in deviceStatusMap || eq.id in deviceStatusMap;
                    const sensors = countSensors(eq);
                    return (
                      <FlowCard
                        key={eq.id}
                        title={eq.name}
                        subtitle={eq.type}
                        status={
                          !isSimulated
                            ? "normal"
                            : isActive
                            ? "normal"
                            : "critical"
                        }
                        sensorCount={sensors > 0 ? sensors : undefined}
                        onClick={() => onSelectEquipment(eq)}
                        size="md"
                      />
                    );
                  })}
                </div>
              </GroupContainer>
            );
          })}
        </div>
      </div>

      {/* c) Environment summary */}
      <div>
        <h4 className="text-sm font-semibold text-slate-200 mb-3">
          {t("sectionEnvironment")}
        </h4>
        <EnvSummaryCards points={points} floorName={node.name} />
      </div>
    </div>
  );
}

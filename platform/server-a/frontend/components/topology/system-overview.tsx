"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Wind, Zap, Waves, Box } from "lucide-react";
import type { TopologyNode } from "@/lib/api";
import type { SSEPointEvent } from "@/lib/sse";
import { _isEquipmentByLabels } from "./utils";
import { FlowCard } from "./flow-card";
import { GroupContainer } from "./group-container";

interface SystemOverviewProps {
  node: TopologyNode;
  deviceStatusMap: Record<string, boolean>;
  points: Record<string, SSEPointEvent>;
  onSelectNode: (node: TopologyNode) => void;
}

/* ── Category definition ── */
interface Category {
  key: string;
  label: string;
  color: "cyan" | "amber" | "indigo" | "slate";
  icon: React.ComponentType<{ className?: string }>;
  keywords: string[];
}

const categories: Category[] = [
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

/* ── Collect equipment recursively ── */
function collectEquipment(node: TopologyNode): TopologyNode[] {
  const results: TopologyNode[] = [];
  const walk = (n: TopologyNode) => {
    if (_isEquipmentByLabels(n)) results.push(n);
    n.children?.forEach(walk);
  };
  node.children?.forEach(walk);
  return results;
}

/* ── Categorize ── */
function categorize(equips: TopologyNode[]): Record<string, TopologyNode[]> {
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

/* ── Count sensors ── */
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

export function SystemOverview({
  node,
  deviceStatusMap,
  points,
  onSelectNode,
}: SystemOverviewProps) {
  const t = useTranslations("topology");

  const allEquipment = useMemo(() => collectEquipment(node), [node]);
  const grouped = useMemo(() => categorize(allEquipment), [allEquipment]);

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-400">
        {t("systemEquipCount", { count: allEquipment.length })}
      </p>
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
                    onClick={() => onSelectNode(eq)}
                    size="sm"
                  />
                );
              })}
            </div>
          </GroupContainer>
        );
      })}
      {allEquipment.length === 0 && (
        <p className="text-sm text-slate-500 py-4 text-center">
          {t("noChildEquipment")}
        </p>
      )}
    </div>
  );
}

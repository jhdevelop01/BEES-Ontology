"use client";

import { useMemo } from "react";
import { Building2, Layers, ArrowDown } from "lucide-react";
import { useTranslations } from "next-intl";
import type { TopologyNode } from "@/lib/api";
import type { SSEPointEvent } from "@/lib/sse";
import { _isEquipmentByLabels } from "./utils";
import { FlowCard } from "./flow-card";
import { GroupContainer } from "./group-container";
import { FlowConnector } from "./flow-connector";

interface BuildingOverviewProps {
  node: TopologyNode; // GEC_Tower_B root node
  deviceStatusMap: Record<string, boolean>;
  points: Record<string, SSEPointEvent>;
  onSelectFloor: (floorNode: TopologyNode) => void;
}

/* ── Floor name extraction (e.g. "B_10F" → "10F") ── */
function shortFloorName(name: string): string {
  const m = name.match(/B_(.+)/);
  return m ? m[1] : name;
}

/* ── Floor classification ── */
function classifyFloors(children: TopologyNode[]) {
  const upper: TopologyNode[] = [];
  const basement: TopologyNode[] = [];
  const roof: TopologyNode[] = [];

  for (const child of children) {
    const n = child.name.toUpperCase();
    if (n.includes("RF") || n.includes("PH")) {
      roof.push(child);
    } else if (n.includes("B") && /B\d/.test(n)) {
      basement.push(child);
    } else {
      upper.push(child);
    }
  }

  // Sort upper floors descending (10F, 9F, ... 1F)
  upper.sort((a, b) => {
    const an = parseInt(a.name.replace(/\D/g, ""), 10) || 0;
    const bn = parseInt(b.name.replace(/\D/g, ""), 10) || 0;
    return bn - an;
  });

  // Sort basement floors ascending (B1F, B2F, ...)
  basement.sort((a, b) => {
    const an = parseInt(a.name.replace(/\D/g, ""), 10) || 0;
    const bn = parseInt(b.name.replace(/\D/g, ""), 10) || 0;
    return an - bn;
  });

  return { upper, basement, roof };
}

/* ── Count equipment recursively ── */
function countEquipmentAndSensors(
  node: TopologyNode,
  deviceStatusMap: Record<string, boolean>
): { total: number; active: number; sensors: number } {
  let total = 0;
  let active = 0;
  let sensors = 0;

  const walk = (n: TopologyNode) => {
    if (_isEquipmentByLabels(n)) {
      total++;
      const isActive =
        deviceStatusMap[n.name] || deviceStatusMap[n.id] || false;
      if (isActive) active++;
    }
    const tp = n.type.toLowerCase();
    if (tp.includes("sensor") || tp.includes("point")) {
      sensors++;
    }
    n.children?.forEach(walk);
  };
  node.children?.forEach(walk);
  return { total, active, sensors };
}

function ratioToStatus(ratio: number): "normal" | "warning" | "critical" {
  if (ratio > 0.8) return "normal";
  if (ratio > 0.5) return "warning";
  return "critical";
}

export function BuildingOverview({
  node,
  deviceStatusMap,
  points,
  onSelectFloor,
}: BuildingOverviewProps) {
  const t = useTranslations("topology");

  const floors = useMemo(
    () => classifyFloors(node.children ?? []),
    [node.children]
  );

  const renderFloorCards = (floorNodes: TopologyNode[]) => (
    <div className="flex flex-wrap gap-2">
      {floorNodes.map((floor, idx) => {
        const stats = countEquipmentAndSensors(floor, deviceStatusMap);
        const ratio = stats.total > 0 ? stats.active / stats.total : 0;
        return (
          <div key={floor.id} className="flex items-center gap-1">
            <FlowCard
              title={shortFloorName(floor.name)}
              status={ratioToStatus(ratio)}
              activeRatio={ratio}
              equipmentCount={stats.total}
              sensorCount={stats.sensors}
              onClick={() => onSelectFloor(floor)}
              size="sm"
            />
            {idx < floorNodes.length - 1 && (
              <FlowConnector direction="horizontal" />
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Building header */}
      <div className="flex items-center gap-2 mb-2">
        <Building2 className="h-5 w-5 text-cyan-400" />
        <span className="text-white font-semibold">{node.name}</span>
      </div>

      {/* Roof / Mechanical */}
      {floors.roof.length > 0 && (
        <GroupContainer
          title={t("groupRoof")}
          color="emerald"
          icon={Layers}
          count={floors.roof.length}
        >
          {renderFloorCards(floors.roof)}
        </GroupContainer>
      )}

      {floors.roof.length > 0 && floors.upper.length > 0 && (
        <FlowConnector direction="arrow-down" />
      )}

      {/* Upper office floors */}
      {floors.upper.length > 0 && (
        <GroupContainer
          title={t("groupUpperFloors")}
          color="cyan"
          icon={Layers}
          count={floors.upper.length}
        >
          {renderFloorCards(floors.upper)}
        </GroupContainer>
      )}

      {floors.upper.length > 0 && floors.basement.length > 0 && (
        <FlowConnector direction="arrow-down" />
      )}

      {/* Basement mechanical floors */}
      {floors.basement.length > 0 && (
        <GroupContainer
          title={t("groupBasement")}
          color="purple"
          icon={Layers}
          count={floors.basement.length}
        >
          {renderFloorCards(floors.basement)}
        </GroupContainer>
      )}
    </div>
  );
}

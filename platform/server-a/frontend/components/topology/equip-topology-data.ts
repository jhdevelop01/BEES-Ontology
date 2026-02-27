/**
 * Equipment Flow Topology — Data Fetcher
 * Fetches equipment list + topology connections + zone connections from API,
 * groups by system, and delegates to buildFlowLayout.
 */

import type { Node, Edge } from "reactflow";
import {
  getEquipmentList,
  getTopologyConnections,
  getZoneConnections,
  type EquipmentListItem,
} from "@/lib/api";
import type { SSEPointEvent } from "@/lib/sse";
import { detectSystemFromEquip, type SystemKey } from "./cs-utils";
import { buildFlowLayout, SYSTEM_ORDER } from "./equip-topology-layout";

/* ── Types ── */

export interface FlowTopologyResult {
  nodes: Node[];
  edges: Edge[];
  systemStats: Record<
    SystemKey,
    { count: number; active: number; avgOp: number }
  >;
  zoneCount: number;
  levelCount: number;
}

/* ── Primary equipment filter ── */

const PRIMARY_EQUIP_RE =
  /ahu|fcu|vav|doas|cc_panel|chiller|boiler|cooling_tower|heat_exchanger|pump|exhaust_fan|supply_fan|return_fan|transformer|ups|switchgear|emergency_gen|solar|pv_system|distribution_header/i;

const EXCLUDE_RE =
  /elevator|escalator|sewage|wastewater|rainwater|water_supply|controller|boiler_plant|toilet_exhaust|kitchen_exhaust|fcu_group/i;

function isPrimaryByBrickClass(item: EquipmentListItem): boolean {
  const combined = (
    item.name +
    " " +
    item.type +
    " " +
    item.brick_class.join(" ")
  ).toLowerCase();
  if (EXCLUDE_RE.test(combined)) return false;
  return PRIMARY_EQUIP_RE.test(combined);
}

/* ── Prefix stripping ── */

function stripPrefix(name: string): string {
  return name.startsWith("bldg:") ? name.slice(5) : name;
}

/* ── Fetch + build ── */

export async function fetchFlowTopologyElements(
  deviceStatusMap: Record<string, boolean>,
  points: Record<string, SSEPointEvent>,
): Promise<FlowTopologyResult> {
  const [equipRes, connRes, zoneRes] = await Promise.all([
    getEquipmentList(),
    getTopologyConnections(),
    getZoneConnections(),
  ]);

  // 1. Filter primary equipment
  const primary = equipRes.items.filter(isPrimaryByBrickClass);

  // 2. Group by system
  const equipBySystem = new Map<SystemKey, EquipmentListItem[]>();
  for (const sys of SYSTEM_ORDER) equipBySystem.set(sys, []);

  for (const item of primary) {
    const name = stripPrefix(item.name);
    const system = detectSystemFromEquip(name, item.brick_class);
    equipBySystem.get(system)!.push({ ...item, name });
  }

  // 3. Build layout (with zone data)
  const { nodes, edges, levelCount } = buildFlowLayout(
    equipBySystem,
    connRes.connections,
    zoneRes.count > 0 ? zoneRes : null,
    deviceStatusMap,
    points,
  );

  // 4. Calculate system stats
  const systemStats = {} as Record<
    SystemKey,
    { count: number; active: number; avgOp: number }
  >;

  for (const [sys, items] of Array.from(equipBySystem.entries())) {
    const active = items.filter(
      (i) =>
        deviceStatusMap[i.name] ??
        deviceStatusMap[`bldg:${i.name}`] ??
        true,
    ).length;
    systemStats[sys as SystemKey] = {
      count: items.length,
      active,
      avgOp:
        items.length > 0 ? Math.round((active / items.length) * 100) : 0,
    };
  }

  return { nodes, edges, systemStats, zoneCount: zoneRes.count, levelCount };
}

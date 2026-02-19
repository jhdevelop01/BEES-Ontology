/**
 * Cross-Section Topology — Utility Functions
 * Floor inference, equipment classification, system detection, tree walking
 */

import type { TopologyNode } from "@/lib/api";
import type { SSEPointEvent } from "@/lib/sse";
import { _isEquipmentByLabels } from "./utils";

/* ── Floor Ordering (RF at top, B4F at bottom) ── */

export const FLOOR_ORDER: string[] = [
  "B_RF",
  "B_15F", "B_14F", "B_13F", "B_12F", "B_11F", "B_10F",
  "B_9F", "B_8F", "B_7F", "B_6F", "B_5F",
  "B_3F", "B_2F", "B_1F",
  "B_B1F", "B_B2F", "B_B3F", "B_B4F",
];

/* ── Floor Zone Classification ── */

export type FloorZone = "roof" | "office" | "podium" | "basement";

export function getFloorZone(floorKey: string): FloorZone {
  const u = floorKey.toUpperCase();
  if (u.includes("RF") || u.includes("PH")) return "roof";
  if (/B_B\d/.test(u)) return "basement";
  const num = parseInt(u.replace(/\D/g, ""), 10) || 0;
  if (num <= 3) return "podium";
  return "office";
}

export const ZONE_COLORS: Record<FloorZone, string> = {
  roof: "rgb(52,211,153)",     // emerald
  office: "rgb(34,211,238)",   // cyan
  podium: "rgb(251,191,36)",   // amber
  basement: "rgb(168,85,247)", // purple
};

/* ── System Colors ── */

export const SYSTEM_COLORS = {
  chw:  { css: "rgb(34,211,238)",  key: "chw"  as const, label: "CHW",  flowLabel: "냉수" },
  hw:   { css: "rgb(251,113,133)", key: "hw"   as const, label: "HW",   flowLabel: "온수" },
  cw:   { css: "rgb(129,140,248)", key: "cw"   as const, label: "CW",   flowLabel: "냉각수" },
  elec: { css: "rgb(251,191,36)",  key: "elec" as const, label: "ELEC", flowLabel: "전력" },
  air:  { css: "rgb(148,163,184)", key: "air"  as const, label: "AIR",  flowLabel: "공기" },
} as const;

export type SystemKey = keyof typeof SYSTEM_COLORS;

/* ── Equipment Category Classification ── */

export type EquipCategory = "hvac" | "electrical" | "plumbing" | "fire" | "transport" | "other";

const CATEGORY_DEFS: { key: EquipCategory; match: RegExp; label: string; color: string }[] = [
  { key: "hvac",       match: /ahu|fcu|vav|chiller|boiler|cooling_tower|heat_exchanger|fan|damper|doas|cc_panel|cc_pump|diffuser|air_curtain/i, label: "HVAC",  color: "rgb(34,211,238)" },
  { key: "electrical",  match: /transformer|ups|switchgear|generator|panel|meter|inverter|solar|pv|lightning/i,                                  label: "전기",  color: "rgb(251,191,36)" },
  { key: "plumbing",    match: /pump|valve|tank|water|sewage|grease|rain|waste|pressure/i,                                                       label: "배관",  color: "rgb(129,140,248)" },
  { key: "fire",        match: /fire|sprinkler|hydrant|smoke/i,                                                                                  label: "소방",  color: "rgb(239,68,68)" },
  { key: "transport",   match: /elevator|escalator|vertical/i,                                                                                   label: "수송",  color: "rgb(168,85,247)" },
];

export const CATEGORY_INFO: Record<EquipCategory, { label: string; color: string }> = {
  hvac:       { label: "HVAC",  color: "rgb(34,211,238)" },
  electrical: { label: "전기",  color: "rgb(251,191,36)" },
  plumbing:   { label: "배관",  color: "rgb(129,140,248)" },
  fire:       { label: "소방",  color: "rgb(239,68,68)" },
  transport:  { label: "수송",  color: "rgb(168,85,247)" },
  other:      { label: "기타",  color: "rgb(148,163,184)" },
};

export function categorizeEquipment(name: string, labels: string[]): EquipCategory {
  const combined = (name + " " + labels.join(" ")).toLowerCase();
  for (const def of CATEGORY_DEFS) {
    if (def.match.test(combined)) return def.key;
  }
  return "other";
}

/* ── Detect System From Equipment ── */

export function detectSystemFromEquip(name: string, labels: string[]): SystemKey {
  const combined = (name + " " + labels.join(" ")).toLowerCase();
  if (/chw|chill|chilled/.test(combined)) return "chw";
  if (/\bhw\b|hot_water|boiler|heating/.test(combined)) return "hw";
  if (/\bcw\b|cooling_tower|condenser/.test(combined)) return "cw";
  if (/transformer|ups|switchgear|generator|solar|pv|inverter|meter|panel|power/.test(combined)) return "elec";
  return "air";
}

/* ── Infer Floor From Equipment Name ── */

export function inferFloorFromName(name: string): string | null {
  // Match basement floors: B1F, B2F, B3F, B4F
  const bm = name.match(/[_-](B(\d))F/i);
  if (bm) return `B_B${bm[2]}F`;

  // Match RF (rooftop)
  if (/_RF(?:[_]|$)/i.test(name) || /[_-]RF[_-]/i.test(name)) return "B_RF";
  if (name.endsWith("_RF")) return "B_RF";

  // Match numbered floors: 5F, 10F, 15F
  const fm = name.match(/[_-](\d{1,2})F/i);
  if (fm) {
    const num = parseInt(fm[1], 10);
    if (num >= 1 && num <= 20) return `B_${num}F`;
  }

  return null;
}

/* ── Short Display Name for Equipment ── */

export function shortEquipName(name: string): string {
  return name
    .replace(/_/g, " ")
    .replace(/\bGroup\b/gi, "Grp")
    .replace(/\bSystem\b/gi, "Sys");
}

/* ── Short Floor Name ── */

export function shortFloorName(floorKey: string): string {
  const m = floorKey.match(/^B_(.+)$/);
  return m ? m[1] : floorKey;
}

/* ── Collect ALL Equipment From Entire Tree (deep walk) ── */

export interface EquipWithFloor {
  equip: TopologyNode;
  floor: string | null;
}

export function collectAllEquipment(tree: TopologyNode): EquipWithFloor[] {
  const result: EquipWithFloor[] = [];

  const walk = (node: TopologyNode) => {
    if (_isEquipmentByLabels(node)) {
      const floor = inferFloorFromName(node.name);
      result.push({ equip: node, floor });
    }
    node.children?.forEach(walk);
  };

  tree.children?.forEach(walk);
  return result;
}

/* ── Collect Floor Nodes ── */

export function collectFloors(building: TopologyNode): TopologyNode[] {
  return (building.children ?? []).filter((c) => {
    const t = c.type.toLowerCase();
    return t.includes("floor") || t.includes("story");
  });
}

/* ── Collect Zones From a Floor Node ── */

export function collectZones(floorNode: TopologyNode): TopologyNode[] {
  return (floorNode.children ?? []).filter((c) => {
    const t = (c.type + " " + (c.labels?.join(" ") ?? "")).toLowerCase();
    return t.includes("zone");
  });
}

/* ── Count Rooms in a Floor ── */

export function countRooms(floorNode: TopologyNode): number {
  let count = 0;
  const walk = (n: TopologyNode) => {
    const t = (n.type + " " + (n.labels?.join(" ") ?? "")).toLowerCase();
    if (t.includes("room") || t.includes("space")) count++;
    n.children?.forEach(walk);
  };
  floorNode.children?.forEach(walk);
  return count;
}

/* ── Count Sensor Points for an Equipment ── */

export function countSensors(
  equipName: string,
  points: Record<string, SSEPointEvent>,
): number {
  const prefix = `bldg:${equipName}_`;
  return Object.keys(points).filter((k) => k.startsWith(prefix)).length;
}

/* ── Compute Operation Percentage ── */

export function computeOperationPct(
  equipName: string,
  points: Record<string, SSEPointEvent>,
  isActive: boolean,
): number {
  if (!isActive) return 0;
  const prefix = `bldg:${equipName}_`;
  const sensors = Object.entries(points).filter(([k]) => k.startsWith(prefix));
  if (sensors.length === 0) return isActive ? 100 : 0;
  const reporting = sensors.filter(([, p]) => p.value !== null).length;
  return Math.round((reporting / sensors.length) * 100);
}

/* ── Primary Equipment Filter (skip components/minor items) ── */

const PRIMARY_EQUIP_RE = /ahu|fcu|vav|doas|cc_panel|chiller|boiler|cooling_tower|heat_exchanger|pump|exhaust_fan|supply_fan|return_fan|transformer|ups|switchgear|emergency_gen|solar|pv_system|elevator/i;

export function isPrimaryEquipment(node: TopologyNode): boolean {
  const s = (node.name + " " + node.type + " " + (node.labels?.join(" ") ?? "")).toLowerCase();
  // Skip points, sensors, zones, rooms
  if (/sensor|command|setpoint|_status|_mode|room|floor|zone|building|site/i.test(node.type)) return false;
  // Match primary equipment patterns
  return PRIMARY_EQUIP_RE.test(s);
}

/* ── Default Floor Assignment for Unplaced Equipment ── */

export function defaultFloorForEquip(name: string, labels: string[]): string {
  const combined = (name + " " + labels.join(" ")).toLowerCase();
  // Rooftop: cooling towers, solar
  if (/cooling_tower|solar|pv/.test(combined)) return "B_RF";
  // Basement plant: chillers, boilers, pumps, HX, transformers, UPS, generators
  if (/chiller|boiler|chw_pump|hw_pump|cw_pump|cc_pump|heat_exchanger/.test(combined)) return "B_B1F";
  if (/transformer|ups|switchgear|emergency_gen|doas|distribution_panel/.test(combined)) return "B_B1F";
  // Pumps (general)
  if (/pump/.test(combined)) return "B_B1F";
  // Elevators → 1F (lobby)
  if (/elevator/.test(combined)) return "B_1F";
  // Exhaust/supply fans without floor → B1F
  if (/fan/.test(combined)) return "B_B1F";
  return "__COMMON__";
}

/* ── Short Zone Name ── */

export function shortZoneName(name: string): string {
  if (/interior/i.test(name)) return "Interior";
  if (/perimeter.*east/i.test(name)) return "PE";
  if (/perimeter.*west/i.test(name)) return "PW";
  if (/perimeter.*north/i.test(name)) return "PN";
  if (/perimeter.*south/i.test(name)) return "PS";
  // Strip floor prefix
  const m = name.match(/B_\d+F_(.+)/);
  if (m) return m[1].replace(/_/g, " ").slice(0, 12);
  return name.replace(/_/g, " ").slice(0, 12);
}

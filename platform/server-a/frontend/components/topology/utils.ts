import { Building2, Layers, MapPin, Cpu } from "lucide-react";
import type { TopologyNode } from "@/lib/api";

/* ── Type icon mapping ── */

export function getTypeIcon(type: string) {
  const t = type.toLowerCase();
  if (t.includes("building")) return Building2;
  if (t.includes("floor") || t.includes("story")) return Layers;
  if (t.includes("zone") || t.includes("room") || t.includes("space"))
    return MapPin;
  return Cpu;
}

export function getTypeLabel(type: string): string {
  const t = type.toLowerCase();
  if (t.includes("building")) return "typeBuilding";
  if (t.includes("floor") || t.includes("story")) return "typeFloor";
  if (t.includes("zone") || t.includes("room") || t.includes("space"))
    return "typeZone";
  if (t.includes("system")) return "typeSystem";
  if (t.includes("sensor")) return "typeSensor";
  return "typeEquipment";
}

/* ── Topology node ID → monitoring page ID ── */

export function toMonitoringId(nodeId: string): string {
  if (nodeId.includes("#")) {
    return "bldg:" + nodeId.split("#").pop();
  }
  if (nodeId.startsWith("bldg:")) return nodeId;
  return "bldg:" + nodeId;
}

/* ── Component / Equipment classification ── */

export const COMPONENT_LABELS = new Set(["actuator", "condenser", "compressor"]);

export const EQUIPMENT_KEYWORDS = [
  "equipment", "ahu", "pump", "chiller", "fan", "vav", "fcu", "boiler",
  "cooling_tower", "heat_exchanger", "elevator", "transformer", "ups",
  "switchgear", "emergency_generator", "water_pump", "vfd", "valve", "damper",
  "controller", "lighting", "meter", "panel", "system", "plant", "server",
  "solar", "inverter", "generator", "tank", "fire", "sprinkler", "cctv",
  "access_control", "intercom", "parking", "bms", "dali", "dsf", "shelf",
];

export function _isEquipmentByLabels(node: TopologyNode): boolean {
  const tp = node.type.toLowerCase();
  if (["point", "sensor", "zone", "location", "building", "floor", "site"].includes(tp)) return false;

  if (node.labels) {
    const isPointOrRoom = node.labels.some((l) => {
      const ll = l.toLowerCase();
      return (
        ll.includes("sensor") || ll.includes("command") || ll.includes("setpoint") ||
        ll.includes("_status") || ll.includes("_mode") || ll.includes("room")
      );
    });
    if (isPointOrRoom) return false;
  }

  if (EQUIPMENT_KEYWORDS.some(kw => tp.includes(kw))) return true;
  if (node.labels) {
    return node.labels.some(l => {
      const ll = l.toLowerCase();
      return ll !== "resource" && EQUIPMENT_KEYWORDS.some(kw => ll.includes(kw));
    });
  }
  return false;
}

export function isComponentNode(node: TopologyNode): boolean {
  if (!node.labels) return false;
  return node.labels.some(l => COMPONENT_LABELS.has(l.toLowerCase()));
}

/**
 * Equipment Flow Topology — Layout Engine (v3: Global DAG)
 * Builds ReactFlow nodes/edges from a unified Global DAG.
 * All equipment in a single DAG (inter+intra system), no group boxes.
 * Level-based column layout with system color accents.
 */

import { MarkerType, type Node, type Edge } from "reactflow";
import type {
  EquipmentListItem,
  TopologyConnection,
  ZoneConnectionsResponse,
} from "@/lib/api";
import type { SSEPointEvent } from "@/lib/sse";
import type { FlowEquipData, ZoneNodeData, LevelLabelData } from "./equip-topology-nodes";
import {
  detectSystemFromEquip,
  shortEquipName,
  countSensors,
  computeOperationPct,
  SYSTEM_COLORS,
  type SystemKey,
} from "./cs-utils";

/* ── Dimension Constants ── */

export const CARD_W = 260;
export const CARD_H = 90;
export const CARD_GAP_V = 14;
export const LEVEL_GAP_X = 320;     // column spacing (card 260 + 60px gap)
export const SYSTEM_GAP_Y = 40;     // extra gap between systems in same level
export const CANVAS_PAD_X = 60;     // left canvas padding
export const CANVAS_PAD_Y = 60;     // top canvas padding (below level labels)
export const LEVEL_HEADER_H = 40;   // level label height

/* Zone layout constants */
const ZONE_NODE_W = 180;
const ZONE_NODE_H = 50;

/* ── System Layout Order & Priority ── */

export const SYSTEM_ORDER: SystemKey[] = ["cw", "chw", "hw", "air", "elec"];
const SYSTEM_PRIORITY: Record<SystemKey, number> = { cw: 0, chw: 1, hw: 2, air: 3, elec: 4 };

/* ── Level Display Labels ── */

const LEVEL_LABELS: Record<number, { ko: string; en: string }> = {
  0: { ko: "소스", en: "Source" },
  1: { ko: "1차", en: "Primary" },
  2: { ko: "분배", en: "Distribution" },
  3: { ko: "말단", en: "Terminal" },
  4: { ko: "공급", en: "Delivery" },
  999: { ko: "독립", en: "Isolated" },
};

function getLevelLabel(level: number): string {
  const entry = LEVEL_LABELS[level];
  if (entry) return `L${level} ${entry.ko}`;
  return `Level ${level}`;
}

/* ── Helpers ── */

function stripPrefix(name: string): string {
  return name.startsWith("bldg:") ? name.slice(5) : name;
}

function deriveStatusLabel(
  isActive: boolean,
  opPct: number,
): "NORMAL" | "WARNING" | "STOP" {
  if (!isActive) return "STOP";
  if (opPct < 50) return "WARNING";
  return "NORMAL";
}

/* ── Global DAG Types & Functions ── */

interface GlobalDAGNode {
  id: string;
  level: number;
  children: Set<string>;
  parents: Set<string>;
}

/**
 * Build a single Global DAG from ALL equipment and ALL feeds connections.
 * Unlike the old buildSystemDAG, this includes inter-system connections.
 */
function buildGlobalDAG(
  allEquipment: EquipmentListItem[],
  connections: TopologyConnection[],
): Map<string, GlobalDAGNode> {
  const dag = new Map<string, GlobalDAGNode>();
  const nameSet = new Set(allEquipment.map((e) => e.name));

  for (const item of allEquipment) {
    dag.set(item.name, {
      id: item.name,
      level: -1,
      children: new Set(),
      parents: new Set(),
    });
  }

  // Step 1: Build full adjacency from ALL feeds (including non-primary nodes)
  const fullAdj = new Map<string, Set<string>>();
  for (const conn of connections) {
    if (conn.rel_type !== "feeds") continue;
    const src = stripPrefix(conn.source);
    const tgt = stripPrefix(conn.target);
    if (!fullAdj.has(src)) fullAdj.set(src, new Set());
    fullAdj.get(src)!.add(tgt);
  }

  // Step 2: Direct primary→primary edges
  for (const [src, targets] of Array.from(fullAdj.entries())) {
    if (!nameSet.has(src)) continue;
    for (const tgt of Array.from(targets)) {
      if (!nameSet.has(tgt)) continue;
      dag.get(src)!.children.add(tgt);
      dag.get(tgt)!.parents.add(src);
    }
  }

  // Step 3: Contract non-primary intermediaries via BFS
  // For each primary node, BFS through non-primary nodes to find reachable primaries
  for (const primarySrc of Array.from(nameSet)) {
    const directTargets = fullAdj.get(primarySrc);
    if (!directTargets) continue;

    // Collect non-primary direct targets as BFS seeds
    const queue: string[] = [];
    const visited = new Set<string>();
    for (const tgt of Array.from(directTargets)) {
      if (!nameSet.has(tgt)) {
        queue.push(tgt);
        visited.add(tgt);
      }
    }

    // BFS through non-primary nodes
    while (queue.length > 0) {
      const current = queue.shift()!;
      const nextTargets = fullAdj.get(current);
      if (!nextTargets) continue;

      for (const next of Array.from(nextTargets)) {
        if (nameSet.has(next)) {
          // Reached a primary node — add contracted edge
          if (next !== primarySrc) {
            dag.get(primarySrc)!.children.add(next);
            dag.get(next)!.parents.add(primarySrc);
          }
        } else if (!visited.has(next)) {
          // Another non-primary — continue BFS
          visited.add(next);
          queue.push(next);
        }
      }
    }
  }

  return dag;
}

/**
 * BFS level assignment: roots (no parents) = level 0,
 * each child gets max(current, parent+1).
 * Isolated nodes (no edges) → level 999.
 */
function assignGlobalLevels(dag: Map<string, GlobalDAGNode>): void {
  const queue: string[] = [];

  for (const [id, node] of Array.from(dag.entries())) {
    if (node.parents.size === 0 && node.children.size > 0) {
      node.level = 0;
      queue.push(id);
    }
  }

  // BFS
  const visited = new Set<string>();
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);

    const currentLevel = dag.get(current)!.level;
    for (const childId of Array.from(dag.get(current)!.children)) {
      const child = dag.get(childId)!;
      if (child.level < currentLevel + 1) {
        child.level = currentLevel + 1;
        queue.push(childId);
      }
    }
  }

  // Roots without children (truly isolated) → level 999
  // Also nodes never visited with parents (cycles?) → 999
  for (const node of Array.from(dag.values())) {
    if (node.level === -1) node.level = 999;
  }
}

/**
 * Sort items within a level: by system priority, then alphabetically.
 */
function sortWithinLevel(
  items: { item: EquipmentListItem; systemKey: SystemKey }[],
): { item: EquipmentListItem; systemKey: SystemKey }[] {
  return items.sort((a, b) => {
    const sp = SYSTEM_PRIORITY[a.systemKey] - SYSTEM_PRIORITY[b.systemKey];
    if (sp !== 0) return sp;
    return a.item.name.localeCompare(b.item.name);
  });
}

/* ── Main Layout Builder ── */

export function buildFlowLayout(
  equipBySystem: Map<SystemKey, EquipmentListItem[]>,
  connections: TopologyConnection[],
  zoneData: ZoneConnectionsResponse | null,
  deviceStatusMap: Record<string, boolean>,
  points: Record<string, SSEPointEvent>,
): { nodes: Node[]; edges: Edge[]; levelCount: number } {
  // 1. Flatten all equipment with system info
  const allEquipment: EquipmentListItem[] = [];
  const equipSystemMap = new Map<string, SystemKey>();

  for (const sysKey of SYSTEM_ORDER) {
    const items = equipBySystem.get(sysKey) ?? [];
    for (const item of items) {
      allEquipment.push(item);
      equipSystemMap.set(item.name, sysKey);
    }
  }

  // 2. Build Global DAG
  const dag = buildGlobalDAG(allEquipment, connections);
  assignGlobalLevels(dag);

  // 3. Group items by level
  const levelGroups = new Map<number, { item: EquipmentListItem; systemKey: SystemKey }[]>();
  for (const item of allEquipment) {
    const level = dag.get(item.name)?.level ?? 999;
    const sys = equipSystemMap.get(item.name) ?? "air";
    if (!levelGroups.has(level)) levelGroups.set(level, []);
    levelGroups.get(level)!.push({ item, systemKey: sys });
  }

  // Sort levels (999 last)
  const sortedLevels = Array.from(levelGroups.keys()).sort((a, b) => a - b);
  const levelCount = sortedLevels.filter((l) => l !== 999).length;

  // 4. Sort within each level
  for (const level of sortedLevels) {
    levelGroups.set(level, sortWithinLevel(levelGroups.get(level)!));
  }

  // 5. Build nodes
  const equipCardNodes: Node[] = [];
  const levelLabelNodes: Node[] = [];
  const zoneNodes: Node[] = [];
  const placedEquipNames = new Set<string>();

  // Track Y positions for zone placement
  const equipYMap = new Map<string, number>();

  for (let li = 0; li < sortedLevels.length; li++) {
    const level = sortedLevels[li];
    const levelItems = levelGroups.get(level)!;
    const xPos = CANVAS_PAD_X + li * LEVEL_GAP_X;

    // Level label node
    levelLabelNodes.push({
      id: `level-label-${level}`,
      type: "levelLabel",
      position: { x: xPos, y: 10 },
      data: {
        level,
        label: getLevelLabel(level),
        count: levelItems.length,
      } satisfies LevelLabelData,
      draggable: false,
      selectable: false,
      style: { width: CARD_W, height: LEVEL_HEADER_H },
    });

    // Place equipment cards
    let yPos = CANVAS_PAD_Y;
    let prevSystem: SystemKey | null = null;

    for (const { item, systemKey } of levelItems) {
      // Add system gap
      if (prevSystem !== null && prevSystem !== systemKey) {
        yPos += SYSTEM_GAP_Y;
      }
      prevSystem = systemKey;

      const equipName = item.name;
      const isActive =
        deviceStatusMap[equipName] ??
        deviceStatusMap[`bldg:${equipName}`] ??
        true;
      const sensorCnt = countSensors(equipName, points);
      const opPct = computeOperationPct(equipName, points, isActive);
      const isIsolated = level === 999;

      placedEquipNames.add(equipName);
      equipYMap.set(equipName, yPos);

      equipCardNodes.push({
        id: equipName,
        type: "flowEquipCard",
        position: { x: xPos, y: yPos },
        // NO parentNode — direct canvas placement
        data: {
          name: equipName,
          displayName: shortEquipName(equipName),
          equipId: `bldg:${equipName}`,
          type: item.type,
          labels: item.brick_class,
          systemKey,
          systemColor: SYSTEM_COLORS[systemKey].css,
          isActive,
          operationPct: opPct,
          sensorCount: sensorCnt,
          statusLabel: deriveStatusLabel(isActive, opPct),
          isIsolated,
          highlightState: "none",
          alarmSeverity: null,
        } satisfies FlowEquipData,
        style: { width: CARD_W, height: CARD_H },
        draggable: false,
      });

      yPos += CARD_H + CARD_GAP_V;
    }
  }

  // 6. Build Zone Nodes (rightmost column)
  const zoneEdges: Edge[] = [];
  if (zoneData && zoneData.zones.length > 0) {
    const rightmostX = CANVAS_PAD_X + sortedLevels.length * LEVEL_GAP_X;

    // Map zone to feeding equipment for Y positioning
    const zoneEquipMap = new Map<string, string[]>(); // zoneName → [equipName, ...]
    for (const conn of zoneData.connections) {
      if (conn.rel_type !== "feeds") continue;
      const src = stripPrefix(conn.source);
      const tgt = stripPrefix(conn.target);
      if (!placedEquipNames.has(src)) continue;
      if (!zoneEquipMap.has(tgt)) zoneEquipMap.set(tgt, []);
      zoneEquipMap.get(tgt)!.push(src);
    }

    for (const zone of zoneData.zones) {
      const zoneName = stripPrefix(zone.name);
      const feedingEquip = zoneEquipMap.get(zoneName) ?? [];

      // Y position = average Y of connected equipment, or sequential
      let yPos = CANVAS_PAD_Y;
      if (feedingEquip.length > 0) {
        const ySum = feedingEquip.reduce((sum, eq) => sum + (equipYMap.get(eq) ?? 0), 0);
        yPos = Math.round(ySum / feedingEquip.length);
      }

      const displayName = zoneName
        .replace(/_/g, " ")
        .replace(/\bB\s+\d+F\s+/i, "")
        .slice(0, 20);

      // Detect system from connected equipment
      const sys: SystemKey = feedingEquip.length > 0
        ? (equipSystemMap.get(feedingEquip[0]) ?? "air")
        : "air";

      zoneNodes.push({
        id: `zone-${zoneName}`,
        type: "zoneNode",
        position: { x: rightmostX, y: yPos },
        data: {
          name: zoneName,
          displayName,
          floor: zone.floor,
          connectedEquipCount: zone.connected_equipment_count,
          systemKey: sys,
          systemColor: SYSTEM_COLORS[sys].css,
        } satisfies ZoneNodeData,
        style: { width: ZONE_NODE_W, height: ZONE_NODE_H },
        hidden: true,
        draggable: false,
      });
    }

    // Build zone edges
    let zoneEdgeIdx = 0;
    for (const conn of zoneData.connections) {
      if (conn.rel_type !== "feeds") continue;
      const src = stripPrefix(conn.source);
      const tgt = stripPrefix(conn.target);
      if (!placedEquipNames.has(src)) continue;

      const srcSys = equipSystemMap.get(src) ?? "air";

      zoneEdges.push({
        id: `zone-edge-${zoneEdgeIdx++}`,
        source: src,
        target: `zone-${tgt}`,
        type: "smoothstep",
        animated: false,
        hidden: true,
        style: {
          stroke: "rgba(148,163,184,0.4)",
          strokeWidth: 1.5,
          strokeDasharray: "6 3",
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 12,
          height: 12,
          color: `${SYSTEM_COLORS[srcSys].css}80`,
        },
        data: { isZoneEdge: true },
      });
    }
  }

  // 7. Build Equipment Edges (with arrows!)
  const allEdges: Edge[] = [];
  let edgeIdx = 0;

  for (const conn of connections) {
    if (conn.rel_type !== "feeds") continue;
    const src = stripPrefix(conn.source);
    const tgt = stripPrefix(conn.target);
    if (!placedEquipNames.has(src) || !placedEquipNames.has(tgt)) continue;

    const srcSys = equipSystemMap.get(src)!;
    const tgtSys = equipSystemMap.get(tgt)!;
    const isInterSystem = srcSys !== tgtSys;
    const edgeId = `eq-edge-${edgeIdx++}`;

    if (isInterSystem) {
      allEdges.push({
        id: edgeId,
        source: src,
        target: tgt,
        type: "smoothstep",
        animated: true,
        className: `inter-system-edge flow-edge-${srcSys}`,
        style: {
          stroke: SYSTEM_COLORS[srcSys].css,
          strokeWidth: 3,
          strokeOpacity: 0.9,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 16,
          height: 16,
          color: SYSTEM_COLORS[srcSys].css,
        },
        label: SYSTEM_COLORS[srcSys].flowLabel,
        labelStyle: {
          fill: SYSTEM_COLORS[srcSys].css,
          fontSize: 10,
          fontFamily: "monospace",
        },
        labelBgStyle: { fill: "rgba(10,14,26,0.85)" },
        labelBgPadding: [6, 3] as [number, number],
        labelBgBorderRadius: 6,
      });
    } else {
      allEdges.push({
        id: edgeId,
        source: src,
        target: tgt,
        type: "smoothstep",
        animated: true,
        className: `intra-system-edge flow-edge-${srcSys}`,
        style: {
          stroke: SYSTEM_COLORS[srcSys].css,
          strokeWidth: 2,
          strokeOpacity: 0.6,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 12,
          height: 12,
          color: SYSTEM_COLORS[srcSys].css,
        },
      });
    }
  }

  allEdges.push(...zoneEdges);

  // Level labels first, then equipment cards, then zones
  const allNodes = [...levelLabelNodes, ...equipCardNodes, ...zoneNodes];

  return { nodes: allNodes, edges: allEdges, levelCount };
}

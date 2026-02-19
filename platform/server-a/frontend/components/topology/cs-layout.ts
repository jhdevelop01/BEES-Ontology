/**
 * Cross-Section Topology — Layout Engine
 * Positions floor bands, equipment cards, zone chips, and edges
 * for a building cross-section view.
 */

import type { Node, Edge } from "reactflow";
import type { TopologyNode, TopologyConnection } from "@/lib/api";
import type { SSEPointEvent } from "@/lib/sse";
import {
  FLOOR_ORDER,
  type FloorZone,
  type EquipCategory,
  type SystemKey,
  getFloorZone,
  shortFloorName,
  shortEquipName,
  shortZoneName,
  collectAllEquipment,
  isPrimaryEquipment,
  inferFloorFromName,
  collectFloors,
  collectZones,
  countRooms,
  countSensors,
  computeOperationPct,
  categorizeEquipment,
  detectSystemFromEquip,
  defaultFloorForEquip,
  SYSTEM_COLORS,
} from "./cs-utils";
import type { FloorBandData } from "./cs-nodes";
import type { CompactEquipData, ZoneChipData } from "./cs-nodes";
import { buildCrossSectionEdges } from "./cs-edges";

/* ── Dimensions ── */

const FLOOR_BAND_W = 2200;
const FLOOR_HEADER_W = 260;
const FLOOR_MIN_H = 220;
const FLOOR_PAD = 32;
const FLOOR_GAP = 18;
const EQUIP_W = 380;
const EQUIP_H = 140;
const EQUIP_GAP_H = 20;
const EQUIP_GAP_V = 18;
const ZONE_CHIP_W = 180;
const ZONE_CHIP_H = 64;
const ZONE_GAP = 14;
const CAT_LABEL_H = 36;
const MAX_EQUIP_PER_ROW = 4;

/* ── Category layout order ── */

const CATEGORY_ORDER: EquipCategory[] = [
  "hvac", "electrical", "plumbing", "fire", "transport", "other",
];

/* ── Internal types ── */

interface PlacedEquip {
  equip: TopologyNode;
  category: EquipCategory;
  systemKey: SystemKey;
}

interface FloorLayout {
  floorKey: string;
  displayName: string;
  zone: FloorZone;
  equipList: PlacedEquip[];
  zones: TopologyNode[];
  roomCount: number;
  bandHeight: number;
}

/* ── Main Layout Builder ── */

export function buildCrossSectionLayout(
  tree: TopologyNode[],
  connections: TopologyConnection[],
  deviceStatusMap: Record<string, boolean>,
  points: Record<string, SSEPointEvent>,
): { nodes: Node[]; edges: Edge[] } {
  const rfNodes: Node[] = [];

  if (!tree.length) return { nodes: [], edges: [] };
  const building = tree[0];

  // 1. Collect floor nodes from building
  const floorNodes = collectFloors(building);
  const floorMap = new Map<string, TopologyNode>();
  for (const fn of floorNodes) {
    floorMap.set(fn.name, fn);
  }

  // 2. Collect ALL equipment from entire tree (primary only)
  const allEquip = collectAllEquipment(building).filter((e) =>
    isPrimaryEquipment(e.equip)
  );

  // 3. Build zone→floor lookup from floor children (for feeds inference)
  const childToFloor = new Map<string, string>();
  for (const fn of floorNodes) {
    const walkChildren = (n: TopologyNode) => {
      childToFloor.set(n.name, fn.name);
      n.children?.forEach(walkChildren);
    };
    fn.children?.forEach(walkChildren);
  }

  // 4. Build feeds-based floor inference: equipment → most-served floor
  const feedsFloorVotes = new Map<string, Map<string, number>>();
  for (const conn of connections) {
    if (conn.rel_type !== "feeds") continue;
    // Try to find target's floor
    let tgtFloor = childToFloor.get(conn.target) ?? null;
    if (!tgtFloor) tgtFloor = inferFloorFromName(conn.target);
    if (tgtFloor && FLOOR_ORDER.includes(tgtFloor)) {
      if (!feedsFloorVotes.has(conn.source)) feedsFloorVotes.set(conn.source, new Map());
      const votes = feedsFloorVotes.get(conn.source)!;
      votes.set(tgtFloor, (votes.get(tgtFloor) || 0) + 1);
    }
  }

  // 5. Group equipment by floor (name → default-for-known → feeds → __COMMON__)
  //    Also deduplicate by name
  const floorEquipMap = new Map<string, PlacedEquip[]>();
  const seenNames = new Set<string>();

  for (const { equip, floor } of allEquip) {
    // Deduplicate
    if (seenNames.has(equip.name)) continue;
    seenNames.add(equip.name);

    let fk = floor;

    // Step 1: Try name-based inference
    // (already done by collectAllEquipment)

    // Step 2: Try default for known types (chillers → B1F, CT → RF, etc.)
    if (!fk || !FLOOR_ORDER.includes(fk)) {
      const dflt = defaultFloorForEquip(equip.name, equip.labels ?? []);
      if (dflt !== "__COMMON__") {
        fk = dflt;
      }
    }

    // Step 3: Try feeds-based inference (for truly unknown equipment)
    if (!fk || !FLOOR_ORDER.includes(fk)) {
      const votes = feedsFloorVotes.get(equip.name);
      if (votes && votes.size > 0) {
        let maxFloor = "";
        let maxCount = 0;
        votes.forEach((count, fl) => {
          if (count > maxCount) { maxCount = count; maxFloor = fl; }
        });
        if (maxFloor) fk = maxFloor;
      }
    }

    // Step 4: Fallback
    if (!fk || !FLOOR_ORDER.includes(fk)) {
      fk = "__COMMON__";
    }

    if (!floorEquipMap.has(fk)) floorEquipMap.set(fk, []);
    floorEquipMap.get(fk)!.push({
      equip,
      category: categorizeEquipment(equip.name, equip.labels ?? []),
      systemKey: detectSystemFromEquip(equip.name, equip.labels ?? []),
    });
  }

  // 4. Build floor layouts in FLOOR_ORDER
  const floorLayouts: FloorLayout[] = [];

  for (const fk of FLOOR_ORDER) {
    const floorNode = floorMap.get(fk);
    const equipList = floorEquipMap.get(fk) ?? [];
    const zones = floorNode ? collectZones(floorNode) : [];
    const rooms = floorNode ? countRooms(floorNode) : 0;

    // Calculate band height based on equipment count
    const catGroups = new Map<EquipCategory, PlacedEquip[]>();
    for (const pe of equipList) {
      if (!catGroups.has(pe.category)) catGroups.set(pe.category, []);
      catGroups.get(pe.category)!.push(pe);
    }

    // Available width for equipment (minus header and zone area)
    const equipAreaW = FLOOR_BAND_W - FLOOR_HEADER_W - (zones.length > 0 ? ZONE_CHIP_W + 20 : 0) - FLOOR_PAD * 2;
    const maxPerRow = Math.min(MAX_EQUIP_PER_ROW, Math.max(1, Math.floor(equipAreaW / (EQUIP_W + EQUIP_GAP_H))));

    let totalRows = 0;
    catGroups.forEach((group) => {
      const rows = Math.ceil(group.length / maxPerRow);
      totalRows += rows;
    });
    const activeCats = catGroups.size;
    const bandHeight = Math.max(
      FLOOR_MIN_H,
      FLOOR_PAD * 2 + totalRows * (EQUIP_H + EQUIP_GAP_V) + activeCats * CAT_LABEL_H + 4,
    );

    floorLayouts.push({
      floorKey: fk,
      displayName: shortFloorName(fk),
      zone: getFloorZone(fk),
      equipList,
      zones,
      roomCount: rooms,
      bandHeight,
    });
  }

  // Add __COMMON__ band if there are unplaced items
  const commonEquip = floorEquipMap.get("__COMMON__");
  if (commonEquip && commonEquip.length > 0) {
    const equipAreaW = FLOOR_BAND_W - FLOOR_HEADER_W - FLOOR_PAD * 2;
    const maxPerRow = Math.min(MAX_EQUIP_PER_ROW, Math.max(1, Math.floor(equipAreaW / (EQUIP_W + EQUIP_GAP_H))));
    const rows = Math.ceil(commonEquip.length / maxPerRow);
    const bandHeight = Math.max(FLOOR_MIN_H, FLOOR_PAD * 2 + rows * (EQUIP_H + EQUIP_GAP_V) + CAT_LABEL_H + 4);

    floorLayouts.push({
      floorKey: "__COMMON__",
      displayName: "공용",
      zone: "podium",
      equipList: commonEquip,
      zones: [],
      roomCount: 0,
      bandHeight,
    });
  }

  // 5. Position floor bands vertically (RF at top)
  const equipNodeMeta: Record<string, { nodeId: string; floorKey: string; labels: string[] }> = {};
  let yOffset = 0;

  for (const fl of floorLayouts) {
    const bandNodeId = `floor-${fl.floorKey}`;

    // Count active equipment in this floor
    let activeCount = 0;
    let totalSensors = 0;
    for (const pe of fl.equipList) {
      const isActive = deviceStatusMap[pe.equip.name] || deviceStatusMap[pe.equip.id] || false;
      if (isActive) activeCount++;
      totalSensors += countSensors(pe.equip.name, points);
    }

    // Floor band node
    rfNodes.push({
      id: bandNodeId,
      type: "floorBand",
      position: { x: 0, y: yOffset },
      data: {
        floorKey: fl.floorKey,
        displayName: fl.displayName,
        zone: fl.zone,
        equipCount: fl.equipList.length,
        zoneCount: fl.zones.length,
        roomCount: fl.roomCount,
        activeCount,
        sensorCount: totalSensors,
        bandWidth: FLOOR_BAND_W,
        bandHeight: fl.bandHeight,
      } satisfies FloorBandData,
      style: { width: FLOOR_BAND_W, height: fl.bandHeight, zIndex: 0 },
      draggable: false,
      selectable: false,
    });

    // 6. Position equipment cards within floor band
    const catGroups = new Map<EquipCategory, PlacedEquip[]>();
    for (const pe of fl.equipList) {
      if (!catGroups.has(pe.category)) catGroups.set(pe.category, []);
      catGroups.get(pe.category)!.push(pe);
    }

    const zoneAreaW = fl.zones.length > 0 ? ZONE_CHIP_W + 20 : 0;
    const equipAreaW = FLOOR_BAND_W - FLOOR_HEADER_W - zoneAreaW - FLOOR_PAD * 2;
    const maxPerRow = Math.min(MAX_EQUIP_PER_ROW, Math.max(1, Math.floor(equipAreaW / (EQUIP_W + EQUIP_GAP_H))));

    let eqY = FLOOR_PAD; // relative to parent band (parentNode)

    for (const cat of CATEGORY_ORDER) {
      const group = catGroups.get(cat);
      if (!group || group.length === 0) continue;

      // Category label offset (skip rendering actual label—handled by css)
      eqY += CAT_LABEL_H;

      for (let i = 0; i < group.length; i++) {
        const pe = group[i];
        const col = i % maxPerRow;
        const row = Math.floor(i / maxPerRow);

        const eqX = FLOOR_HEADER_W + FLOOR_PAD + col * (EQUIP_W + EQUIP_GAP_H);
        const eqYPos = eqY + row * (EQUIP_H + EQUIP_GAP_V);

        const isActive = deviceStatusMap[pe.equip.name] || deviceStatusMap[pe.equip.id] || false;
        const isSimulated = pe.equip.name in deviceStatusMap || pe.equip.id in deviceStatusMap;
        const sensorCnt = countSensors(pe.equip.name, points);
        const opPct = computeOperationPct(pe.equip.name, points, isActive);
        const sysColor = SYSTEM_COLORS[pe.systemKey].css;

        const nodeId = `equip-${pe.equip.name}`;

        rfNodes.push({
          id: nodeId,
          type: "compactEquipCard",
          position: { x: eqX, y: eqYPos },
          data: {
            name: pe.equip.name,
            displayName: shortEquipName(pe.equip.name),
            type: pe.equip.type,
            labels: pe.equip.labels ?? [],
            category: pe.category,
            systemColor: sysColor,
            isActive,
            isSimulated,
            operationPct: opPct,
            sensorCount: sensorCnt,
            floorKey: fl.floorKey,
          } satisfies CompactEquipData,
          style: { width: EQUIP_W, height: EQUIP_H, zIndex: 1 },
          draggable: false,
          parentNode: bandNodeId,
          extent: "parent" as const,
        });

        // Register for edge building
        equipNodeMeta[pe.equip.name] = {
          nodeId,
          floorKey: fl.floorKey,
          labels: pe.equip.labels ?? [],
        };
      }

      const rows = Math.ceil(group.length / maxPerRow);
      eqY += rows * (EQUIP_H + EQUIP_GAP_V);
    }

    // 7. Position zone chips at right side (relative to parent band)
    if (fl.zones.length > 0) {
      const zoneX = FLOOR_BAND_W - ZONE_CHIP_W - FLOOR_PAD;
      const zoneStartY = FLOOR_PAD + 4; // relative to parent

      for (let zi = 0; zi < fl.zones.length; zi++) {
        const z = fl.zones[zi];
        const zNodeId = `zone-${fl.floorKey}-${z.name}`;

        rfNodes.push({
          id: zNodeId,
          type: "zoneChip",
          position: { x: zoneX, y: zoneStartY + zi * (ZONE_CHIP_H + ZONE_GAP) },
          data: {
            name: z.name,
            displayName: shortZoneName(z.name),
            floorKey: fl.floorKey,
          } satisfies ZoneChipData,
          style: { width: ZONE_CHIP_W, height: ZONE_CHIP_H, zIndex: 1 },
          draggable: false,
          parentNode: bandNodeId,
          extent: "parent" as const,
        });

        // Also register zones for edge matching (AHU feeds zones)
        equipNodeMeta[z.name] = {
          nodeId: zNodeId,
          floorKey: fl.floorKey,
          labels: z.labels ?? [],
        };
      }
    }

    yOffset += fl.bandHeight + FLOOR_GAP;
  }

  // 8. Build edges from connections
  const rfEdges = buildCrossSectionEdges(connections, equipNodeMeta);

  return { nodes: rfNodes, edges: rfEdges };
}

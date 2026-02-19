/**
 * Cross-Section Topology — Edge Builder
 * Builds React Flow edges from topology connections,
 * classifying same-floor vs cross-floor with different styles.
 */

import type { Edge } from "reactflow";
import type { TopologyConnection } from "@/lib/api";
import { SYSTEM_COLORS, detectSystemFromEquip } from "./cs-utils";

interface EquipMeta {
  nodeId: string;
  floorKey: string;
  labels: string[];
}

/**
 * Build edges from topology connections.
 * @param connections  Array of { source, rel_type, target } from API
 * @param equipMeta    Map of equipName → { nodeId, floorKey, labels }
 */
export function buildCrossSectionEdges(
  connections: TopologyConnection[],
  equipMeta: Record<string, EquipMeta>,
): Edge[] {
  const edges: Edge[] = [];

  for (const conn of connections) {
    if (conn.rel_type !== "feeds") continue;

    const srcMeta = equipMeta[conn.source];
    const tgtMeta = equipMeta[conn.target];

    // Both endpoints must have placed nodes
    if (!srcMeta || !tgtMeta) continue;

    const sysKey = detectSystemFromEquip(conn.source, srcMeta.labels);
    const sysColor = SYSTEM_COLORS[sysKey].css;
    const isCrossFloor = srcMeta.floorKey !== tgtMeta.floorKey;

    const edgeId = `cs-${conn.source}-${conn.target}`;

    if (isCrossFloor) {
      edges.push({
        id: edgeId,
        source: srcMeta.nodeId,
        target: tgtMeta.nodeId,
        type: "smoothstep",
        animated: true,
        className: `flow-edge-${sysKey} cross-floor-edge`,
        style: {
          stroke: sysColor,
          strokeWidth: 3,
          strokeOpacity: 0.9,
          // @ts-expect-error CSS custom property for glow
          "--edge-glow": sysColor.replace("rgb(", "rgba(").replace(")", ",0.5)"),
        },
        label: SYSTEM_COLORS[sysKey].flowLabel,
        labelStyle: {
          fill: "white",
          fontSize: 9,
          fontWeight: 700,
          fontFamily: "monospace",
        },
        labelBgStyle: {
          fill: "rgba(2,6,23,0.9)",
          stroke: sysColor,
          strokeWidth: 1,
        },
        labelBgPadding: [6, 3] as [number, number],
        labelBgBorderRadius: 6,
      });
    } else {
      edges.push({
        id: edgeId,
        source: srcMeta.nodeId,
        target: tgtMeta.nodeId,
        type: "smoothstep",
        animated: true,
        className: `flow-edge-${sysKey} intra-floor-edge`,
        style: {
          stroke: sysColor,
          strokeWidth: 2,
          strokeOpacity: 0.7,
        },
      });
    }
  }

  return edges;
}

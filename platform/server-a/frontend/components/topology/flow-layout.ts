/**
 * Topology Flow Diagram — Layout Engine v4
 * Process chain style: large stage cards connected horizontally
 * Each chain = one energy/water flow path through the building
 */

import type { Node, Edge } from "reactflow";
import type { TopologyNode, TopologyConnection } from "@/lib/api";
import type { SSEPointEvent } from "@/lib/sse";
/* utils imported for potential future use */

/* ── Dimensions ── */
const CARD_W = 440;
const CARD_H = 340;
const H_GAP = 280; // horizontal gap between cards (for flow connectors)
const ROW_GAP = 120; // vertical gap between process chains

/* ── Data Types ── */

export interface EquipNodeData {
  name: string;
  displayName: string;
  type: string;
  labels: string[];
  stageIndex: number;
  stageLabel: string;
  stageDesc: string;
  chainColor: string;
  isActive: boolean;
  isSimulated: boolean;
  operationPct: number;
  sensorValues: { label: string; value: number | null; unit: string }[];
  sensorCount: number;
}

/* ── System Colors ── */

const SYSTEM_COLORS: Record<string, string> = {
  chw: "rgb(34,211,238)",
  hw: "rgb(251,113,133)",
  cw: "rgb(129,140,248)",
  elec: "rgb(251,191,36)",
  default: "rgb(148,163,184)",
};

/* ── Process Chain Definitions ── */

interface StageSpec {
  equip: string;
  label: string;
  desc: string;
  flowLabel?: string; // label on the connecting edge to the NEXT stage
}

interface ChainSpec {
  name: string;
  system: string; // for color
  stages: StageSpec[];
}

const PROCESS_CHAINS: ChainSpec[] = [
  {
    name: "냉수 시스템 (Chilled Water Loop)",
    system: "chw",
    stages: [
      { equip: "Cooling_Tower_1", label: "냉각탑", desc: "외기와 열교환하여 냉각수 온도를 낮추는 장치", flowLabel: "냉각수" },
      { equip: "CW_Pump_1", label: "냉각수 펌프", desc: "냉각수를 냉각탑과 냉동기 사이 순환", flowLabel: "냉각수 공급" },
      { equip: "Chiller_1", label: "냉동기", desc: "냉수를 생산하는 핵심 냉방 장비", flowLabel: "냉수 생산" },
      { equip: "CHW_Pump_1", label: "냉수 펌프", desc: "냉수를 각 층 공조기로 분배하는 펌프", flowLabel: "냉수 분배" },
      { equip: "AHU_UFAD_1", label: "바닥 공조기", desc: "냉수로 실내 공기를 냉방하는 UFAD 시스템" },
    ],
  },
  {
    name: "온수 시스템 (Hot Water Loop)",
    system: "hw",
    stages: [
      { equip: "Boiler_1", label: "보일러", desc: "가스 연소로 온수를 생산하는 난방 장비", flowLabel: "온수 생산" },
      { equip: "HW_Pump_1", label: "온수 펌프", desc: "온수를 각 층 복사 패널로 분배", flowLabel: "온수 분배" },
      { equip: "CC_Pump_1", label: "CC 순환 펌프", desc: "천장복사냉난방 패널의 냉·온수 순환" },
    ],
  },
  {
    name: "외조기 시스템 (Dedicated Outdoor Air)",
    system: "default",
    stages: [
      { equip: "DOAS_1", label: "외조기 1", desc: "외부 신선공기를 필터링·조절하여 실내 공급", flowLabel: "신선공기 공급" },
      { equip: "DOAS_2", label: "외조기 2", desc: "중층부 전담 외기 처리 유닛", flowLabel: "조절 공기" },
      { equip: "DOAS_3", label: "외조기 3", desc: "고층부 전담 외기 처리 유닛" },
    ],
  },
  {
    name: "전기 시스템 (Electrical)",
    system: "elec",
    stages: [
      { equip: "Solar_PV_System", label: "태양광", desc: "옥상 태양광 패널 발전 시스템", flowLabel: "전력 생산" },
      { equip: "Water_Supply_Pump_1", label: "급수 펌프", desc: "건물 급수를 위한 가압 펌프", flowLabel: "급수" },
      { equip: "Water_Supply_Pump_2", label: "급수 펌프 2", desc: "예비 급수 펌프" },
    ],
  },
];

/* ── Recursive Equipment Finder ── */

function findEquipByName(root: TopologyNode, name: string): TopologyNode | null {
  if (root.name === name) return root;
  for (const child of root.children || []) {
    const found = findEquipByName(child, name);
    if (found) return found;
  }
  return null;
}

/* ── Sensor Helpers ── */

export function getEquipSensors(
  equipName: string,
  points: Record<string, SSEPointEvent>,
  max = 4
): { label: string; value: number | null; unit: string }[] {
  const prefix = `bldg:${equipName}_`;
  return Object.entries(points)
    .filter(([k]) => k.startsWith(prefix))
    .filter(([, p]) => p.value !== null)
    .slice(0, max)
    .map(([k, p]) => ({
      label: k.replace(prefix, "").replace(/_Sensor$/i, "").replace(/_/g, " ").trim(),
      value: p.value,
      unit: p.unit || "",
    }));
}

export function computeOperationPct(
  equipName: string,
  points: Record<string, SSEPointEvent>,
  isActive: boolean
): number {
  if (!isActive) return 0;
  const prefix = `bldg:${equipName}_`;
  const sensors = Object.entries(points).filter(([k]) => k.startsWith(prefix));
  if (sensors.length === 0) return isActive ? 100 : 0;
  const reporting = sensors.filter(([, p]) => p.value !== null).length;
  return Math.round((reporting / sensors.length) * 100);
}

/* ── Main Layout Builder v4 ── */

export function buildFlowLayout(
  tree: TopologyNode[],
  _connections: TopologyConnection[],
  deviceStatusMap: Record<string, boolean>,
  points: Record<string, SSEPointEvent>
): { nodes: Node[]; edges: Edge[] } {
  const rfNodes: Node[] = [];
  const rfEdges: Edge[] = [];

  if (!tree.length) return { nodes: rfNodes, edges: rfEdges };
  const building = tree[0];

  let globalStageIdx = 0;

  for (let ci = 0; ci < PROCESS_CHAINS.length; ci++) {
    const chain = PROCESS_CHAINS[ci];
    const chainColor = SYSTEM_COLORS[chain.system] || SYSTEM_COLORS.default;
    const rowY = ci * (CARD_H + ROW_GAP);

    for (let si = 0; si < chain.stages.length; si++) {
      const stage = chain.stages[si];
      globalStageIdx++;

      const colX = si * (CARD_W + H_GAP);

      /* Find equipment in tree */
      const eqNode = findEquipByName(building, stage.equip);

      const isSimulated = stage.equip in deviceStatusMap ||
        (eqNode ? eqNode.id in deviceStatusMap : false);
      const isActive = isSimulated
        ? deviceStatusMap[stage.equip] ||
          (eqNode ? deviceStatusMap[eqNode.id] || false : false)
        : false;

      const sensorValues = getEquipSensors(stage.equip, points);
      const operationPct = computeOperationPct(stage.equip, points, isActive);

      /* Count sensors for this equipment */
      const prefix = `bldg:${stage.equip}_`;
      const sensorCount = Object.keys(points).filter((k) =>
        k.startsWith(prefix)
      ).length;

      const nodeId = `stage-${ci}-${si}`;

      rfNodes.push({
        id: nodeId,
        type: "equipmentCard",
        position: { x: colX, y: rowY },
        data: {
          name: stage.equip,
          displayName: stage.equip.replace(/_/g, " "),
          type: eqNode?.type || "Equipment",
          labels: eqNode?.labels || [],
          stageIndex: globalStageIdx,
          stageLabel: stage.label,
          stageDesc: stage.desc,
          chainColor,
          isActive,
          isSimulated,
          operationPct,
          sensorValues,
          sensorCount,
        } satisfies EquipNodeData,
        style: { width: CARD_W, height: CARD_H },
        draggable: false,
      });

      /* Edge to next stage in chain */
      if (si < chain.stages.length - 1 && stage.flowLabel) {
        const nextId = `stage-${ci}-${si + 1}`;
        rfEdges.push({
          id: `flow-${ci}-${si}`,
          source: nodeId,
          target: nextId,
          type: "smoothstep",
          animated: true,
          className: `flow-edge-${chain.system}`,
          style: {
            stroke: chainColor,
            strokeWidth: 3.5,
            strokeOpacity: 0.95,
          },
          label: stage.flowLabel,
          labelStyle: {
            fill: "white",
            fontSize: 12,
            fontWeight: 700,
            fontFamily: "sans-serif",
          },
          labelBgStyle: {
            fill: "rgba(2,6,23,0.95)",
            stroke: chainColor,
            strokeWidth: 1.5,
          },
          labelBgPadding: [10, 6] as [number, number],
          labelBgBorderRadius: 8,
        });
      }
    }
  }

  return { nodes: rfNodes, edges: rfEdges };
}

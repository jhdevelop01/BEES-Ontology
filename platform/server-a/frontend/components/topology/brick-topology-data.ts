/**
 * Brick Schema 개념 토폴로지 — 단일 진실원 (정적 데이터 모델)
 *
 * _imgs/온톨로지_토폴로지.png 를 충실히 재현하는 개념/교육용 도해 데이터.
 * 라이브 데이터 연동 없음 — 고정 노드/엣지.
 *
 * 5계층: 건물(Building) → 층(Floor) → 공간(Room/HVAC_Zone) → 설비(Equipment) → 포인트(Point)
 * 8관계: hasPart/isPartOf, hasLocation/isLocatedIn, feeds/isFedBy, hasPoint, controls
 *
 * ⚠ 이 파일은 diagram/panels 컴포넌트의 계약(contract)이다. 필드명/키 변경 시 양쪽 동기화 필요.
 */

/* ── 노드 카테고리 ── */
export type BrickCategory = "space" | "equipment" | "point";

export interface CategoryMeta {
  key: BrickCategory;
  labelKo: string; // 범례용
  labelEn: string;
  fill: string; // 노드 배경
  border: string; // 노드 테두리
  text: string; // 노드 텍스트
  accent: string; // 범례 스와치/아이콘 색
}

/** 이미지 범례의 3색 (공간=파랑, 설비=teal, 포인트=보라) */
export const CATEGORY_META: Record<BrickCategory, CategoryMeta> = {
  space: {
    key: "space",
    labelKo: "공간/구조",
    labelEn: "Spaces",
    fill: "#EAF1FB",
    border: "#5B84C4",
    text: "#1E3A5F",
    accent: "#3B6BB5",
  },
  equipment: {
    key: "equipment",
    labelKo: "설비",
    labelEn: "Equipment",
    fill: "#E4F3EE",
    border: "#4FA88C",
    text: "#1B4A3B",
    accent: "#3E9B7E",
  },
  point: {
    key: "point",
    labelKo: "센서/포인트",
    labelEn: "Points",
    fill: "#F1EAF9",
    border: "#9B6DC6",
    text: "#472A66",
    accent: "#8B5FBF",
  },
};

/* ── 관계(엣지) 타입 ── */
export type BrickRelation =
  | "hasPart"
  | "isPartOf"
  | "hasLocation"
  | "isLocatedIn"
  | "feeds"
  | "isFedBy"
  | "hasPoint"
  | "isPointOf"
  | "controls";

export interface RelationMeta {
  key: BrickRelation;
  labelKo: string; // "포함", "소속" ...
  labelEn: string; // "hasPart" ...
  color: string;
  dashed: boolean;
  desc: string; // 관계 설명 패널용
}

/** 이미지 범례 + 관계 설명의 8종 관계 (색/실선·점선 포함) */
export const RELATION_META: Record<BrickRelation, RelationMeta> = {
  hasPart: {
    key: "hasPart",
    labelKo: "포함",
    labelEn: "hasPart",
    color: "#2563EB",
    dashed: false,
    desc: "상위가 하위를 포함 (구성 관계)",
  },
  isPartOf: {
    key: "isPartOf",
    labelKo: "소속",
    labelEn: "isPartOf",
    color: "#2563EB",
    dashed: true,
    desc: "하위가 상위에 소속 (역구성 관계)",
  },
  hasLocation: {
    key: "hasLocation",
    labelKo: "위치",
    labelEn: "hasLocation",
    color: "#16A34A",
    dashed: false,
    desc: "설비가 공간에 위치",
  },
  isLocatedIn: {
    key: "isLocatedIn",
    labelKo: "위치함",
    labelEn: "isLocatedIn",
    color: "#16A34A",
    dashed: true,
    desc: "공간이 설비를 포함 (역위치 관계)",
  },
  feeds: {
    key: "feeds",
    labelKo: "공급",
    labelEn: "feeds",
    color: "#EA7317",
    dashed: false,
    desc: "유체/에너지 흐름을 공급",
  },
  isFedBy: {
    key: "isFedBy",
    labelKo: "공급받음",
    labelEn: "isFedBy",
    color: "#EA7317",
    dashed: true,
    desc: "유체/에너지 흐름을 공급받음",
  },
  hasPoint: {
    key: "hasPoint",
    labelKo: "포인트 보유",
    labelEn: "hasPoint",
    color: "#7C3AED",
    dashed: false,
    desc: "설비가 포인트(센서/명령/설정값) 보유",
  },
  isPointOf: {
    key: "isPointOf",
    labelKo: "포인트 소속",
    labelEn: "isPointOf",
    color: "#7C3AED",
    dashed: true,
    desc: "포인트가 설비/공간에 소속 (역포인트 관계)",
  },
  controls: {
    key: "controls",
    labelKo: "제어",
    labelEn: "controls",
    color: "#334155",
    dashed: false,
    desc: "포인트가 설비를 제어",
  },
};

/* ── 노드 ── */
export interface BrickNode {
  id: string;
  category: BrickCategory;
  labelKo: string; // "건물", "공조기 AHU" ...
  brickClass: string; // "brick:Building" ...
  icon: string; // lucide-react 아이콘 컴포넌트명 (diagram에서 매핑)
  x: number;
  y: number;
}

/** y좌표 계층 (위→아래) */
const Y = { building: 0, floor: 150, space: 310, equip: 500, point: 690 };

export const BRICK_NODES: BrickNode[] = [
  // ── L0 건물 ──
  { id: "building", category: "space", labelKo: "건물", brickClass: "brick:Building", icon: "Building2", x: 555, y: Y.building },

  // ── L1 층 (실제 GEC B동 18개 층 — 4·13층 결번) ──
  // 지하 (B4F~B1F) — 구조 노드
  { id: "floor_b4f", category: "space", labelKo: "B4F", brickClass: "brick:Floor", icon: "Layers", x: -330, y: Y.floor },
  { id: "floor_b3f", category: "space", labelKo: "B3F", brickClass: "brick:Floor", icon: "Layers", x: -210, y: Y.floor },
  { id: "floor_b2f", category: "space", labelKo: "B2F", brickClass: "brick:Floor", icon: "Layers", x: -90, y: Y.floor },
  { id: "floor_b1f", category: "space", labelKo: "B1F", brickClass: "brick:Floor", icon: "Layers", x: 30, y: Y.floor },
  // 저층 (1F~3F) — 대표 상세 하위트리 보유
  { id: "floor_1f", category: "space", labelKo: "1F", brickClass: "brick:Floor", icon: "Layers", x: 150, y: Y.floor },
  { id: "floor_2f", category: "space", labelKo: "2F", brickClass: "brick:Floor", icon: "Layers", x: 540, y: Y.floor },
  { id: "floor_3f", category: "space", labelKo: "3F", brickClass: "brick:Floor", icon: "Layers", x: 960, y: Y.floor },
  // 사무층 (5F~15F) + 옥상 (RF) — 구조 노드
  { id: "floor_5f", category: "space", labelKo: "5F", brickClass: "brick:Floor", icon: "Layers", x: 1100, y: Y.floor },
  { id: "floor_6f", category: "space", labelKo: "6F", brickClass: "brick:Floor", icon: "Layers", x: 1220, y: Y.floor },
  { id: "floor_7f", category: "space", labelKo: "7F", brickClass: "brick:Floor", icon: "Layers", x: 1340, y: Y.floor },
  { id: "floor_8f", category: "space", labelKo: "8F", brickClass: "brick:Floor", icon: "Layers", x: 1460, y: Y.floor },
  { id: "floor_9f", category: "space", labelKo: "9F", brickClass: "brick:Floor", icon: "Layers", x: 1580, y: Y.floor },
  { id: "floor_10f", category: "space", labelKo: "10F", brickClass: "brick:Floor", icon: "Layers", x: 1700, y: Y.floor },
  { id: "floor_11f", category: "space", labelKo: "11F", brickClass: "brick:Floor", icon: "Layers", x: 1820, y: Y.floor },
  { id: "floor_12f", category: "space", labelKo: "12F", brickClass: "brick:Floor", icon: "Layers", x: 1940, y: Y.floor },
  { id: "floor_14f", category: "space", labelKo: "14F", brickClass: "brick:Floor", icon: "Layers", x: 2060, y: Y.floor },
  { id: "floor_15f", category: "space", labelKo: "15F", brickClass: "brick:Floor", icon: "Layers", x: 2180, y: Y.floor },
  { id: "floor_rf", category: "space", labelKo: "RF", brickClass: "brick:Floor", icon: "Layers", x: 2300, y: Y.floor },

  // ── L2 공간 ──
  { id: "room_1f", category: "space", labelKo: "회의실", brickClass: "brick:Room", icon: "Users", x: 30, y: Y.space },
  { id: "zone_1f", category: "space", labelKo: "사무실", brickClass: "brick:HVAC_Zone", icon: "Briefcase", x: 250, y: Y.space },
  { id: "zone_2f", category: "space", labelKo: "사무실", brickClass: "brick:HVAC_Zone", icon: "Briefcase", x: 460, y: Y.space },
  { id: "room_2f", category: "space", labelKo: "회의실", brickClass: "brick:Room", icon: "Users", x: 670, y: Y.space },
  { id: "room_3f", category: "space", labelKo: "기계실", brickClass: "brick:Room", icon: "Cog", x: 880, y: Y.space },
  { id: "zone_3f", category: "space", labelKo: "사무실", brickClass: "brick:HVAC_Zone", icon: "Briefcase", x: 1130, y: Y.space },

  // ── L3 설비 ──
  { id: "ahu", category: "equipment", labelKo: "공조기 AHU", brickClass: "brick:AHU", icon: "Fan", x: 20, y: Y.equip },
  { id: "vav", category: "equipment", labelKo: "VAV 박스", brickClass: "brick:VAV", icon: "SlidersHorizontal", x: 250, y: Y.equip },
  { id: "chiller", category: "equipment", labelKo: "냉동기", brickClass: "brick:Chiller", icon: "Snowflake", x: 460, y: Y.equip },
  { id: "boiler", category: "equipment", labelKo: "보일러", brickClass: "brick:Boiler", icon: "Flame", x: 670, y: Y.equip },
  { id: "pump", category: "equipment", labelKo: "펌프", brickClass: "brick:Pump", icon: "Waves", x: 880, y: Y.equip },
  { id: "meter", category: "equipment", labelKo: "전력 분전반 / 미터", brickClass: "brick:Electrical_Meter", icon: "Gauge", x: 1130, y: Y.equip },

  // ── L4 포인트 ──
  { id: "temp", category: "point", labelKo: "온도센서", brickClass: "brick:Temperature_Sensor", icon: "Thermometer", x: -60, y: Y.point },
  { id: "humidity", category: "point", labelKo: "습도센서", brickClass: "brick:Humidity_Sensor", icon: "Droplet", x: 55, y: Y.point },
  { id: "co2", category: "point", labelKo: "CO₂ 센서", brickClass: "brick:CO2_Sensor", icon: "Wind", x: 170, y: Y.point },
  { id: "valve_cmd", category: "point", labelKo: "밸브 명령", brickClass: "brick:Command", icon: "Wrench", x: 290, y: Y.point },
  { id: "power_chiller", category: "point", labelKo: "전력계측", brickClass: "brick:Power_Sensor", icon: "Zap", x: 420, y: Y.point },
  { id: "flow_chiller", category: "point", labelKo: "유량센서", brickClass: "brick:Flow_Sensor", icon: "Waves", x: 535, y: Y.point },
  { id: "setpoint", category: "point", labelKo: "설정값", brickClass: "brick:Setpoint", icon: "SlidersHorizontal", x: 670, y: Y.point },
  { id: "power_pump", category: "point", labelKo: "전력계측", brickClass: "brick:Power_Sensor", icon: "Zap", x: 825, y: Y.point },
  { id: "flow_pump", category: "point", labelKo: "유량센서", brickClass: "brick:Flow_Sensor", icon: "Waves", x: 940, y: Y.point },
  { id: "power_meter", category: "point", labelKo: "전력계측", brickClass: "brick:Power_Sensor", icon: "Zap", x: 1130, y: Y.point },
];

/* ── 엣지 ── */
export interface BrickEdge {
  id: string;
  source: string;
  target: string;
  relation: BrickRelation;
  note?: string; // 특수 라벨 보조 (예: "순환수 루프 지원")
}

export const BRICK_EDGES: BrickEdge[] = [
  // ── hasPart: 건물→층 ──
  { id: "e-b-1f", source: "building", target: "floor_1f", relation: "hasPart" },
  { id: "e-b-2f", source: "building", target: "floor_2f", relation: "hasPart" },
  { id: "e-b-3f", source: "building", target: "floor_3f", relation: "hasPart" },

  // ── isPartOf: 대표 역방향 (이미지 좌/우 외곽) ──
  { id: "e-1f-b-part", source: "room_1f", target: "building", relation: "isPartOf" },
  { id: "e-3f-b-part", source: "zone_3f", target: "building", relation: "isPartOf" },

  // ── hasPart: 층→공간 ──
  { id: "e-1f-r", source: "floor_1f", target: "room_1f", relation: "hasPart" },
  { id: "e-1f-z", source: "floor_1f", target: "zone_1f", relation: "hasPart" },
  { id: "e-2f-z", source: "floor_2f", target: "zone_2f", relation: "hasPart" },
  { id: "e-2f-r", source: "floor_2f", target: "room_2f", relation: "hasPart" },
  { id: "e-3f-r", source: "floor_3f", target: "room_3f", relation: "hasPart" },
  { id: "e-3f-z", source: "floor_3f", target: "zone_3f", relation: "hasPart" },

  // ── hasLocation: 공간→설비 (설비가 공간에 위치) ──
  { id: "e-z2-ahu", source: "zone_2f", target: "ahu", relation: "hasLocation" }, // 예시경로①
  { id: "e-z1-vav", source: "zone_1f", target: "vav", relation: "hasLocation" },
  { id: "e-r3-chiller", source: "room_3f", target: "chiller", relation: "hasLocation" }, // 예시경로②
  { id: "e-r3-boiler", source: "room_3f", target: "boiler", relation: "hasLocation" },
  { id: "e-r3-pump", source: "room_3f", target: "pump", relation: "hasLocation" },
  { id: "e-z3-meter", source: "zone_3f", target: "meter", relation: "hasLocation" },

  // ── isLocatedIn: 대표 역방향 (이미지 좌/우 외곽 초록 점선) ──
  { id: "e-ahu-r1-loc", source: "ahu", target: "room_1f", relation: "isLocatedIn" },
  { id: "e-meter-z3-loc", source: "meter", target: "zone_3f", relation: "isLocatedIn" },

  // ── feeds / isFedBy: 설비 간 유체·에너지 흐름 (주황) ──
  { id: "e-ahu-vav-feeds", source: "ahu", target: "vav", relation: "feeds" },
  { id: "e-chiller-vav-feeds", source: "chiller", target: "vav", relation: "feeds" },
  { id: "e-boiler-pump-feeds", source: "boiler", target: "pump", relation: "feeds" },
  { id: "e-chiller-boiler-fed", source: "chiller", target: "boiler", relation: "isFedBy" },
  { id: "e-pump-chiller-fed", source: "pump", target: "chiller", relation: "isFedBy", note: "순환수 루프 지원" },
  { id: "e-meter-pump-fed", source: "meter", target: "pump", relation: "isFedBy", note: "전력 공급" },

  // ── hasPoint: 설비→센서 (보라, AHU·냉동기·펌프) ──
  { id: "e-ahu-temp", source: "ahu", target: "temp", relation: "hasPoint" },
  { id: "e-ahu-hum", source: "ahu", target: "humidity", relation: "hasPoint" },
  { id: "e-ahu-co2", source: "ahu", target: "co2", relation: "hasPoint" },
  { id: "e-chiller-pw", source: "chiller", target: "power_chiller", relation: "hasPoint" },
  { id: "e-chiller-flow", source: "chiller", target: "flow_chiller", relation: "hasPoint" },
  { id: "e-pump-pw", source: "pump", target: "power_pump", relation: "hasPoint" },
  { id: "e-pump-flow", source: "pump", target: "flow_pump", relation: "hasPoint" },

  // ── controls: 포인트→설비 (검정, 명령·설정값·미터계측) ──
  { id: "e-valve-vav", source: "valve_cmd", target: "vav", relation: "controls" },
  { id: "e-sp-boiler", source: "setpoint", target: "boiler", relation: "controls" },
  { id: "e-pw-meter", source: "power_meter", target: "meter", relation: "controls" },
];

/* ── 예시 경로 (이미지 하단 좌측) ── */
export interface ExamplePath {
  no: number;
  steps: { labelKo: string; category: BrickCategory }[];
}
export const EXAMPLE_PATHS: ExamplePath[] = [
  {
    no: 1,
    steps: [
      { labelKo: "건물", category: "space" },
      { labelKo: "2F", category: "space" },
      { labelKo: "사무실", category: "space" },
      { labelKo: "공조기 AHU", category: "equipment" },
      { labelKo: "온도센서", category: "point" },
    ],
  },
  {
    no: 2,
    steps: [
      { labelKo: "건물", category: "space" },
      { labelKo: "3F", category: "space" },
      { labelKo: "기계실", category: "space" },
      { labelKo: "냉동기", category: "equipment" },
      { labelKo: "전력계측", category: "point" },
    ],
  },
];

/** 범례/관계설명 패널에서 반복할 순서 (이미지 순서) */
export const LEGEND_CATEGORY_ORDER: BrickCategory[] = ["space", "equipment", "point"];
export const RELATION_ORDER: BrickRelation[] = [
  "hasPart",
  "isPartOf",
  "hasLocation",
  "isLocatedIn",
  "feeds",
  "isFedBy",
  "hasPoint",
  "isPointOf",
  "controls",
];

/* ═══════════════════════════════════════════════════════════
 * 라이브 온톨로지(Neo4j /api/ontology/graph) 연동 계약
 *   DataLayer(brick-ontology-graph.ts)와 CanvasUI(brick-topology-live-canvas.tsx)의 공유 계약.
 * ═══════════════════════════════════════════════════════════ */

/** Neo4j 노드 `type` 필드 → 3카테고리 매핑 (실측 분포: Point/Equipment/Location/Zone/System/Floor/Building/Site/Other) */
export const CATEGORY_OF_TYPE: Record<string, BrickCategory> = {
  Building: "space",
  Site: "space",
  Floor: "space",
  Location: "space",
  Zone: "space",
  Room: "space",
  Equipment: "equipment",
  System: "equipment",
  Point: "point",
};

/** 노드 type(+labels 폴백)으로 카테고리 판정. 매핑 없으면 null(=Other, 기본 숨김). */
export function categoryOfType(type: string | undefined): BrickCategory | null {
  if (!type) return null;
  return CATEGORY_OF_TYPE[type] ?? null;
}

/** Brick 라벨(labels 마지막 = 클래스명) → lucide 아이콘 컴포넌트명. 미매핑은 카테고리 기본값. */
const ICON_BY_CLASS: Record<string, string> = {
  Building: "Building2", Site: "MapPin", Floor: "Layers",
  Room: "Users", Office_Space: "Briefcase", Meeting_Room: "Users",
  Mechanical_Room: "Cog", Server_Room: "Server", Support_Space: "Boxes",
  HVAC_Zone: "Briefcase", Zone: "Square",
  AHU: "Fan", VAV: "SlidersHorizontal", Chiller: "Snowflake", Chiller_Plant: "Snowflake",
  Boiler: "Flame", Pump: "Waves", Chilled_Water_Pump: "Waves", Hot_Water_Pump: "Waves",
  Condenser_Water_Pump: "Waves", Cooling_Tower: "Wind", Fan_Coil_Unit: "Fan",
  Supply_Fan: "Fan", Exhaust_Fan: "Fan", Damper: "SlidersHorizontal", Valve: "Wrench",
  Elevator: "MoveVertical", Controller: "Cpu", Server: "Server", VFD: "Gauge",
  Building_Electrical_Meter: "Gauge", Electrical_Equipment: "Zap",
  Emergency_Generator: "Zap", Switchgear: "Zap", Distribution_Header: "GitMerge",
  Floor_Diffuser: "Grid3x3", Chilled_Ceiling_Panel: "Grid3x3",
};
const ICON_BY_CATEGORY: Record<BrickCategory, string> = {
  space: "Square", equipment: "Box", point: "Circle",
};
export function iconForNode(labels: string[] | undefined, category: BrickCategory): string {
  const cls = labels && labels.length ? labels[labels.length - 1] : "";
  if (ICON_BY_CLASS[cls]) return ICON_BY_CLASS[cls];
  // 센서/명령/설정값 계열 휴리스틱
  if (category === "point") {
    if (/Temperature/i.test(cls)) return "Thermometer";
    if (/Humidity/i.test(cls)) return "Droplet";
    if (/CO2/i.test(cls)) return "Wind";
    if (/Flow/i.test(cls)) return "Waves";
    if (/Power|Electric|Energy/i.test(cls)) return "Zap";
    if (/Pressure/i.test(cls)) return "Gauge";
    if (/Command/i.test(cls)) return "Wrench";
    if (/Setpoint/i.test(cls)) return "SlidersHorizontal";
    if (/Status/i.test(cls)) return "ToggleLeft";
    if (/Alarm/i.test(cls)) return "TriangleAlert";
    if (/Occupancy/i.test(cls)) return "UserCheck";
  }
  return ICON_BY_CATEGORY[category];
}

/** 카테고리 표시 토글/층 필터 상태 */
export interface BrickGraphFilters {
  floor: string | null; // null = 전체 층
  show: Record<BrickCategory, boolean>; // 카테고리별 표시 여부
}

export const DEFAULT_FILTERS: BrickGraphFilters = {
  floor: null,
  show: { space: true, equipment: true, point: false }, // Point(905개)는 기본 숨김 — 토글로 on
};

/* ═══════════════════════════════════════════════════════════
 * 점진적 드릴다운(트리) 계약
 *   처음엔 건물만 → 클릭 시 층 → 층 클릭 시 하위(존→설비→포인트) 단계 전개.
 *   DataLayer(brick-ontology-graph.ts)와 CanvasUI(live-canvas + nodes.tsx) 공유 계약.
 * ═══════════════════════════════════════════════════════════ */

/** 드릴다운 노드가 BrickCard(nodes.tsx)로 전달하는 data 형태.
 *  기존 {labelKo,brickClass,icon,category}에 확장 상태 3필드 추가. */
export interface BrickTreeNodeData {
  labelKo: string;
  brickClass: string;
  icon: string;
  category: BrickCategory;
  expandable: boolean; // 숨은 직계 자식이 있어 펼칠 수 있음
  expanded: boolean; // 현재 펼쳐진 상태(자식 표시 중)
  childCount: number; // 직계 자식 수(뱃지 표시용)
}

/** 확장(펼침) 상태 = 펼쳐진 노드 id 집합. 빈 집합 = 루트(건물)만 표시. */
export type BrickExpandedSet = Set<string>;

/** 수직 층 밴드의 좌측 "층 헤더" 노드 data. node.type = "floorHeader".
 *  cs-canvas의 FloorBandNode 헤더처럼 큰 층 라벨 + 개수를 표시한다. */
export interface BrickFloorHeaderData {
  floorLabel: string; // "5F", "RF", "건물·공용" 등 표시 라벨
  count: number; // 이 층 밴드에 속한 노드 수
  accent: string; // 층 라벨/액센트 색 (hex)
}

/* ═══════════════════════════════════════════════════════════
 * 중첩 포함 카드(nested containment) 계약
 *   상위 카드가 하위 카드를 물리적으로 감싸는 트리:
 *   건물 ⊃ 층 ⊃ 공간 ⊃ 설비 ⊃ 센서.
 *   DataTree(brick-ontology-tree.ts)와 NestedUI(brick-nested-cards.tsx)의 공유 계약.
 * ═══════════════════════════════════════════════════════════ */
export interface BrickTreeCardNode {
  id: string;
  labelKo: string;
  brickClass: string; // "brick:HVAC_Zone" 등 표시용
  category: BrickCategory; // space | equipment | point (카드 색)
  level: number; // 0 건물 · 1 층 · 2 공간 · 3 설비 · 4 센서
  icon: string; // lucide 아이콘명
  isCommon?: boolean; // 합성 "층 공용" 그룹 카드 여부
  count: number; // 하위 총 노드 수(뱃지용)
  children: BrickTreeCardNode[]; // 직속 하위 카드들(중첩)
}

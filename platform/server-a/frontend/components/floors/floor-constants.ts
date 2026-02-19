/**
 * 층별 현황 페이지 — 상수, 타입 정의, 유틸리티
 */

/* ------------------------------------------------------------------ */
/* 층 정의                                                              */
/* ------------------------------------------------------------------ */

export interface FloorInfo {
  key: string;
  label: string;
  type: "office" | "mechanical" | "parking" | "podium" | "lobby";
  displayOrder: number;
}

export const FLOORS: FloorInfo[] = [
  { key: "B_RF",  label: "RF",  type: "mechanical", displayOrder: 0 },
  { key: "B_15F", label: "15F", type: "office",     displayOrder: 1 },
  { key: "B_14F", label: "14F", type: "office",     displayOrder: 2 },
  { key: "B_12F", label: "12F", type: "office",     displayOrder: 3 },
  { key: "B_11F", label: "11F", type: "office",     displayOrder: 4 },
  { key: "B_10F", label: "10F", type: "office",     displayOrder: 5 },
  { key: "B_9F",  label: "9F",  type: "office",     displayOrder: 6 },
  { key: "B_8F",  label: "8F",  type: "office",     displayOrder: 7 },
  { key: "B_7F",  label: "7F",  type: "office",     displayOrder: 8 },
  { key: "B_6F",  label: "6F",  type: "office",     displayOrder: 9 },
  { key: "B_5F",  label: "5F",  type: "office",     displayOrder: 10 },
  { key: "B_3F",  label: "3F",  type: "podium",     displayOrder: 11 },
  { key: "B_2F",  label: "2F",  type: "podium",     displayOrder: 12 },
  { key: "B_1F",  label: "1F",  type: "lobby",      displayOrder: 13 },
  { key: "B_B1F", label: "B1F", type: "mechanical",  displayOrder: 14 },
  { key: "B_B2F", label: "B2F", type: "parking",    displayOrder: 15 },
  { key: "B_B3F", label: "B3F", type: "parking",    displayOrder: 16 },
  { key: "B_B4F", label: "B4F", type: "parking",    displayOrder: 17 },
];

/* ------------------------------------------------------------------ */
/* FloorData 타입                                                       */
/* ------------------------------------------------------------------ */

export interface FloorRoomData {
  id: string;
  label: string | null;
  spaceType: string | null;
  area_m2: number | null;
  zone_key: string | null;
  // 실시간 센서값 (SSE points에서 매핑)
  temperature: number | null;
  humidity: number | null;
  co2: number | null;
  // 추정 전력/에너지
  powerKw: number | null;
  energyKwh: number | null;
}

export interface FloorEquipmentData {
  id: string;
  name: string;
  label: string | null;
  type: string;
  category: string | null;
  subcategory: string | null;
  controllable: boolean;
  location: string | null;
  is_active: boolean;
}

export interface FloorData {
  key: string;
  label: string;
  type: FloorInfo["type"];

  // 센서 (SSE points 평균)
  temperature: number | null;
  humidity: number | null;
  co2: number | null;

  // 에너지 (API)
  powerKw: number | null;

  // 장비 (equipment list + SSE devices)
  totalEquipment: number;
  activeEquipment: number;
  equipmentByCategory: Record<string, { total: number; active: number }>;

  // 알람
  alarmCritical: number;
  alarmWarning: number;
  alarmInfo: number;

  // 계산된 상태
  status: "normal" | "warning" | "critical";
  statusReason: string | null;

  // 신규: Room 상세
  rooms: FloorRoomData[];
  // 신규: 장비 상세
  equipmentDetails: FloorEquipmentData[];
  // 신규: 총 면적
  totalArea_m2: number;
  // 신규: 에너지 누적(kWh)
  energyKwh: number | null;
}

/* ------------------------------------------------------------------ */
/* SSE 포인트 프리픽스 매핑                                              */
/* ------------------------------------------------------------------ */

/**
 * 장비 ID → SSE point_id 프리픽스 변환
 *
 * bldg:AHU_UFAD_3   → "bldg:AHU_3_"
 * bldg:FCU_2F        → "bldg:FCU_2F_"
 * bldg:FCU_3F_1      → "bldg:FCU_3F_1_"
 * bldg:DOAS_1        → "bldg:DOAS_1_"
 */
export function ssePointPrefix(equipId: string): string | null {
  const name = equipId.startsWith("bldg:") ? equipId.slice(5) : equipId;

  // AHU_UFAD_X → AHU_X_
  const ahuMatch = name.match(/^AHU_UFAD_(\d+)$/);
  if (ahuMatch) return `bldg:AHU_${ahuMatch[1]}_`;

  // FCU_* → FCU_*_
  if (name.startsWith("FCU_")) return `bldg:${name}_`;

  // DOAS_X → DOAS_X_
  if (name.startsWith("DOAS_")) return `bldg:${name}_`;

  // Air_Curtain_* → Air_Curtain_*_
  if (name.startsWith("Air_Curtain_")) return `bldg:${name}_`;

  // PAC_* → PAC_*_
  if (name.startsWith("PAC_")) return `bldg:${name}_`;

  // Chiller_* → Chiller_*_
  if (name.startsWith("Chiller_")) return `bldg:${name}_`;

  // Boiler_* → Boiler_*_
  if (name.startsWith("Boiler_")) return `bldg:${name}_`;

  // *_Pump_* → *_Pump_*_
  if (name.includes("_Pump_") || name.startsWith("Pump_")) return `bldg:${name}_`;
  if (name.startsWith("CHW_Pump_") || name.startsWith("CW_Pump_") || name.startsWith("HW_Pump_")) return `bldg:${name}_`;

  // Exhaust_Fan_* → Exhaust_Fan_*_
  if (name.startsWith("Exhaust_Fan_")) return `bldg:${name}_`;

  // Supply_Fan_* → Supply_Fan_*_
  if (name.startsWith("Supply_Fan_")) return `bldg:${name}_`;

  // Cooling_Tower_* → Cooling_Tower_*_
  if (name.startsWith("Cooling_Tower_")) return `bldg:${name}_`;

  // MAU_* → MAU_*_
  if (name.startsWith("MAU_")) return `bldg:${name}_`;

  // Elevator_* → Elevator_*_
  if (name.startsWith("Elevator_")) return `bldg:${name}_`;

  // CC_Panel_* → CC_Panel_*_
  if (name.startsWith("CC_Panel_")) return `bldg:${name}_`;

  return null;
}

/* ------------------------------------------------------------------ */
/* 상태 판단 로직                                                       */
/* ------------------------------------------------------------------ */

export function calculateFloorStatus(
  floor: Omit<FloorData, "status" | "statusReason">
): { status: FloorData["status"]; statusReason: string | null } {
  // Critical: 심각 알람 또는 극단적 온도
  if (floor.alarmCritical > 0) {
    return { status: "critical", statusReason: "critical_alarm" };
  }
  if (floor.temperature !== null && (floor.temperature > 28 || floor.temperature < 18)) {
    return { status: "critical", statusReason: "temp_extreme" };
  }

  // Warning: 경고 알람 또는 온도 이탈
  if (floor.alarmWarning > 0) {
    return { status: "warning", statusReason: "warning_alarm" };
  }
  if (floor.temperature !== null && (floor.temperature > 26 || floor.temperature < 20)) {
    return { status: "warning", statusReason: "temp_deviation" };
  }

  // CO2 경고 (1000ppm 이상)
  if (floor.co2 !== null && floor.co2 > 1000) {
    return { status: "warning", statusReason: "co2_high" };
  }

  return { status: "normal", statusReason: null };
}

/* ------------------------------------------------------------------ */
/* 온도 → 색상 변환 (히트맵용)                                          */
/* ------------------------------------------------------------------ */

/** Tailwind 색상 클래스 반환 (배경용) */
export function tempToColor(temp: number | null): string {
  if (temp === null) return "bg-gray-100";
  if (temp < 18) return "bg-blue-400";
  if (temp < 20) return "bg-blue-300";
  if (temp < 22) return "bg-emerald-300";
  if (temp <= 24) return "bg-emerald-400";
  if (temp <= 26) return "bg-emerald-300";
  if (temp <= 28) return "bg-amber-300";
  return "bg-red-400";
}

/** HEX 색상 반환 (인라인 스타일용) */
export function tempToHex(temp: number | null): string {
  if (temp === null) return "#e5e7eb";
  if (temp < 18) return "#60a5fa";
  if (temp < 20) return "#93c5fd";
  if (temp < 22) return "#6ee7b7";
  if (temp <= 24) return "#34d399";
  if (temp <= 26) return "#6ee7b7";
  if (temp <= 28) return "#fcd34d";
  return "#f87171";
}

/** 상태 배지 색상 클래스 */
export function statusToVariant(status: FloorData["status"]): "default" | "secondary" | "danger" {
  if (status === "critical") return "danger";
  if (status === "warning") return "secondary";
  return "default";
}

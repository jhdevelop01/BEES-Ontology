import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Tailwind CSS 클래스 머지 유틸리티
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** 코드명 → 사람이 읽기 쉬운 영어 이름 */
export function humanizeName(codeName: string): string {
  return codeName.replace(/_/g, " ");
}

/** rdfs:label의 영어 약어를 순수 한국어로 변환 */
export function koreanizeLabel(label: string): string {
  const abbrevMap: Record<string, string> = {
    "AHU": "공조기", "DOAS": "외기조화기", "UFAD": "바닥급기",
    "FCU": "팬코일유닛", "VFD": "인버터", "DSF": "이중외피",
    "CHW": "냉수", "CW": "냉각수", "HW": "온수", "STM": "증기",
    "MAU": "외기처리기", "EHP": "전기히트펌프", "PAC": "패키지에어컨",
    "VAV": "가변풍량", "CAV": "정풍량", "BAS": "빌딩자동화",
    "MCC": "전동기제어반", "CT": "냉각탑", "HEX": "열교환기",
  };
  let result = label;
  for (const [abbr, korean] of Object.entries(abbrevMap)) {
    result = result.replace(new RegExp(`\\b${abbr}\\b`, "g"), korean);
  }
  result = result.replace(/(\d+)F\b/g, "$1층");
  result = result.replace(/\bB(\d+)F\b/g, "지하$1층");
  result = result.replace(/\bRF\b/g, "옥상");
  return result;
}

/** locale에 따라 표시 이름 결정 */
export function getDisplayName(
  locale: string,
  label: string | undefined | null,
  codeName: string
): string {
  if (locale === "ko" && label) {
    return koreanizeLabel(label);
  }
  return humanizeName(codeName);
}

/** Brick 장비 타입을 한국어로 변환 */
export function localizeType(locale: string, type: string): string {
  if (locale !== "ko") return humanizeName(type);
  const typeMap: Record<string, string> = {
    AHU: "공조기", Air_Handler_Unit: "공조기",
    Chiller: "냉동기", Boiler: "보일러",
    Pump: "펌프", Fan: "팬",
    Supply_Fan: "급기팬", Return_Fan: "환기팬", Exhaust_Fan: "배기팬",
    Cooling_Tower: "냉각탑", Fan_Coil_Unit: "팬코일유닛",
    Elevator: "승강기", VFD: "인버터",
    Heat_Exchanger: "열교환기", Valve: "밸브", Damper: "댐퍼",
    Chilled_Water_Pump: "냉수펌프", Condenser_Water_Pump: "냉각수펌프",
    Hot_Water_Pump: "온수펌프", Chilled_Ceiling_Panel: "냉각천장패널",
    CRAC: "항온항습기", Condenser: "응축기", Compressor: "압축기",
  };
  return typeMap[type] || humanizeName(type);
}

/** 위치 코드를 사람 읽기 이름으로 변환 */
export function formatLocation(locale: string, location: string): string {
  const name = location.replace(/^B_/, "");
  if (locale === "ko") {
    return name
      .replace(/^B(\d+)F$/, "지하 $1층")
      .replace(/^(\d+)F$/, "$1층")
      .replace(/^RF$/, "옥상층")
      .replace(/^PH$/, "펜트하우스")
      .replace(/_/g, " ");
  }
  return humanizeName(name);
}

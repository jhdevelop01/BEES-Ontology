"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { Header } from "@/components/layout/header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useSSE } from "@/lib/sse";
import {
  getEquipmentList,
  type EquipmentListItem,
} from "@/lib/api";
import {
  Power,
  PowerOff,
  Cpu,
  MapPin,
  ChevronDown,
  ChevronRight,
  Search,
  Loader2,
} from "lucide-react";
import { getDisplayName, formatLocation } from "@/lib/utils";

/**
 * 모니터링 페이지
 * 전체 장비 목록 (유형별 2단계 필터, 검색, 클릭 시 상세 이동)
 */

// ── 대분류 카테고리 (부품 제외 — 부품은 하단 요약 배너로 표시) ──
const CATEGORY_GROUPS = [
  { key: "all", label: "categoryAll", classes: [] },
  {
    key: "hvac",
    label: "categoryHVAC",
    classes: [
      "AHU", "Air_Handler_Unit", "Chiller", "Boiler", "Pump",
      "Chilled_Water_Pump", "Condenser_Water_Pump", "Hot_Water_Pump",
      "Fan", "Supply_Fan", "Return_Fan", "Exhaust_Fan",
      "Cooling_Tower", "Fan_Coil_Unit", "Chilled_Ceiling_Panel",
      "Heat_Exchanger",
    ],
  },
  {
    key: "elec_transport",
    label: "categoryElecTransport",
    classes: ["Elevator"],
  },
] as const;

// ── 부품 타입 (모니터링 카드에서 제외, 요약 배너로 표시) ──
const COMPONENT_TYPES = ["Valve", "Damper", "VFD", "Heat_Exchanger", "CRAC", "Condenser", "Compressor"];

// ── HVAC 서브필터 ──
const HVAC_SUB_FILTERS = [
  { key: "all", label: "subHVACAll", classes: [] },
  {
    key: "cooling",
    label: "subCooling",
    classes: ["Chiller", "Cooling_Tower", "Chilled_Water_Pump", "Condenser_Water_Pump", "Chilled_Ceiling_Panel"],
  },
  {
    key: "heating",
    label: "subHeating",
    classes: ["Boiler", "Hot_Water_Pump"],
  },
  {
    key: "airside",
    label: "subAirside",
    classes: ["AHU", "Air_Handler_Unit", "Supply_Fan", "Return_Fan", "Exhaust_Fan", "Fan", "Fan_Coil_Unit", "Pump"],
  },
] as const;

// ── 장비 유형별 아이콘 색상 ──
function getTypeColor(type: string): string {
  const t = type.toLowerCase();
  if (t.includes("ahu") || t.includes("air_handler")) return "bg-blue-100 text-blue-700";
  if (t.includes("fan")) return "bg-cyan-100 text-cyan-700";
  if (t.includes("pump")) return "bg-indigo-100 text-indigo-700";
  if (t.includes("chiller")) return "bg-sky-100 text-sky-700";
  if (t.includes("boiler")) return "bg-orange-100 text-orange-700";
  if (t.includes("cooling_tower")) return "bg-teal-100 text-teal-700";
  if (t.includes("fcu")) return "bg-violet-100 text-violet-700";
  if (t.includes("elevator")) return "bg-gray-100 text-gray-700";
  if (t.includes("vfd")) return "bg-purple-100 text-purple-700";
  if (t.includes("heat_exchanger")) return "bg-amber-100 text-amber-700";
  if (t.includes("valve")) return "bg-emerald-100 text-emerald-700";
  if (t.includes("damper")) return "bg-lime-100 text-lime-700";
  return "bg-gray-100 text-gray-600";
}

export default function MonitoringPage() {
  const { devices, connected } = useSSE(60);
  const t = useTranslations("monitoring");
  const locale = useLocale();

  const [equipment, setEquipment] = useState<EquipmentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [hvacSubFilter, setHvacSubFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showComponentSummary, setShowComponentSummary] = useState(false);

  // i18n 기반 장비 유형 라벨
  const getTypeLabelI18n = (type: string) => {
    const map: Record<string, string> = {
      AHU: t("typeAHU"),
      Air_Handler_Unit: t("typeAHU"),
      Fan: t("typeFan"),
      Supply_Fan: t("typeSupplyFan"),
      Return_Fan: t("typeReturnFan"),
      Exhaust_Fan: t("typeExhaustFan"),
      Pump: t("typePump"),
      Chiller: t("typeChiller"),
      Boiler: t("typeBoiler"),
      Cooling_Tower: t("typeCoolingTower"),
      FCU: t("typeFCU"),
      Elevator: t("typeElevator"),
      VFD: t("typeVFD"),
      Heat_Exchanger: t("typeHeatExchanger"),
      Valve: t("typeValve"),
      Damper: t("typeDamper"),
    };
    return map[type] || type;
  };

  // 장비 목록 로딩
  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const resp = await getEquipmentList();
        setEquipment(resp.items);
      } catch (err) {
        console.error("[BEES] 장비 목록 로딩 실패:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // API category → 내부 키 매핑
  const API_CATEGORY_MAP: Record<string, string> = {
    hvac: "hvac",
    electrical_transport: "elec_transport",
    component: "parts",
  };

  // API subcategory → 내부 서브필터 키 매핑
  const API_SUB_MAP: Record<string, string> = {
    cooling: "cooling",
    heating: "heating",
    air_handling: "airside",
  };

  // brick_class 배열이 특정 클래스 목록에 매칭되는지 확인 (폴백용)
  const matchesClasses = (eq: EquipmentListItem, classes: readonly string[]) =>
    eq.brick_class.some((c) =>
      classes.some((cls) => c.toLowerCase().includes(cls.toLowerCase()))
    );

  // 장비가 대분류 카테고리에 속하는지 (API 필드 우선, brick_class 폴백)
  const matchesCategory = (eq: EquipmentListItem, catKey: string): boolean => {
    if (eq.category) return API_CATEGORY_MAP[eq.category] === catKey;
    const group = CATEGORY_GROUPS.find((g) => g.key === catKey);
    return group ? matchesClasses(eq, group.classes) : false;
  };

  // 장비가 HVAC 서브카테고리에 속하는지 (API 필드 우선, brick_class 폴백)
  const matchesSubcategory = (eq: EquipmentListItem, subKey: string): boolean => {
    if (eq.subcategory) return API_SUB_MAP[eq.subcategory] === subKey;
    const sub = HVAC_SUB_FILTERS.find((s) => s.key === subKey);
    return sub ? matchesClasses(eq, sub.classes) : false;
  };

  // 부품 목록 (카드 그리드에서 제외, 하단 요약 배너용)
  const componentEquipment = useMemo(() => {
    return equipment.filter((eq) =>
      eq.category === "component" ||
      eq.brick_class.some((c) => COMPONENT_TYPES.includes(c))
    );
  }, [equipment]);

  // 부품 타입별 그룹 요약
  const componentSummary = useMemo(() => {
    const groups: Record<string, { count: number; items: EquipmentListItem[] }> = {};
    for (const eq of componentEquipment) {
      const type = eq.type;
      if (!groups[type]) groups[type] = { count: 0, items: [] };
      groups[type].count++;
      groups[type].items.push(eq);
    }
    return groups;
  }, [componentEquipment]);

  // 모니터링 대상 장비 (부품 제외)
  const monitorableEquipment = useMemo(() => {
    const compIds = new Set(componentEquipment.map((eq) => eq.id));
    return equipment.filter((eq) => !compIds.has(eq.id));
  }, [equipment, componentEquipment]);

  // 필터링된 장비 목록 (2단계 분류, 부품 제외)
  const filteredEquipment = useMemo(() => {
    let list = monitorableEquipment;

    // 1단계: 대분류 필터
    if (categoryFilter !== "all") {
      list = list.filter((eq) => matchesCategory(eq, categoryFilter));
    }

    // 2단계: HVAC 서브필터
    if (categoryFilter === "hvac" && hvacSubFilter !== "all") {
      list = list.filter((eq) => matchesSubcategory(eq, hvacSubFilter));
    }

    // 검색 필터
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (eq) =>
          eq.name.toLowerCase().includes(q) ||
          eq.type.toLowerCase().includes(q) ||
          (eq.location && eq.location.toLowerCase().includes(q))
      );
    }

    return list;
  }, [monitorableEquipment, categoryFilter, hvacSubFilter, searchQuery]);

  // 장비별 실시간 상태 매칭 (SSE devices 데이터)
  const getDeviceActive = (eq: EquipmentListItem): boolean | null => {
    const dev = devices[eq.id] || devices[eq.name];
    if (dev) return dev.is_active;
    return eq.is_active;
  };

  // 대분류 카운트 (부품 제외)
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: monitorableEquipment.length };
    for (const group of CATEGORY_GROUPS) {
      if (group.key === "all") continue;
      counts[group.key] = monitorableEquipment.filter((eq) =>
        matchesCategory(eq, group.key)
      ).length;
    }
    return counts;
  }, [monitorableEquipment]);

  // HVAC 서브필터 카운트
  const hvacSubCounts = useMemo(() => {
    const hvacList = monitorableEquipment.filter((eq) => matchesCategory(eq, "hvac"));
    const counts: Record<string, number> = { all: hvacList.length };
    for (const sub of HVAC_SUB_FILTERS) {
      if (sub.key === "all") continue;
      counts[sub.key] = hvacList.filter((eq) =>
        matchesSubcategory(eq, sub.key)
      ).length;
    }
    return counts;
  }, [equipment]);

  return (
    <div className="min-h-screen">
      <Header
        title={t("title")}
        description={t("description", { count: monitorableEquipment.length })}
        connected={connected}
      />

      <div className="p-3 md:p-6 space-y-6">
        {/* 검색 + 필터 */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* 검색 */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder={t("searchPlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* 대분류 탭 */}
        <div className="flex flex-wrap gap-1.5">
          {CATEGORY_GROUPS.map((group) => {
            const count = categoryCounts[group.key] || 0;
            const isActive = categoryFilter === group.key;
            return (
              <button
                key={group.key}
                onClick={() => {
                  setCategoryFilter(group.key);
                  if (group.key !== "hvac") setHvacSubFilter("all");
                }}
                className={`px-3 py-1.5 text-xs rounded-full transition-colors ${
                  isActive
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {t(group.label)}
                {count > 0 && (
                  <span
                    className={`ml-1 ${
                      isActive ? "text-blue-200" : "text-gray-400"
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* HVAC 서브필터 (HVAC 선택 시에만 표시) */}
        {categoryFilter === "hvac" && (
          <div className="flex flex-wrap gap-1.5 pl-3 border-l-2 border-blue-200">
            {HVAC_SUB_FILTERS.map((sub) => {
              const count = hvacSubCounts[sub.key] || 0;
              const isActive = hvacSubFilter === sub.key;
              return (
                <button
                  key={sub.key}
                  onClick={() => setHvacSubFilter(sub.key)}
                  className={`px-3 py-1.5 text-xs rounded-full transition-colors ${
                    isActive
                      ? "bg-sky-500 text-white"
                      : "bg-sky-50 text-sky-600 hover:bg-sky-100"
                  }`}
                >
                  {t(sub.label)}
                  {count > 0 && (
                    <span
                      className={`ml-1 ${
                        isActive ? "text-sky-200" : "text-sky-400"
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* 장비 카드 그리드 */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
            <span className="ml-2 text-sm text-gray-500">{t("equipmentLoading")}</span>
          </div>
        ) : filteredEquipment.length === 0 ? (
          <div className="text-center py-16">
            <Cpu className="h-10 w-10 text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-400">
              {searchQuery || categoryFilter !== "all"
                ? t("noEquipmentFiltered")
                : t("noEquipment")}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {filteredEquipment.map((eq) => {
              const isActive = getDeviceActive(eq);
              return (
                <Link
                  key={eq.id}
                  href={`/monitoring/${encodeURIComponent(eq.id)}`}
                  className="block group"
                >
                  <Card className="relative overflow-hidden transition-all hover:shadow-md hover:border-blue-200 group-hover:border-blue-200">
                    {/* 상태 바 */}
                    <div
                      className={`absolute top-0 left-0 right-0 h-1 ${
                        isActive === true
                          ? "bg-green-500"
                          : isActive === false
                          ? "bg-gray-200"
                          : "bg-gray-100"
                      }`}
                    />
                    <CardContent className="pt-4 pb-3 px-4">
                      <div className="flex items-center justify-between mb-2">
                        <Badge
                          className={`text-[10px] px-1.5 ${getTypeColor(eq.type)}`}
                        >
                          {getTypeLabelI18n(eq.type)}
                        </Badge>
                        <div className="flex items-center gap-1.5">
                          {isActive === true && (
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                          )}
                          {isActive !== null && (
                            isActive ? (
                              <Power className="h-3.5 w-3.5 text-green-500" />
                            ) : (
                              <PowerOff className="h-3.5 w-3.5 text-gray-300" />
                            )
                          )}
                        </div>
                      </div>
                      <p className="text-sm font-medium text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                        {getDisplayName(locale, eq.label, eq.name)}
                      </p>
                      <p className="text-[10px] text-gray-400 font-mono truncate">{eq.name}</p>
                      {eq.location && (
                        <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {formatLocation(locale, eq.location)}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}

        {/* 부품 현황 요약 배너 */}
        {componentEquipment.length > 0 && (
          <div className="border border-gray-200 rounded-lg">
            <button
              onClick={() => setShowComponentSummary(!showComponentSummary)}
              className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-gray-500 hover:bg-gray-50 rounded-lg"
            >
              <span className="flex items-center gap-2">
                {showComponentSummary ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                {t("componentSummaryTitle")}
                <span className="text-gray-400 text-xs">
                  {t("componentSummaryCount", {
                    valve: componentSummary["Valve"]?.count || 0,
                    damper: componentSummary["Damper"]?.count || 0,
                    vfd: componentSummary["VFD"]?.count || 0,
                  })}
                </span>
              </span>
              <Badge variant="outline" className="text-[10px]">
                {t("componentSummaryBadge", { count: componentEquipment.length })}
              </Badge>
            </button>

            {showComponentSummary && (
              <div className="px-4 pb-3 pt-1">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-400 border-b">
                      <th className="text-left py-1.5 font-medium">{t("componentType")}</th>
                      <th className="text-center py-1.5 font-medium">{t("componentCount")}</th>
                      <th className="text-left py-1.5 font-medium">{t("componentParent")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(componentSummary).map(([type, group]) => (
                      <tr key={type} className="border-b border-gray-50">
                        <td className="py-1.5">
                          <Badge className={`text-[10px] ${getTypeColor(type)}`}>
                            {getTypeLabelI18n(type)}
                          </Badge>
                        </td>
                        <td className="text-center text-gray-600">{group.count}</td>
                        <td className="text-gray-400">
                          {group.items[0]?.location
                            ? formatLocation(locale, group.items[0].location)
                            : "—"}
                          {group.count > 1 && group.items[0]?.location && " 외"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-[10px] text-gray-400 mt-2">
                  {t("componentNote")}
                </p>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

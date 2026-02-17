"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LiveChart, type ChartDataPoint } from "@/components/charts/live-chart";
import { useSSE } from "@/lib/sse";
import {
  getEquipmentList,
  type EquipmentListItem,
} from "@/lib/api";
import {
  Thermometer,
  Wind,
  Gauge,
  Filter,
  Power,
  PowerOff,
  Cpu,
  MapPin,
  ChevronDown,
  ChevronRight,
  Search,
  Loader2,
} from "lucide-react";

/**
 * 모니터링 페이지
 * 1) 전체 장비 목록 (유형별 필터, 검색, 클릭 시 상세 이동)
 * 2) AHU_5F 센서 실시간 차트 (접기/펼치기)
 */

// ── 장비 유형 필터 탭 ──
const TYPE_FILTERS = [
  { key: "all", label: "전체" },
  { key: "AHU", label: "AHU" },
  { key: "Fan", label: "팬" },
  { key: "Pump", label: "펌프" },
  { key: "Chiller", label: "칠러" },
  { key: "Boiler", label: "보일러" },
  { key: "Cooling_Tower", label: "냉각탑" },
  { key: "FCU", label: "FCU" },
  { key: "Elevator", label: "엘리베이터" },
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

function getTypeLabel(type: string): string {
  const map: Record<string, string> = {
    AHU: "공조기",
    Air_Handler_Unit: "공조기",
    Fan: "팬",
    Supply_Fan: "급기팬",
    Return_Fan: "환기팬",
    Exhaust_Fan: "배기팬",
    Pump: "펌프",
    Chiller: "칠러",
    Boiler: "보일러",
    Cooling_Tower: "냉각탑",
    FCU: "팬코일",
    Elevator: "엘리베이터",
    VFD: "인버터",
    Heat_Exchanger: "열교환기",
    Valve: "밸브",
    Damper: "댐퍼",
    Cooling_Coil: "냉각코일",
    Heating_Coil: "가열코일",
  };
  return map[type] || type;
}

// ── AHU_5F 센서 정의 (기존 유지) ──
const SENSORS = [
  {
    id: "bldg:Zone_Air_Temp_5F_Interior",
    name: "존 공기온도",
    description: "Zone Air Temperature",
    unit: "°C",
    color: "#ef4444",
    icon: Thermometer,
    yMin: 15,
    yMax: 35,
  },
  {
    id: "bldg:Zone_Air_Humidity_5F_Interior",
    name: "존 공기습도",
    description: "Zone Air Humidity",
    unit: "%RH",
    color: "#3b82f6",
    icon: Wind,
    yMin: 20,
    yMax: 80,
  },
  {
    id: "bldg:Supply_Air_Temp_AHU_5F",
    name: "급기온도",
    description: "Supply Air Temperature",
    unit: "°C",
    color: "#f59e0b",
    icon: Thermometer,
    yMin: 10,
    yMax: 30,
  },
  {
    id: "bldg:Filter_DP_AHU_5F",
    name: "필터 차압",
    description: "Filter Differential Pressure",
    unit: "Pa",
    color: "#8b5cf6",
    icon: Filter,
    yMin: 100,
    yMax: 500,
  },
  {
    id: "bldg:Power_AHU_5F",
    name: "전력 소비",
    description: "Electrical Power",
    unit: "kW",
    color: "#10b981",
    icon: Gauge,
    yMin: 0,
    yMax: 50,
  },
];

export default function MonitoringPage() {
  const { points, pointHistory, devices, connected } = useSSE(60);

  const [equipment, setEquipment] = useState<EquipmentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showSensorCharts, setShowSensorCharts] = useState(false);

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

  // 필터링된 장비 목록
  const filteredEquipment = useMemo(() => {
    let list = equipment;

    // 유형 필터
    if (typeFilter !== "all") {
      list = list.filter((eq) =>
        eq.brick_class.some((c) =>
          c.toLowerCase().includes(typeFilter.toLowerCase())
        )
      );
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
  }, [equipment, typeFilter, searchQuery]);

  // 장비별 실시간 상태 매칭 (SSE devices 데이터)
  const getDeviceActive = (eq: EquipmentListItem): boolean | null => {
    const dev = devices[eq.id] || devices[eq.name];
    if (dev) return dev.is_active;
    return eq.is_active;
  };

  // 유형별 카운트
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { all: equipment.length };
    for (const eq of equipment) {
      for (const filter of TYPE_FILTERS) {
        if (filter.key === "all") continue;
        if (
          eq.brick_class.some((c) =>
            c.toLowerCase().includes(filter.key.toLowerCase())
          )
        ) {
          counts[filter.key] = (counts[filter.key] || 0) + 1;
        }
      }
    }
    return counts;
  }, [equipment]);

  // AHU_5F 차트 데이터
  const chartDataMap = useMemo(() => {
    const map: Record<string, ChartDataPoint[]> = {};
    for (const sensor of SENSORS) {
      const history = pointHistory[sensor.id] || [];
      map[sensor.id] = history.map((p) => ({
        time: new Date(p.ts * 1000).toLocaleTimeString("ko-KR", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
        value: typeof p.value === "number" ? p.value : 0,
      }));
    }
    return map;
  }, [pointHistory]);

  return (
    <div className="min-h-screen">
      <Header
        title="모니터링"
        description={`전체 장비 ${equipment.length}대 | 실시간 상태 모니터링`}
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
              placeholder="장비명, 유형, 위치 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* 유형 필터 탭 */}
        <div className="flex flex-wrap gap-1.5">
          {TYPE_FILTERS.map((filter) => {
            const count = typeCounts[filter.key] || 0;
            const isActive = typeFilter === filter.key;
            return (
              <button
                key={filter.key}
                onClick={() => setTypeFilter(filter.key)}
                className={`px-3 py-1.5 text-xs rounded-full transition-colors ${
                  isActive
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {filter.label}
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

        {/* 장비 카드 그리드 */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
            <span className="ml-2 text-sm text-gray-500">장비 목록 로딩 중...</span>
          </div>
        ) : filteredEquipment.length === 0 ? (
          <div className="text-center py-16">
            <Cpu className="h-10 w-10 text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-400">
              {searchQuery || typeFilter !== "all"
                ? "검색 조건에 맞는 장비가 없습니다"
                : "등록된 장비가 없습니다"}
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
                          {getTypeLabel(eq.type)}
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
                        {eq.name.replace(/_/g, " ")}
                      </p>
                      {eq.location && (
                        <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {eq.location.replace(/_/g, " ")}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}

        {/* AHU_5F 실시간 센서 차트 (접기/펼치기) */}
        <div className="border-t border-gray-200 pt-4">
          <button
            onClick={() => setShowSensorCharts(!showSensorCharts)}
            className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            {showSensorCharts ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            AHU 5층 실시간 센서 차트
            <Badge variant="outline" className="text-[10px]">
              {SENSORS.length}개 센서
            </Badge>
          </button>

          {showSensorCharts && (
            <div className="mt-4 space-y-6">
              {/* 센서 현재값 카드 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
                {SENSORS.map((sensor) => {
                  const current = points[sensor.id];
                  const value =
                    current && typeof current.value === "number"
                      ? current.value
                      : null;
                  const Icon = sensor.icon;

                  return (
                    <Card key={sensor.id}>
                      <CardContent className="pt-4 pb-3 px-4">
                        <div className="flex items-center justify-between mb-2">
                          <Icon
                            className="h-5 w-5"
                            style={{ color: sensor.color }}
                          />
                          <Badge
                            variant={
                              current?.quality === "good"
                                ? "success"
                                : current
                                ? "warning"
                                : "secondary"
                            }
                          >
                            {current?.quality || "N/A"}
                          </Badge>
                        </div>
                        <div className="mt-1">
                          <p className="text-xs text-gray-500 font-medium">
                            {sensor.name}
                          </p>
                          <p className="text-2xl font-bold mt-0.5">
                            {value !== null ? value.toFixed(1) : "--"}
                            <span className="text-sm font-normal text-gray-400 ml-1">
                              {sensor.unit}
                            </span>
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* 각 센서별 라인 차트 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {SENSORS.map((sensor) => {
                  const chartData = chartDataMap[sensor.id];

                  return (
                    <Card key={sensor.id}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: sensor.color }}
                            />
                            {sensor.name}
                            <span className="text-xs text-gray-400 font-normal">
                              ({sensor.description})
                            </span>
                          </CardTitle>
                          {points[sensor.id] && (
                            <span
                              className="text-lg font-bold"
                              style={{ color: sensor.color }}
                            >
                              {typeof points[sensor.id].value === "number"
                                ? points[sensor.id].value!.toFixed(1)
                                : "--"}
                              <span className="text-xs font-normal text-gray-400 ml-1">
                                {sensor.unit}
                              </span>
                            </span>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent>
                        {chartData.length > 0 ? (
                          <LiveChart
                            data={chartData}
                            unit={sensor.unit}
                            color={sensor.color}
                            height={200}
                            yMin={sensor.yMin}
                            yMax={sensor.yMax}
                          />
                        ) : (
                          <div className="flex items-center justify-center h-[200px] text-gray-400 text-sm">
                            <div className="text-center">
                              <Gauge className="h-6 w-6 mx-auto mb-2 opacity-30" />
                              <p>데이터 수신 대기 중...</p>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

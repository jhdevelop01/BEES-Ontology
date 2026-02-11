"use client";

import React, { useMemo } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LiveChart, type ChartDataPoint } from "@/components/charts/live-chart";
import { useSSE } from "@/lib/sse";
import { Thermometer, Wind, Gauge, Filter } from "lucide-react";

/**
 * 모니터링 페이지
 * AHU_5F 연결 센서 5개의 실시간 값 + 각 센서별 라인 차트
 */

// AHU_5F의 5개 주요 센서 정의 (실제 MQTT point_id 사용)
const SENSORS = [
  {
    id: "bldg:Zone_Air_Temp_5F_Interior",
    name: "존 공기온도",
    description: "Zone Air Temperature",
    unit: "°C",
    color: "#ef4444", // red
    icon: Thermometer,
    yMin: 15,
    yMax: 35,
  },
  {
    id: "bldg:Zone_Air_Humidity_5F_Interior",
    name: "존 공기습도",
    description: "Zone Air Humidity",
    unit: "%RH",
    color: "#3b82f6", // blue
    icon: Wind,
    yMin: 20,
    yMax: 80,
  },
  {
    id: "bldg:Supply_Air_Temp_AHU_5F",
    name: "급기온도",
    description: "Supply Air Temperature",
    unit: "°C",
    color: "#f59e0b", // amber
    icon: Thermometer,
    yMin: 10,
    yMax: 30,
  },
  {
    id: "bldg:Filter_DP_AHU_5F",
    name: "필터 차압",
    description: "Filter Differential Pressure",
    unit: "Pa",
    color: "#8b5cf6", // purple
    icon: Filter,
    yMin: 100,
    yMax: 500,
  },
  {
    id: "bldg:Power_AHU_5F",
    name: "전력 소비",
    description: "Electrical Power",
    unit: "kW",
    color: "#10b981", // green
    icon: Gauge,
    yMin: 0,
    yMax: 50,
  },
];

export default function MonitoringPage() {
  const { points, pointHistory, connected } = useSSE(60);

  // 각 센서의 차트 데이터 생성
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
        description="AHU 5층 센서 실시간 모니터링"
        connected={connected}
      />

      <div className="p-6 space-y-6">
        {/* 센서 현재값 카드 (가로 5개) */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
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
                    {/* 현재값 표시 */}
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

        {/* 센서 데이터 테이블 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              AHU 5층 센서 상세
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-3 text-gray-500 font-medium">
                      센서
                    </th>
                    <th className="text-left py-2 px-3 text-gray-500 font-medium">
                      설명
                    </th>
                    <th className="text-right py-2 px-3 text-gray-500 font-medium">
                      현재값
                    </th>
                    <th className="text-left py-2 px-3 text-gray-500 font-medium">
                      단위
                    </th>
                    <th className="text-left py-2 px-3 text-gray-500 font-medium">
                      상태
                    </th>
                    <th className="text-right py-2 px-3 text-gray-500 font-medium">
                      마지막 수신
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {SENSORS.map((sensor) => {
                    const current = points[sensor.id];
                    const value =
                      current && typeof current.value === "number"
                        ? current.value
                        : null;

                    return (
                      <tr
                        key={sensor.id}
                        className="border-b border-gray-50 hover:bg-gray-50"
                      >
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: sensor.color }}
                            />
                            <span className="font-medium">{sensor.name}</span>
                          </div>
                        </td>
                        <td className="py-2 px-3 text-gray-500 text-xs">
                          {sensor.description}
                        </td>
                        <td className="py-2 px-3 text-right font-semibold">
                          {value !== null ? value.toFixed(2) : "--"}
                        </td>
                        <td className="py-2 px-3 text-gray-500">
                          {sensor.unit}
                        </td>
                        <td className="py-2 px-3">
                          <Badge
                            variant={
                              current?.quality === "good"
                                ? "success"
                                : current
                                ? "warning"
                                : "secondary"
                            }
                          >
                            {current?.quality || "미연결"}
                          </Badge>
                        </td>
                        <td className="py-2 px-3 text-right text-xs text-gray-400">
                          {current?.ts
                            ? new Date(
                                current.ts * 1000
                              ).toLocaleTimeString("ko-KR")
                            : "-"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

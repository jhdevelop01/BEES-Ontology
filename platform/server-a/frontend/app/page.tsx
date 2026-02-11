"use client";

import React, { useEffect, useState, useMemo } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LiveChart, type ChartDataPoint } from "@/components/charts/live-chart";
import { useSSE } from "@/lib/sse";
import { getDashboardSummary, type DashboardSummary } from "@/lib/api";
import {
  Activity,
  Thermometer,
  AlertTriangle,
  Radio,
  Power,
  PowerOff,
} from "lucide-react";

/**
 * 대시보드 페이지 (메인)
 * KPI 카드 4개 + AHU_5F 센서 실시간 차트 + 장비 상태 카드
 */
export default function DashboardPage() {
  const { points, pointHistory, devices, connected } = useSSE(60);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  // 대시보드 요약 데이터 로딩 (5초마다 갱신)
  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const data = await getDashboardSummary();
        setSummary(data);
      } catch (err) {
        console.error("[BEES] 대시보드 API 호출 실패:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
    const interval = setInterval(fetchSummary, 5000);
    return () => clearInterval(interval);
  }, []);

  // KPI 값 계산 (MQTT 실시간 데이터 우선, 없으면 API 요약)
  const activeDevices = useMemo(() => {
    const mqttActive = Object.values(devices).filter(
      (d) => d.is_active
    ).length;
    return mqttActive || summary?.kpi.active_devices || 0;
  }, [devices, summary]);

  const totalDevices = summary?.kpi.total_devices || 42;

  const avgTemperature = useMemo(() => {
    const temps = Object.entries(points)
      .filter(([key]) => key.toLowerCase().includes("temp"))
      .map(([, v]) => v.value)
      .filter((v): v is number => typeof v === "number");
    return temps.length > 0
      ? Math.round((temps.reduce((a, b) => a + b, 0) / temps.length) * 10) / 10
      : summary?.kpi.avg_temperature || 24.0;
  }, [points, summary]);

  const alarmCount = summary?.kpi.alarm_count || 0;
  const simStatus = summary?.kpi.simulation_status || (connected ? "running" : "stopped");

  // AHU_5F 급기온도 차트 데이터
  const satChartData = useMemo((): ChartDataPoint[] => {
    const history = pointHistory["bldg:Supply_Air_Temp_AHU_5F"] || [];
    return history.map((p) => ({
      time: new Date(p.ts * 1000).toLocaleTimeString("ko-KR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
      value: typeof p.value === "number" ? p.value : 0,
    }));
  }, [pointHistory]);

  // 장비 상태 목록
  const deviceList = useMemo(() => {
    const mqttDevices = Object.values(devices);
    if (mqttDevices.length > 0) return mqttDevices;
    return summary?.devices || [];
  }, [devices, summary]);

  return (
    <div className="min-h-screen">
      <Header
        title="대시보드"
        description="GEC B동 전체 현황"
        connected={connected}
      />

      <div className="p-6 space-y-6">
        {/* KPI 카드 4개 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 활성 장비 */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                활성 장비
              </CardTitle>
              <Activity className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {activeDevices}
                <span className="text-sm font-normal text-gray-400 ml-1">
                  / {totalDevices}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                전체 장비 중 가동 중
              </p>
            </CardContent>
          </Card>

          {/* 평균 온도 */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                평균 온도
              </CardTitle>
              <Thermometer className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {avgTemperature}
                <span className="text-sm font-normal text-gray-400 ml-1">
                  °C
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                온도 센서 평균값
              </p>
            </CardContent>
          </Card>

          {/* 활성 알람 */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                활성 알람
              </CardTitle>
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {alarmCount}
                <span className="text-sm font-normal text-gray-400 ml-1">
                  건
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                현재 미해결 알람
              </p>
            </CardContent>
          </Card>

          {/* 시뮬레이션 상태 */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                시뮬레이션
              </CardTitle>
              <Radio className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <Badge
                variant={simStatus === "running" ? "success" : "secondary"}
              >
                {simStatus === "running" ? "실행 중" : "중지"}
              </Badge>
              <p className="text-xs text-gray-500 mt-2">
                Server C 에뮬레이터
              </p>
            </CardContent>
          </Card>
        </div>

        {/* 실시간 센서 차트 + 장비 상태 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* AHU_5F 실시간 차트 (2/3 너비) */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">
                AHU 5층 — 급기온도 실시간 트렌드
              </CardTitle>
            </CardHeader>
            <CardContent>
              {satChartData.length > 0 ? (
                <LiveChart
                  data={satChartData}
                  unit="°C"
                  color="#3b82f6"
                  height={280}
                  yMin={10}
                  yMax={30}
                />
              ) : (
                <div className="flex items-center justify-center h-[280px] text-gray-400 text-sm">
                  <div className="text-center">
                    <Radio className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p>실시간 데이터 대기 중...</p>
                    <p className="text-xs mt-1">
                      Server C 시뮬레이션이 시작되면 차트가 표시됩니다
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 장비 상태 카드 (1/3 너비) */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">장비 상태</CardTitle>
            </CardHeader>
            <CardContent>
              {deviceList.length > 0 ? (
                <div className="space-y-3">
                  {deviceList.map((device) => (
                    <div
                      key={device.device_id}
                      className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
                    >
                      <div className="flex items-center gap-2">
                        {device.is_active ? (
                          <Power className="h-4 w-4 text-green-500" />
                        ) : (
                          <PowerOff className="h-4 w-4 text-gray-300" />
                        )}
                        <span className="text-sm font-medium">
                          {device.device_id}
                        </span>
                      </div>
                      <Badge
                        variant={device.is_active ? "success" : "secondary"}
                      >
                        {device.is_active ? "ON" : "OFF"}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400 text-sm">
                  <PowerOff className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p>장비 상태 데이터 없음</p>
                  <p className="text-xs mt-1">
                    MQTT 연결 후 표시됩니다
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 최근 센서 데이터 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">최근 센서 데이터</CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(points).length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-3 text-gray-500 font-medium">
                        센서 ID
                      </th>
                      <th className="text-right py-2 px-3 text-gray-500 font-medium">
                        값
                      </th>
                      <th className="text-left py-2 px-3 text-gray-500 font-medium">
                        단위
                      </th>
                      <th className="text-left py-2 px-3 text-gray-500 font-medium">
                        품질
                      </th>
                      <th className="text-right py-2 px-3 text-gray-500 font-medium">
                        시각
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.values(points)
                      .sort((a, b) => (b.ts || 0) - (a.ts || 0))
                      .slice(0, 10)
                      .map((p) => (
                        <tr
                          key={p.point_id}
                          className="border-b border-gray-50 hover:bg-gray-50"
                        >
                          <td className="py-2 px-3 font-mono text-xs">
                            {p.point_id}
                          </td>
                          <td className="py-2 px-3 text-right font-semibold">
                            {typeof p.value === "number"
                              ? p.value.toFixed(2)
                              : "-"}
                          </td>
                          <td className="py-2 px-3 text-gray-500">
                            {p.unit}
                          </td>
                          <td className="py-2 px-3">
                            <Badge
                              variant={
                                p.quality === "good" ? "success" : "warning"
                              }
                            >
                              {p.quality}
                            </Badge>
                          </td>
                          <td className="py-2 px-3 text-right text-xs text-gray-400">
                            {p.ts
                              ? new Date(p.ts * 1000).toLocaleTimeString(
                                  "ko-KR"
                                )
                              : "-"}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400 text-sm">
                <p>실시간 센서 데이터가 아직 수신되지 않았습니다.</p>
                <p className="text-xs mt-1">
                  Server C 시뮬레이션 시작 후 MQTT를 통해 데이터가 수신됩니다.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

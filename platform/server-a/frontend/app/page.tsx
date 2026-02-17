"use client";

import React, { useEffect, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { Header } from "@/components/layout/header";
import { useSSE } from "@/lib/sse";
import { useTranslations } from "next-intl";
import { getDashboardSummary, type DashboardSummary } from "@/lib/api";
import type { ChartDataPoint } from "@/components/charts/live-chart";

const DashboardGrid = dynamic(
  () =>
    import("@/components/dashboard/dashboard-grid").then(
      (mod) => mod.DashboardGrid
    ),
  { ssr: false }
);

/**
 * 대시보드 페이지 (메인)
 * KPI 카드 4개 + AHU_5F 센서 실시간 차트 + 장비 상태 카드
 * react-grid-layout 기반 드래그&리사이즈 위젯 그리드
 */
export default function DashboardPage() {
  const t = useTranslations("dashboard");
  const { points, pointHistory, devices, alarms, connected } = useSSE(60);
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

  const alarmCount = alarms.length || summary?.kpi.alarm_count || 0;
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
        title={t("title")}
        description={t("description")}
        connected={connected}
      />

      <div className="p-3 md:p-6">
        <DashboardGrid
          activeDevices={activeDevices}
          totalDevices={totalDevices}
          avgTemperature={avgTemperature}
          alarmCount={alarmCount}
          simStatus={simStatus}
          satChartData={satChartData}
          deviceList={deviceList}
          alarms={alarms}
          points={points}
        />
      </div>
    </div>
  );
}

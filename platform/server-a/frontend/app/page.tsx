"use client";

import React, { useEffect, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { Header } from "@/components/layout/header";
import { useSSE } from "@/lib/sse";
import { useTranslations } from "next-intl";
import {
  getDashboardSummary,
  getEnergyRealtime,
  getEnergyComparison,
  getEnergyProfile,
  getAlarmStats,
  getEquipmentList,
  type DashboardSummary,
  type EnergyRealtime,
  type EnergyComparison,
  type EnergyProfileData,
  type AlarmStats,
  type EquipmentListItem,
} from "@/lib/api";

const DashboardGrid = dynamic(
  () => import("@/components/dashboard/dashboard-grid").then((mod) => mod.DashboardGrid),
  { ssr: false }
);

export default function DashboardPage() {
  const t = useTranslations("dashboard");
  const { points, devices, alarms, connected } = useSSE(60);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [energyRealtime, setEnergyRealtime] = useState<EnergyRealtime | null>(null);
  const [energyComparison, setEnergyComparison] = useState<EnergyComparison | null>(null);
  const [energyProfile, setEnergyProfile] = useState<EnergyProfileData | null>(null);
  const [alarmStats, setAlarmStats] = useState<AlarmStats | null>(null);
  const [equipmentList, setEquipmentList] = useState<EquipmentListItem[]>([]);

  // 대시보드 요약 + 에너지 실시간 + 알람 통계 (30초 폴링)
  useEffect(() => {
    const fetchCore = async () => {
      try {
        const [summ, energy, comparison, stats] = await Promise.allSettled([
          getDashboardSummary(),
          getEnergyRealtime(),
          getEnergyComparison("week"),
          getAlarmStats(),
        ]);
        if (summ.status === "fulfilled") setSummary(summ.value);
        if (energy.status === "fulfilled") setEnergyRealtime(energy.value);
        if (comparison.status === "fulfilled") setEnergyComparison(comparison.value);
        if (stats.status === "fulfilled") setAlarmStats(stats.value);
      } catch (err) {
        console.error("[BEES] 대시보드 코어 데이터 실패:", err);
      }
    };
    fetchCore();
    const interval = setInterval(fetchCore, 30000);
    return () => clearInterval(interval);
  }, []);

  // 장비 목록 (1회) + 에너지 프로파일 (5분 폴링)
  useEffect(() => {
    const fetchEquipment = async () => {
      try {
        const resp = await getEquipmentList();
        setEquipmentList(resp.items.filter(e => e.category !== "component"));
      } catch (err) {
        console.error("[BEES] 장비 목록 실패:", err);
      }
    };
    fetchEquipment();
  }, []);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const profile = await getEnergyProfile("24h");
        setEnergyProfile(profile);
      } catch (err) {
        console.error("[BEES] 에너지 프로파일 실패:", err);
      }
    };
    fetchProfile();
    const interval = setInterval(fetchProfile, 300000); // 5분
    return () => clearInterval(interval);
  }, []);

  // KPI 계산
  const activeDevices = useMemo(() => {
    const mqttActive = Object.values(devices).filter((d) => d.is_active).length;
    return mqttActive || summary?.kpi.active_devices || 0;
  }, [devices, summary]);

  const totalDevices = equipmentList.length || summary?.kpi.total_devices || 201;
  const simStatus = summary?.kpi.simulation_status || (connected ? "running" : "stopped");

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
          energyKw={energyRealtime?.total_kw ?? null}
          energyChangePct={energyComparison?.change_pct ?? null}
          alarmCritical={alarmStats?.stats?.critical || 0}
          alarmWarning={alarmStats?.stats?.warning || 0}
          alarmInfo={alarmStats?.stats?.info || 0}
          simStatus={simStatus}
          devices={devices}
          equipmentList={equipmentList}
          points={points}
          alarms={alarms}
          energyProfile={energyProfile}
        />
      </div>
    </div>
  );
}

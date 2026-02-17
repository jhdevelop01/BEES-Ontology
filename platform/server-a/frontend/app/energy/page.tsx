"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  getEnergyRealtime,
  getEnergyProfile,
  getEnergyBreakdown,
  getEnergyComparison,
  getEnergyEUI,
  type EnergyRealtime,
  type EnergyProfileData,
  type EnergyBreakdown,
  type EnergyComparison,
  type EnergyEUI,
} from "@/lib/api";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import {
  Zap,
  TrendingUp,
  TrendingDown,
  Activity,
  Loader2,
  BarChart3,
  PieChart as PieChartIcon,
  Gauge,
  Clock,
} from "lucide-react";
import { useTranslations } from "next-intl";

const PIE_COLORS = ["#3b82f6", "#ef4444", "#f59e0b", "#10b981", "#8b5cf6", "#ec4899", "#06b6d4"];
const BAR_COLORS = ["#3b82f6", "#60a5fa", "#93c5fd", "#bfdbfe", "#dbeafe"];

const PROFILE_PERIODS = [
  { labelKey: "period24h", value: "24h" },
  { labelKey: "period7d", value: "7d" },
  { labelKey: "period30d", value: "30d" },
] as const;

const COMPARISON_PERIODS = [
  { labelKey: "periodWeek", value: "week" },
  { labelKey: "periodMonth", value: "month" },
] as const;

export default function EnergyPage() {
  const t = useTranslations("energy");
  const tc = useTranslations("common");

  const [realtime, setRealtime] = useState<EnergyRealtime | null>(null);
  const [profile, setProfile] = useState<EnergyProfileData | null>(null);
  const [breakdown, setBreakdown] = useState<EnergyBreakdown | null>(null);
  const [comparison, setComparison] = useState<EnergyComparison | null>(null);
  const [eui, setEui] = useState<EnergyEUI | null>(null);
  const [loading, setLoading] = useState(true);

  const [profilePeriod, setProfilePeriod] = useState("24h");
  const [comparisonPeriod, setComparisonPeriod] = useState("week");

  // 초기 로딩
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [rt, bd, eu] = await Promise.all([
          getEnergyRealtime().catch(() => null),
          getEnergyBreakdown().catch(() => null),
          getEnergyEUI().catch(() => null),
        ]);
        setRealtime(rt);
        setBreakdown(bd);
        setEui(eu);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // 프로파일 (기간 변경 시)
  useEffect(() => {
    getEnergyProfile(profilePeriod)
      .then(setProfile)
      .catch(() => null);
  }, [profilePeriod]);

  // 비교 (기간 변경 시)
  useEffect(() => {
    getEnergyComparison(comparisonPeriod)
      .then(setComparison)
      .catch(() => null);
  }, [comparisonPeriod]);

  // 자동 갱신 (30초)
  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const rt = await getEnergyRealtime();
        setRealtime(rt);
      } catch {
        // ignore
      }
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  // 프로파일 차트 데이터 가공
  const profileChartData = useMemo(() => {
    if (!profile?.data) return [];
    // 타임스탬프 기준 그룹핑하여 합계
    const tsMap = new Map<number, { time: string; total: number }>();
    for (const d of profile.data) {
      const ts = d.ts;
      if (!tsMap.has(ts)) {
        const date = new Date(ts * 1000);
        const time = profilePeriod === "24h"
          ? date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })
          : date.toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" });
        tsMap.set(ts, { time, total: 0 });
      }
      const entry = tsMap.get(ts)!;
      entry.total += d.value || 0;
    }
    return Array.from(tsMap.values()).sort((a, b) => {
      const aIdx = Array.from(tsMap.keys()).indexOf(
        Array.from(tsMap.entries()).find(([, v]) => v === a)?.[0] || 0
      );
      const bIdx = Array.from(tsMap.keys()).indexOf(
        Array.from(tsMap.entries()).find(([, v]) => v === b)?.[0] || 0
      );
      return aIdx - bIdx;
    });
  }, [profile, profilePeriod]);

  // 시스템별 파이차트 데이터
  const pieData = useMemo(() => {
    if (!breakdown?.by_system) return [];
    return breakdown.by_system.map((s) => ({
      name: s.system || t("other"),
      value: s.kw,
    }));
  }, [breakdown]);

  // 층별 바차트 데이터
  const floorData = useMemo(() => {
    if (!breakdown?.by_floor) return [];
    return breakdown.by_floor.map((f) => ({
      name: f.floor || t("other"),
      kw: f.kw,
    }));
  }, [breakdown]);

  // 실시간 breakdown 카드 데이터
  const breakdownItems = useMemo(() => {
    if (!realtime?.breakdown) return [];
    return Object.entries(realtime.breakdown)
      .map(([system, kw]) => ({ system, kw }))
      .sort((a, b) => b.kw - a.kw);
  }, [realtime]);

  if (loading) {
    return (
      <div className="min-h-screen">
        <Header title={t("title")} description={t("loadingDesc")} />
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header title={t("title")} description={t("description")} />

      <div className="p-3 md:p-6 space-y-6">
        {/* 상단 KPI 카드 - 3열 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 현재 전력 */}
          <Card>
            <CardContent className="pt-5 pb-4 px-5">
              <div className="flex items-center justify-between mb-2">
                <Zap className="h-5 w-5 text-yellow-500" />
                <Badge variant="success">{t("realtime")}</Badge>
              </div>
              <p className="text-xs text-gray-500">{t("currentTotalPower")}</p>
              <p className="text-3xl font-bold mt-1">
                {realtime?.total_kw?.toFixed(1) ?? "--"}
                <span className="text-sm font-normal text-gray-400 ml-1">kW</span>
              </p>
              {breakdownItems.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100 space-y-1">
                  {breakdownItems.slice(0, 3).map((item) => (
                    <div key={item.system} className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">{item.system}</span>
                      <span className="font-medium">{item.kw.toFixed(1)} kW</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 시스템별 분류 파이차트 */}
          <Card>
            <CardContent className="pt-5 pb-4 px-5">
              <div className="flex items-center justify-between mb-2">
                <PieChartIcon className="h-5 w-5 text-blue-500" />
                <span className="text-xs text-gray-400">{t("systemRatio")}</span>
              </div>
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={35}
                      outerRadius={65}
                      dataKey="value"
                      paddingAngle={2}
                    >
                      {pieData.map((_, idx) => (
                        <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => [`${value.toFixed(1)} kW`, ""]}
                      contentStyle={{
                        backgroundColor: "white",
                        border: "1px solid #e5e7eb",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[160px] text-gray-400 text-sm">
                  {tc("noData")}
                </div>
              )}
              {pieData.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-1">
                  {pieData.map((d, i) => (
                    <div key={d.name} className="flex items-center gap-1 text-[10px]">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                      />
                      <span className="text-gray-500">{d.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* EUI 게이지 */}
          <Card>
            <CardContent className="pt-5 pb-4 px-5">
              <div className="flex items-center justify-between mb-2">
                <Gauge className="h-5 w-5 text-green-500" />
                <span className="text-xs text-gray-400">{t("energyIntensity")}</span>
              </div>
              <p className="text-xs text-gray-500">{t("euiLabel")}</p>
              <p className="text-3xl font-bold mt-1">
                {eui?.eui?.toFixed(1) ?? "--"}
              </p>
              {eui && (
                <>
                  <div className="mt-3 w-full bg-gray-100 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full transition-all ${
                        eui.eui <= eui.benchmark ? "bg-green-500" : "bg-red-500"
                      }`}
                      style={{ width: `${Math.min((eui.eui / (eui.benchmark * 1.5)) * 100, 100)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] mt-1">
                    <span className="text-gray-400">0</span>
                    <span className="text-gray-400">
                      {t("benchmark", { value: eui.benchmark })}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <Badge variant={eui.eui <= eui.benchmark ? "success" : "danger"}>
                      {eui.rating || (eui.eui <= eui.benchmark ? t("ratingGood") : t("ratingExceed"))}
                    </Badge>
                    <span className="text-xs text-gray-500">
                      {t("floorArea", { area: eui.area_m2?.toLocaleString() ?? "-" })}
                    </span>
                  </div>
                </>
              )}
              {!eui && (
                <div className="mt-4 text-sm text-gray-400">{t("noEUIData")}</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 24시간 에너지 프로파일 차트 - 전체 너비 */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-4 w-4" />
                {t("energyProfile")}
              </CardTitle>
              <div className="flex gap-1">
                {PROFILE_PERIODS.map((p) => (
                  <Button
                    key={p.value}
                    size="sm"
                    variant={profilePeriod === p.value ? "default" : "outline"}
                    onClick={() => setProfilePeriod(p.value)}
                    className="text-xs h-7 px-2"
                  >
                    <Clock className="h-3 w-3 mr-1" />
                    {t(p.labelKey)}
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {profileChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={profileChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="time"
                    tick={{ fontSize: 10, fill: "#9ca3af" }}
                    tickLine={false}
                    axisLine={{ stroke: "#e5e7eb" }}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "#9ca3af" }}
                    tickLine={false}
                    axisLine={{ stroke: "#e5e7eb" }}
                    unit=" kW"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                    formatter={(value: number) => [`${value.toFixed(1)} kW`, t("power")]}
                  />
                  <Line
                    type="monotone"
                    dataKey="total"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-gray-400 text-sm">
                <div className="text-center">
                  <Activity className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p>{t("noProfileData")}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 하단 2열: 층별 비교 + 기간 비교 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 층별 에너지 */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                {t("floorPower")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {floorData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={floorData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 10, fill: "#9ca3af" }}
                      unit=" kW"
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fontSize: 10, fill: "#9ca3af" }}
                      width={40}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "white",
                        border: "1px solid #e5e7eb",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                      formatter={(value: number) => [`${value.toFixed(1)} kW`, t("power")]}
                    />
                    <Bar dataKey="kw" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[280px] text-gray-400 text-sm">
                  <div className="text-center">
                    <BarChart3 className="h-6 w-6 mx-auto mb-2 opacity-30" />
                    <p>{t("noFloorData")}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 기간 비교 */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  {t("periodComparison")}
                </CardTitle>
                <div className="flex gap-1">
                  {COMPARISON_PERIODS.map((p) => (
                    <Button
                      key={p.value}
                      size="sm"
                      variant={comparisonPeriod === p.value ? "default" : "outline"}
                      onClick={() => setComparisonPeriod(p.value)}
                      className="text-xs h-7 px-2"
                    >
                      {t(p.labelKey)}
                    </Button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {comparison ? (
                <div className="space-y-6 py-4">
                  {/* 변화율 표시 */}
                  <div className="text-center">
                    <div
                      className={`inline-flex items-center gap-2 text-4xl font-bold ${
                        comparison.change_pct <= 0 ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {comparison.change_pct <= 0 ? (
                        <TrendingDown className="h-8 w-8" />
                      ) : (
                        <TrendingUp className="h-8 w-8" />
                      )}
                      {comparison.change_pct > 0 ? "+" : ""}
                      {comparison.change_pct}%
                    </div>
                    <p className="text-sm text-gray-500 mt-2">
                      {comparisonPeriod === "week" ? t("vsLastWeek") : t("vsLastMonth")}
                    </p>
                  </div>

                  {/* 비교 바 */}
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-gray-500">
                          {comparisonPeriod === "week" ? t("thisWeek") : t("thisMonth")}
                        </span>
                        <span className="font-semibold">{comparison.current.total_kwh.toFixed(1)} kWh</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-4">
                        <div
                          className="h-4 rounded-full bg-blue-500 transition-all"
                          style={{
                            width: `${
                              comparison.previous.total_kwh > 0
                                ? Math.min(
                                    (comparison.current.total_kwh / Math.max(comparison.current.total_kwh, comparison.previous.total_kwh)) * 100,
                                    100
                                  )
                                : 100
                            }%`,
                          }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-gray-500">
                          {comparisonPeriod === "week" ? t("lastWeek") : t("lastMonth")}
                        </span>
                        <span className="font-semibold">{comparison.previous.total_kwh.toFixed(1)} kWh</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-4">
                        <div
                          className="h-4 rounded-full bg-gray-400 transition-all"
                          style={{
                            width: `${
                              comparison.current.total_kwh > 0
                                ? Math.min(
                                    (comparison.previous.total_kwh / Math.max(comparison.current.total_kwh, comparison.previous.total_kwh)) * 100,
                                    100
                                  )
                                : 100
                            }%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* 절감/초과 */}
                  <div className="text-center">
                    <Badge variant={comparison.change_pct <= 0 ? "success" : "danger"}>
                      {comparison.change_pct <= 0
                        ? t("saved", { amount: Math.abs(comparison.current.total_kwh - comparison.previous.total_kwh).toFixed(1) })
                        : t("exceeded", { amount: Math.abs(comparison.current.total_kwh - comparison.previous.total_kwh).toFixed(1) })}
                    </Badge>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-[280px] text-gray-400 text-sm">
                  <div className="text-center">
                    <TrendingUp className="h-6 w-6 mx-auto mb-2 opacity-30" />
                    <p>{t("noComparisonData")}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

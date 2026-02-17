"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  getHistorianHealth,
  getHistorianInfo,
  getPointsSummary,
  type HistorianHealth,
  type MQTTWorkerStats,
  type PointSummaryItem,
} from "@/lib/api";
import {
  ShieldCheck,
  Loader2,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Activity,
  Database,
  Search,
  ArrowUpDown,
  Info,
} from "lucide-react";
import { useTranslations } from "next-intl";

type SortField = "point_id" | "last_value" | "last_time";
type SortDir = "asc" | "desc";

export default function DataQualityPage() {
  const t = useTranslations("dataQuality");
  const tc = useTranslations("common");

  const [health, setHealth] = useState<HistorianHealth | null>(null);
  const [workerStats, setWorkerStats] = useState<MQTTWorkerStats | null>(null);
  const [points, setPoints] = useState<PointSummaryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // 필터 & 정렬
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("point_id");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [healthData, infoData, summaryData] = await Promise.all([
        getHistorianHealth().catch(() => null),
        getHistorianInfo().catch(() => null),
        getPointsSummary().catch(() => null),
      ]);
      if (healthData) setHealth(healthData);
      if (infoData?.mqtt_worker) setWorkerStats(infoData.mqtt_worker);
      if (summaryData?.points) setPoints(summaryData.points);
    } catch (e) {
      console.error("데이터 품질 로딩 실패:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 품질 통계
  const qualityStats = useMemo(() => {
    if (!workerStats?.quality_stats) {
      return { good: 0, uncertain: 0, bad: 0, total: 0, goodPct: 0 };
    }
    const qs = workerStats.quality_stats;
    const total = qs.good + qs.uncertain + qs.bad;
    return {
      ...qs,
      total,
      goodPct: total > 0 ? ((qs.good / total) * 100).toFixed(1) : "0.0",
    };
  }, [workerStats]);

  // 필터/정렬된 포인트 목록
  const filteredPoints = useMemo(() => {
    let filtered = points;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      filtered = filtered.filter((p) => p.point_id.toLowerCase().includes(q));
    }
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "point_id":
          cmp = a.point_id.localeCompare(b.point_id);
          break;
        case "last_value":
          cmp = (a.last_value ?? 0) - (b.last_value ?? 0);
          break;
        case "last_time":
          cmp = (a.last_time || "").localeCompare(b.last_time || "");
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [points, searchQuery, sortField, sortDir]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => (
    <ArrowUpDown
      className={`h-3 w-3 ml-1 inline ${
        sortField === field ? "text-blue-500" : "text-gray-300"
      }`}
    />
  );

  return (
    <div className="min-h-screen">
      <Header title={t("title")} description={t("description")} />

      <div className="p-3 md:p-6 space-y-6">
        {/* ── 상단 요약 카드 ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* 총 포인트 */}
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center justify-between">
                <Activity className="h-5 w-5 text-blue-500" />
                <span className="text-2xl font-bold text-blue-600">
                  {points.length}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">{t("totalPoints")}</p>
            </CardContent>
          </Card>

          {/* 정상 (good) */}
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center justify-between">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <span className="text-2xl font-bold text-green-600">
                  {qualityStats.good.toLocaleString()}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {t("goodPct", { pct: qualityStats.goodPct })}
              </p>
            </CardContent>
          </Card>

          {/* 불확실 (uncertain) */}
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center justify-between">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                <span className="text-2xl font-bold text-yellow-600">
                  {qualityStats.uncertain.toLocaleString()}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">{t("uncertain")}</p>
            </CardContent>
          </Card>

          {/* 불량 (bad) */}
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center justify-between">
                <XCircle className="h-5 w-5 text-red-500" />
                <span className="text-2xl font-bold text-red-600">
                  {qualityStats.bad.toLocaleString()}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">{t("bad")}</p>
            </CardContent>
          </Card>
        </div>

        {/* ── 시스템 상태 카드 ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Historian 서비스 상태 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Database className="h-4 w-4 text-gray-500" />
                {t("historianStatus")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {health ? (
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">{t("service")}</span>
                    <span className="ml-2">
                      <Badge
                        variant={health.status === "ok" ? "success" : "warning"}
                      >
                        {health.status}
                      </Badge>
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">InfluxDB:</span>
                    <span className="ml-2">
                      <Badge
                        variant={
                          health.influxdb === "pass" ? "success" : "warning"
                        }
                      >
                        {health.influxdb}
                      </Badge>
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">PostgreSQL:</span>
                    <span className="ml-2">
                      <Badge
                        variant={
                          health.postgres === "pass" ? "success" : "warning"
                        }
                      >
                        {health.postgres}
                      </Badge>
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">MQTT:</span>
                    <span className="ml-2">
                      <Badge
                        variant={
                          health.mqtt === "connected" ? "success" : "danger"
                        }
                      >
                        {health.mqtt}
                      </Badge>
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-500">{t("uptime")}</span>
                    <span className="ml-2 font-mono text-xs">
                      {t("uptimeFormat", { hours: Math.floor(health.uptime_seconds / 3600), minutes: Math.floor((health.uptime_seconds % 3600) / 60) })}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-400">{t("connectionCheck")}</p>
              )}
            </CardContent>
          </Card>

          {/* MQTT 워커 통계 */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-green-500" />
                  {t("qualityStats")}
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchData(true)}
                  disabled={refreshing}
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`}
                  />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {workerStats ? (
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">{t("messagesReceived")}</span>
                    <span className="ml-2 font-mono">
                      {workerStats.messages_received.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">{t("pointsWritten")}</span>
                    <span className="ml-2 font-mono">
                      {workerStats.points_written.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">{t("alarmsSaved")}</span>
                    <span className="ml-2 font-mono">
                      {workerStats.alarms_saved.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">{t("errors")}</span>
                    <span className="ml-2 font-mono">
                      <Badge
                        variant={workerStats.errors > 0 ? "danger" : "success"}
                      >
                        {workerStats.errors}
                      </Badge>
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">{t("buffer")}</span>
                    <span className="ml-2 font-mono">
                      {workerStats.buffer_size}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">MQTT:</span>
                    <span className="ml-2">
                      <Badge
                        variant={
                          workerStats.mqtt_connected ? "success" : "danger"
                        }
                      >
                        {workerStats.mqtt_connected ? t("mqttConnected") : t("mqttDisconnected")}
                      </Badge>
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-400">{t("noStats")}</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── 포인트 목록 테이블 ── */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Activity className="h-4 w-4" />
                {t("pointStatus", { count: filteredPoints.length })}
              </CardTitle>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder={t("pointIdSearch")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
              </div>
            ) : filteredPoints.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th
                        className="text-left py-2 px-3 text-gray-500 font-medium cursor-pointer hover:text-gray-700"
                        onClick={() => handleSort("point_id")}
                      >
                        {t("thPointId")}
                        <SortIcon field="point_id" />
                      </th>
                      <th
                        className="text-right py-2 px-3 text-gray-500 font-medium cursor-pointer hover:text-gray-700"
                        onClick={() => handleSort("last_value")}
                      >
                        {t("thLatestValue")}
                        <SortIcon field="last_value" />
                      </th>
                      <th className="text-left py-2 px-3 text-gray-500 font-medium">
                        {t("thUnit")}
                      </th>
                      <th
                        className="text-left py-2 px-3 text-gray-500 font-medium cursor-pointer hover:text-gray-700"
                        onClick={() => handleSort("last_time")}
                      >
                        {t("thLastReceived")}
                        <SortIcon field="last_time" />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPoints.map((pt) => (
                      <tr
                        key={pt.point_id}
                        className="border-b border-gray-50 hover:bg-gray-50"
                      >
                        <td className="py-2 px-3 font-mono text-xs">
                          {pt.point_id}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-xs">
                          {pt.last_value !== null
                            ? pt.last_value.toFixed(2)
                            : "--"}
                        </td>
                        <td className="py-2 px-3 text-xs text-gray-500">
                          {pt.unit || "-"}
                        </td>
                        <td className="py-2 px-3 text-xs text-gray-400">
                          {pt.last_time
                            ? new Date(pt.last_time).toLocaleString("ko-KR", {
                                month: "2-digit",
                                day: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit",
                              })
                            : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-400 text-sm">
                <Info className="h-8 w-8 mx-auto mb-3 opacity-30" />
                <p>{t("noPointData")}</p>
                <p className="text-xs mt-1">{t("checkServerD")}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

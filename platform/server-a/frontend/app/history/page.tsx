"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  getStreamSnapshot,
  getPointHistory,
  type PointData,
} from "@/lib/api";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Search, Clock, Download, Loader2, X } from "lucide-react";

/* ── 상수 ── */

const TIME_PRESETS = [
  { label: "time1h", value: "-1h" },
  { label: "time6h", value: "-6h" },
  { label: "time24h", value: "-24h" },
  { label: "time7d", value: "-7d" },
  { label: "time30d", value: "-30d" },
] as const;

const WINDOW_OPTIONS = [
  { label: "window1m", value: "1m" },
  { label: "window5m", value: "5m" },
  { label: "window15m", value: "15m" },
  { label: "window1h", value: "1h" },
  { label: "window1d", value: "1d" },
] as const;

const AGGREGATION_OPTIONS = [
  { label: "aggMean", value: "mean" },
  { label: "aggMin", value: "min" },
  { label: "aggMax", value: "max" },
  { label: "aggSum", value: "sum" },
] as const;

const LINE_COLORS = [
  "#3b82f6", "#ef4444", "#10b981", "#f59e0b",
  "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16",
];

/* ── 타입 ── */

interface PointInfo {
  point_id: string;
  value: number | null;
  unit: string;
}

interface ChartRow {
  time: string;
  ts: number;
  [key: string]: string | number;
}

/* ── 메인 페이지 ── */

export default function HistoryPage() {
  const t = useTranslations("history");
  const tc = useTranslations("common");

  // 포인트 목록
  const [pointList, setPointList] = useState<PointInfo[]>([]);
  const [pointsLoading, setPointsLoading] = useState(true);

  // 선택된 포인트 (다중)
  const [selectedPoints, setSelectedPoints] = useState<string[]>([]);

  // 검색 필터
  const [searchQuery, setSearchQuery] = useState("");

  // 쿼리 파라미터
  const [timeRange, setTimeRange] = useState("-1h");
  const [window, setWindow] = useState("1m");
  const [aggregation, setAggregation] = useState("mean");

  // 차트 데이터
  const [chartData, setChartData] = useState<ChartRow[]>([]);
  const [rawData, setRawData] = useState<Record<string, PointData[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 포인트 목록 로드
  useEffect(() => {
    (async () => {
      try {
        const snap = await getStreamSnapshot();
        const list: PointInfo[] = Object.values(snap.points).map((p) => ({
          point_id: p.point_id,
          value: p.value,
          unit: p.unit,
        }));
        list.sort((a, b) => a.point_id.localeCompare(b.point_id));
        setPointList(list);
      } catch {
        // snapshot 실패 시 빈 목록
      } finally {
        setPointsLoading(false);
      }
    })();
  }, []);

  // 필터링된 포인트 목록
  const filteredPoints = useMemo(() => {
    if (!searchQuery.trim()) return pointList;
    const q = searchQuery.toLowerCase();
    return pointList.filter((p) => p.point_id.toLowerCase().includes(q));
  }, [pointList, searchQuery]);

  // 포인트 선택 토글
  const togglePoint = useCallback((pointId: string) => {
    setSelectedPoints((prev) =>
      prev.includes(pointId)
        ? prev.filter((id) => id !== pointId)
        : prev.length < 8
        ? [...prev, pointId]
        : prev
    );
  }, []);

  // 데이터 조회
  const fetchHistory = useCallback(async () => {
    if (selectedPoints.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      const results = await Promise.all(
        selectedPoints.map((pid) =>
          getPointHistory(pid, timeRange, "now()", aggregation, window)
        )
      );

      // 원본 데이터 저장
      const raw: Record<string, PointData[]> = {};
      results.forEach((r, i) => {
        raw[selectedPoints[i]] = r.data || [];
      });
      setRawData(raw);

      // 타임스탬프 기준으로 병합
      const tsMap = new Map<number, ChartRow>();

      results.forEach((result, idx) => {
        const pid = selectedPoints[idx];
        for (const d of result.data || []) {
          const ts = typeof d.ts === "number" ? d.ts : 0;
          if (!tsMap.has(ts)) {
            tsMap.set(ts, {
              time: formatTime(ts, timeRange),
              ts,
            });
          }
          const row = tsMap.get(ts)!;
          row[pid] = typeof d.value === "number" ? d.value : 0;
        }
      });

      const merged = Array.from(tsMap.values()).sort((a, b) => a.ts - b.ts);
      setChartData(merged);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("queryFailed"));
    } finally {
      setLoading(false);
    }
  }, [selectedPoints, timeRange, window, aggregation]);

  // 포인트 선택 변경 시 자동 조회
  useEffect(() => {
    if (selectedPoints.length > 0) {
      fetchHistory();
    } else {
      setChartData([]);
      setRawData({});
    }
  }, [selectedPoints, timeRange, window, aggregation, fetchHistory]);

  // 포인트 ID에서 짧은 이름 추출
  const shortName = (pid: string) => pid.replace("bldg:", "");

  // 선택된 포인트의 단위 맵
  const unitMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const p of pointList) {
      m[p.point_id] = p.unit || "";
    }
    return m;
  }, [pointList]);

  // CSV 다운로드
  const downloadCSV = useCallback(() => {
    if (chartData.length === 0) return;
    const headers = [tc("time"), ...selectedPoints.map(shortName)];
    const rows = chartData.map((row) => [
      row.time,
      ...selectedPoints.map((pid) => String(row[pid] ?? "")),
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bees_history_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [chartData, selectedPoints]);

  return (
    <div className="min-h-screen">
      <Header title={t("title")} description={t("description")} />

      <div className="p-3 md:p-6 space-y-6">
        {/* ── 컨트롤 패널 ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          {/* 포인트 선택 */}
          <Card className="lg:col-span-1">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">{t("pointSelect")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* 검색 */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder={t("pointSearch")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* 선택된 포인트 태그 */}
              {selectedPoints.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedPoints.map((pid, i) => (
                    <Badge
                      key={pid}
                      variant="secondary"
                      className="cursor-pointer text-xs gap-1"
                      onClick={() => togglePoint(pid)}
                    >
                      <span
                        className="w-2 h-2 rounded-full inline-block"
                        style={{ backgroundColor: LINE_COLORS[i % LINE_COLORS.length] }}
                      />
                      {shortName(pid)}
                      <X className="h-3 w-3" />
                    </Badge>
                  ))}
                </div>
              )}

              {/* 포인트 리스트 */}
              <div className="max-h-[320px] overflow-y-auto border border-gray-100 rounded-lg">
                {pointsLoading ? (
                  <div className="flex items-center justify-center py-8 text-gray-400 text-sm">
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    {t("pointListLoading")}
                  </div>
                ) : filteredPoints.length === 0 ? (
                  <div className="py-8 text-center text-gray-400 text-sm">
                    {searchQuery ? t("noSearchResults") : t("noPoints")}
                  </div>
                ) : (
                  filteredPoints.map((p) => {
                    const selected = selectedPoints.includes(p.point_id);
                    const idx = selectedPoints.indexOf(p.point_id);
                    return (
                      <button
                        key={p.point_id}
                        onClick={() => togglePoint(p.point_id)}
                        className={`w-full text-left px-3 py-2 text-xs border-b border-gray-50 hover:bg-gray-50 transition-colors flex items-center justify-between ${
                          selected ? "bg-blue-50" : ""
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {selected && (
                            <span
                              className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{
                                backgroundColor: LINE_COLORS[idx % LINE_COLORS.length],
                              }}
                            />
                          )}
                          <span className="truncate font-mono">
                            {shortName(p.point_id)}
                          </span>
                        </div>
                        <span className="text-gray-400 flex-shrink-0 ml-2">
                          {p.unit}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
              <p className="text-xs text-gray-400">
                {tc("selected", { count: selectedPoints.length, total: pointList.length })}
              </p>
            </CardContent>
          </Card>

          {/* 쿼리 옵션 */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">{t("queryOptions")}</CardTitle>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={downloadCSV}
                  disabled={chartData.length === 0}
                >
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                  CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 기간 프리셋 */}
              <div>
                <label className="text-xs font-medium text-gray-500 mb-2 block">
                  {t("period")}
                </label>
                <div className="flex flex-wrap gap-2">
                  {TIME_PRESETS.map((preset) => (
                    <Button
                      key={preset.value}
                      size="sm"
                      variant={timeRange === preset.value ? "default" : "outline"}
                      onClick={() => setTimeRange(preset.value)}
                    >
                      <Clock className="h-3.5 w-3.5 mr-1" />
                      {t(preset.label)}
                    </Button>
                  ))}
                </div>
              </div>

              {/* 집계 윈도우 + 함수 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-2 block">
                    {t("aggregateWindow")}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {WINDOW_OPTIONS.map((opt) => (
                      <Button
                        key={opt.value}
                        size="sm"
                        variant={window === opt.value ? "default" : "outline"}
                        onClick={() => setWindow(opt.value)}
                      >
                        {t(opt.label)}
                      </Button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-2 block">
                    {t("aggregateFunction")}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {AGGREGATION_OPTIONS.map((opt) => (
                      <Button
                        key={opt.value}
                        size="sm"
                        variant={aggregation === opt.value ? "default" : "outline"}
                        onClick={() => setAggregation(opt.value)}
                      >
                        {t(opt.label)}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 에러 표시 */}
              {error && (
                <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── 차트 영역 ── */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{t("chartTitle")}</CardTitle>
              {loading && (
                <div className="flex items-center text-sm text-gray-400">
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  {t("querying")}
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {selectedPoints.length === 0 ? (
              <div className="flex items-center justify-center h-[350px] text-gray-400 text-sm">
                <div className="text-center">
                  <Clock className="h-8 w-8 mx-auto mb-3 opacity-30" />
                  <p>{t("selectPointHint")}</p>
                  <p className="text-xs mt-1">{t("maxCompare")}</p>
                </div>
              </div>
            ) : chartData.length === 0 && !loading ? (
              <div className="flex items-center justify-center h-[350px] text-gray-400 text-sm">
                <div className="text-center">
                  <Clock className="h-8 w-8 mx-auto mb-3 opacity-30" />
                  <p>{t("noDataInPeriod")}</p>
                </div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={chartData}>
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
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                    labelFormatter={(label) => t("tooltipTime", { time: label })}
                    formatter={(value: number, name: string) => [
                      `${value.toFixed(2)} ${unitMap[name] || ""}`,
                      shortName(name),
                    ]}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: "12px" }}
                    formatter={(value) => shortName(value)}
                  />
                  {selectedPoints.map((pid, i) => (
                    <Line
                      key={pid}
                      type="monotone"
                      dataKey={pid}
                      name={pid}
                      stroke={LINE_COLORS[i % LINE_COLORS.length]}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 3 }}
                      connectNulls
                      isAnimationActive={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* ── 데이터 테이블 ── */}
        {selectedPoints.length > 0 && chartData.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t("dataTable")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-3 text-gray-500 font-medium">
                        {tc("time")}
                      </th>
                      {selectedPoints.map((pid, i) => (
                        <th
                          key={pid}
                          className="text-right py-2 px-3 font-medium"
                        >
                          <div className="flex items-center justify-end gap-1.5">
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{
                                backgroundColor:
                                  LINE_COLORS[i % LINE_COLORS.length],
                              }}
                            />
                            <span className="text-gray-600 text-xs">
                              {shortName(pid)}
                            </span>
                            {unitMap[pid] && (
                              <span className="text-gray-400 text-xs">
                                ({unitMap[pid]})
                              </span>
                            )}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {chartData.slice(-100).map((row, idx) => (
                      <tr
                        key={idx}
                        className="border-b border-gray-50 hover:bg-gray-50"
                      >
                        <td className="py-1.5 px-3 text-xs text-gray-500 font-mono whitespace-nowrap">
                          {row.time}
                        </td>
                        {selectedPoints.map((pid) => (
                          <td
                            key={pid}
                            className="py-1.5 px-3 text-right text-xs font-mono"
                          >
                            {typeof row[pid] === "number"
                              ? (row[pid] as number).toFixed(2)
                              : "--"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {chartData.length > 100 && (
                <p className="text-xs text-gray-400 mt-2 text-center">
                  {t("recentRows", { total: chartData.length })}
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

/* ── 유틸 ── */

function formatTime(ts: number, range: string): string {
  const date = new Date(ts * 1000);
  // 7일 이상이면 날짜 포함
  if (range === "-7d" || range === "-30d") {
    return date.toLocaleDateString("ko-KR", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return date.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

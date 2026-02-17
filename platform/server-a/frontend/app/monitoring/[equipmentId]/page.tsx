"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LiveChart, MultiLineChart, type ChartDataPoint, type MultiLineData } from "@/components/charts/live-chart";
import { useSSE } from "@/lib/sse";
import {
  getEquipmentDetail,
  getEquipmentPerformance,
  getEquipmentAlarms,
  type EquipmentDetail,
  type PerformanceResponse,
  type AlarmHistoryResponse,
} from "@/lib/api";
import {
  ArrowLeft,
  Thermometer,
  Activity,
  AlertTriangle,
  MapPin,
  Link2,
  BarChart3,
  Gauge,
  Power,
  TrendingUp,
  TrendingDown,
} from "lucide-react";

/**
 * 장비 상세 모니터링 페이지
 * /monitoring/[equipmentId]
 *
 * 기능:
 * - 장비 기본 정보 (Brick 클래스, 위치, 운전 상태)
 * - 실시간 센서값 게이지 카드 (SSE 5초 갱신)
 * - 실시간 트렌드 차트 (다중 센서 오버레이)
 * - 성능 지표 (평균, 최소, 최대, 가동률)
 * - 알람 이력 (최근 30일)
 * - 연결 관계 (Neo4j)
 */

const PERIOD_OPTIONS = ["1d", "7d", "30d"] as const;

// 센서 유형별 게이지 색상 구간
function getGaugeColor(pointId: string, value: number): string {
  const pid = pointId.toLowerCase();
  if (pid.includes("temp")) {
    if (value < 18 || value > 30) return "text-red-600";
    if (value < 20 || value > 28) return "text-amber-500";
    return "text-green-600";
  }
  if (pid.includes("humid") || pid.includes("rh")) {
    if (value < 30 || value > 70) return "text-red-600";
    if (value < 40 || value > 60) return "text-amber-500";
    return "text-green-600";
  }
  if (pid.includes("co2")) {
    if (value > 1500) return "text-red-600";
    if (value > 1000) return "text-amber-500";
    return "text-green-600";
  }
  return "text-blue-600";
}

function getSeverityBadge(severity: string) {
  switch (severity) {
    case "critical":
      return <Badge variant="danger">critical</Badge>;
    case "major":
      return <Badge className="bg-orange-100 text-orange-800 border-orange-200">major</Badge>;
    case "minor":
      return <Badge className="bg-amber-100 text-amber-800 border-amber-200">minor</Badge>;
    default:
      return <Badge variant="secondary">{severity}</Badge>;
  }
}

// 차트 색상 팔레트
const CHART_COLORS = [
  "#ef4444", "#3b82f6", "#f59e0b", "#8b5cf6", "#10b981",
  "#ec4899", "#06b6d4", "#f97316", "#6366f1", "#14b8a6",
];

export default function EquipmentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const equipmentId = decodeURIComponent(params.equipmentId as string);

  const { points, pointHistory, devices, connected } = useSSE(60);

  const [detail, setDetail] = useState<EquipmentDetail | null>(null);
  const [performance, setPerformance] = useState<PerformanceResponse | null>(null);
  const [alarms, setAlarms] = useState<AlarmHistoryResponse | null>(null);
  const [period, setPeriod] = useState<string>("7d");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 장비 상세 정보 로드
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const [d, a] = await Promise.all([
          getEquipmentDetail(equipmentId),
          getEquipmentAlarms(equipmentId, 30),
        ]);
        if (!cancelled) {
          setDetail(d);
          setAlarms(a);
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "데이터 로딩 실패");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [equipmentId]);

  // 성능 지표 (기간 변경 시 재로드)
  useEffect(() => {
    let cancelled = false;
    async function loadPerf() {
      try {
        const p = await getEquipmentPerformance(equipmentId, period);
        if (!cancelled) setPerformance(p);
      } catch {
        // 성능 지표 로딩 실패 무시
      }
    }
    loadPerf();
    return () => { cancelled = true; };
  }, [equipmentId, period]);

  // 장비의 연결 포인트 ID 목록
  const sensorPointIds = useMemo(() => {
    if (!detail) return [];
    return detail.connections
      .filter((c) => {
        const labels = c.target_labels.join(",");
        return (
          labels.includes("Sensor") ||
          labels.includes("Setpoint") ||
          labels.includes("Status") ||
          labels.includes("Command") ||
          labels.includes("Point")
        );
      })
      .map((c) => c.target_id);
  }, [detail]);

  // MQTT에서 실시간 장비 상태
  const deviceState = devices[equipmentId];
  const isActive = deviceState?.is_active ?? detail?.is_active ?? null;

  // 다중 라인 차트 데이터 구성
  const multiChartData = useMemo(() => {
    if (sensorPointIds.length === 0) return { data: [], lines: [] };

    // 시간 축 정규화: 모든 포인트의 타임스탬프를 합치고 정렬
    const allTimes = new Set<number>();
    for (const pid of sensorPointIds) {
      const history = pointHistory[pid] || [];
      for (const pt of history) {
        allTimes.add(pt.ts);
      }
    }
    const sortedTimes = Array.from(allTimes).sort((a, b) => a - b);

    const data = sortedTimes.map((ts) => {
      const row: MultiLineData = {
        time: new Date(ts * 1000).toLocaleTimeString("ko-KR", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      };
      for (const pid of sensorPointIds) {
        const history = pointHistory[pid] || [];
        const pt = history.find((p) => p.ts === ts);
        if (pt && typeof pt.value === "number") {
          row[pid] = pt.value;
        }
      }
      return row;
    });

    const lines = sensorPointIds.map((pid, i) => {
      const shortName = pid.replace("bldg:", "").replace(/_/g, " ");
      return {
        key: pid,
        label: shortName,
        color: CHART_COLORS[i % CHART_COLORS.length],
      };
    });

    return { data, lines };
  }, [sensorPointIds, pointHistory]);

  if (loading) {
    return (
      <div className="min-h-screen">
        <Header title="장비 상세" description="로딩 중..." connected={connected} />
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="min-h-screen">
        <Header title="장비 상세" description="오류 발생" connected={connected} />
        <div className="p-6 text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-lg font-medium text-red-600">{error || "장비를 찾을 수 없습니다"}</p>
          <button
            onClick={() => router.push("/monitoring")}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            모니터링으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header
        title={`장비 상세 — ${detail.name}`}
        description={detail.brick_class.join(", ")}
        connected={connected}
      />

      <div className="p-3 md:p-6 space-y-6">
        {/* 뒤로 가기 + 장비 정보 헤더 */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <button
            onClick={() => router.push("/monitoring")}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"
          >
            <ArrowLeft className="h-4 w-4" />
            모니터링
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold">{detail.name}</h2>
              <Badge variant={isActive ? "success" : "secondary"}>
                {isActive ? "운전중" : isActive === false ? "정지" : "알 수 없음"}
              </Badge>
              {deviceState?.mode && (
                <Badge variant="outline">{deviceState.mode}</Badge>
              )}
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
              <span className="flex items-center gap-1">
                <Activity className="h-3.5 w-3.5" />
                {detail.brick_class.join(", ")}
              </span>
              {detail.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {detail.location}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 실시간 센서값 게이지 카드 */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {sensorPointIds.map((pid, i) => {
            const current = points[pid];
            const value = current && typeof current.value === "number" ? current.value : null;
            const shortName = pid.replace("bldg:", "").replace(/_/g, " ");
            const gaugeColor = value !== null ? getGaugeColor(pid, value) : "text-gray-400";

            return (
              <Card key={pid}>
                <CardContent className="pt-3 pb-2 px-3">
                  <div className="flex items-center justify-between mb-1">
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                    />
                    <Badge
                      variant={
                        current?.quality === "good"
                          ? "success"
                          : current?.quality === "uncertain"
                          ? "warning"
                          : current
                          ? "danger"
                          : "secondary"
                      }
                      className="text-[10px] px-1.5"
                    >
                      {current?.quality || "N/A"}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-gray-500 truncate" title={shortName}>
                    {shortName}
                  </p>
                  <p className={`text-xl font-bold mt-0.5 ${gaugeColor}`}>
                    {value !== null ? value.toFixed(1) : "--"}
                    <span className="text-xs font-normal text-gray-400 ml-1">
                      {current?.unit || ""}
                    </span>
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* 실시간 트렌드 차트 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              실시간 트렌드
              <span className="text-xs text-gray-400 font-normal">
                (SSE 5초 갱신, 최근 5분)
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {multiChartData.data.length > 0 ? (
              <MultiLineChart
                data={multiChartData.data}
                lines={multiChartData.lines}
                height={350}
              />
            ) : (
              <div className="flex items-center justify-center h-[350px] text-gray-400">
                <div className="text-center">
                  <Gauge className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">데이터 수신 대기 중...</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 성능 지표 + 연결 관계 (2-column) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 성능 지표 */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  성능 지표
                </CardTitle>
                <div className="flex gap-1">
                  {PERIOD_OPTIONS.map((p) => (
                    <button
                      key={p}
                      onClick={() => setPeriod(p)}
                      className={`px-2 py-0.5 text-xs rounded ${
                        period === p
                          ? "bg-blue-600 text-white"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {performance && performance.sensors.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-2 px-2 text-gray-500 font-medium text-xs">센서</th>
                        <th className="text-right py-2 px-2 text-gray-500 font-medium text-xs">평균</th>
                        <th className="text-right py-2 px-2 text-gray-500 font-medium text-xs">최소</th>
                        <th className="text-right py-2 px-2 text-gray-500 font-medium text-xs">최대</th>
                      </tr>
                    </thead>
                    <tbody>
                      {performance.sensors.map((s) => (
                        <tr key={s.id} className="border-b border-gray-50">
                          <td className="py-1.5 px-2 text-xs truncate max-w-[150px]" title={s.id}>
                            {s.id.replace(/_/g, " ")}
                          </td>
                          <td className="py-1.5 px-2 text-right font-semibold text-xs">{s.avg}</td>
                          <td className="py-1.5 px-2 text-right text-xs text-blue-600">
                            <TrendingDown className="h-3 w-3 inline mr-0.5" />
                            {s.min}
                          </td>
                          <td className="py-1.5 px-2 text-right text-xs text-red-500">
                            <TrendingUp className="h-3 w-3 inline mr-0.5" />
                            {s.max}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {performance.uptime_pct !== null && (
                    <div className="mt-3 flex items-center gap-2 text-sm">
                      <Power className="h-4 w-4 text-green-600" />
                      <span>가동률: <strong>{performance.uptime_pct}%</strong></span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-400 text-center py-6">성능 데이터 없음</p>
              )}
            </CardContent>
          </Card>

          {/* 연결 관계 */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Link2 className="h-4 w-4" />
                연결 관계
                <span className="text-xs text-gray-400 font-normal">
                  ({detail.connections.length}개)
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {detail.connections.length > 0 ? (
                <div className="max-h-[300px] overflow-y-auto space-y-1">
                  {detail.connections
                    .filter((c) => !sensorPointIds.includes(c.target_id))
                    .slice(0, 30)
                    .map((c, i) => (
                      <div
                        key={`${c.target_id}-${c.rel}-${i}`}
                        className="flex items-center gap-2 text-xs py-1 px-2 rounded hover:bg-gray-50"
                      >
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 shrink-0"
                        >
                          {c.direction === "outgoing" ? "→" : "←"} {c.rel}
                        </Badge>
                        <span className="truncate text-gray-700" title={c.target_id}>
                          {c.target_name}
                        </span>
                        <span className="text-gray-400 shrink-0">
                          {c.target_labels.filter((l) => l !== "Resource").join(", ")}
                        </span>
                      </div>
                    ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400 text-center py-6">연결 관계 없음</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 알람 이력 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              알람 이력
              <span className="text-xs text-gray-400 font-normal">
                (최근 30일, {alarms?.total || 0}건)
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {alarms && alarms.items.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-2 text-gray-500 font-medium text-xs">시각</th>
                      <th className="text-left py-2 px-2 text-gray-500 font-medium text-xs">심각도</th>
                      <th className="text-left py-2 px-2 text-gray-500 font-medium text-xs">유형</th>
                      <th className="text-left py-2 px-2 text-gray-500 font-medium text-xs">메시지</th>
                      <th className="text-left py-2 px-2 text-gray-500 font-medium text-xs">상태</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alarms.items.slice(0, 20).map((a) => (
                      <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-1.5 px-2 text-xs text-gray-500 whitespace-nowrap">
                          {new Date(a.onset_at).toLocaleString("ko-KR", {
                            month: "2-digit",
                            day: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="py-1.5 px-2">{getSeverityBadge(a.severity)}</td>
                        <td className="py-1.5 px-2 text-xs">{a.alarm_type}</td>
                        <td className="py-1.5 px-2 text-xs text-gray-600 max-w-[300px] truncate">
                          {a.message}
                        </td>
                        <td className="py-1.5 px-2">
                          {a.acknowledged_at ? (
                            <Badge variant="success" className="text-[10px]">확인</Badge>
                          ) : (
                            <Badge variant="warning" className="text-[10px]">미확인</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-6">알람 이력 없음</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

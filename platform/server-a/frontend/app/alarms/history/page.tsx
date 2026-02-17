"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  getAlarmHistory,
  acknowledgeAlarm,
  suppressAlarm,
  type AlarmItem,
} from "@/lib/api";
import {
  Search,
  Clock,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Check,
  ArrowLeft,
  Download,
  AlertOctagon,
  AlertTriangle,
  Info,
  BellOff,
  X,
} from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

const PAGE_SIZE = 50;

function getSeverityBadge(severity: string, t: (key: string) => string) {
  switch (severity) {
    case "critical":
      return <Badge variant="danger"><AlertOctagon className="h-3 w-3 mr-1" />{t("sevCritical")}</Badge>;
    case "warning":
      return <Badge variant="warning"><AlertTriangle className="h-3 w-3 mr-1" />{t("sevWarning")}</Badge>;
    case "minor":
      return <Badge variant="default"><Info className="h-3 w-3 mr-1" />{t("sevMinor")}</Badge>;
    default:
      return <Badge variant="secondary">{severity}</Badge>;
  }
}

export default function AlarmHistoryPage() {
  const t = useTranslations("alarms");
  const tc = useTranslations("common");
  const [alarms, setAlarms] = useState<AlarmItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [equipmentSearch, setEquipmentSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");
  const [acking, setAcking] = useState<number | null>(null);

  // 억제 인라인
  const [suppressId, setSuppressId] = useState<number | null>(null);
  const [suppressDuration, setSuppressDuration] = useState(1);
  const [suppressReason, setSuppressReason] = useState("");
  const [suppressing, setSuppressing] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: { equipment?: string; severity?: string; limit: number; offset: number } = {
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      };
      if (equipmentSearch.trim()) params.equipment = equipmentSearch.trim();
      if (severityFilter) params.severity = severityFilter;
      const data = await getAlarmHistory(params);
      setAlarms(data.items || []);
      setTotal(data.total || 0);
    } catch {
      setAlarms([]);
    } finally {
      setLoading(false);
    }
  }, [page, equipmentSearch, severityFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAck = async (id: number) => {
    setAcking(id);
    try {
      await acknowledgeAlarm(id);
      await fetchData();
    } catch {
      // ignore
    } finally {
      setAcking(null);
    }
  };

  const handleSuppress = async () => {
    if (suppressId === null) return;
    setSuppressing(true);
    try {
      await suppressAlarm(suppressId, suppressDuration, suppressReason);
      setSuppressId(null);
      setSuppressReason("");
    } catch {
      // ignore
    } finally {
      setSuppressing(false);
    }
  };

  const downloadCSV = () => {
    if (alarms.length === 0) return;
    const headers = ["ID", t("thSeverity"), t("thEquipment"), t("thType"), t("thMessage"), t("thValue"), t("thThreshold"), t("thOccurred"), t("thCleared"), t("thAcknowledged")];
    const rows = alarms.map((a) => [
      a.id,
      a.severity,
      a.equipment_id,
      a.alarm_type,
      `"${(a.message || "").replace(/"/g, '""')}"`,
      a.actual_value ?? "",
      a.threshold_value ?? "",
      a.onset_at || "",
      a.cleared_at || "",
      a.acknowledged_at || "",
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `alarm_history_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="min-h-screen">
      <Header title={t("historyPageTitle")} description={t("historyPageDesc")} />

      <div className="p-3 md:p-6 space-y-6">
        {/* 상단 바 */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <Link href="/alarms">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" />
              {t("backToAlarms")}
            </Button>
          </Link>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder={t("equipmentSearch")}
                value={equipmentSearch}
                onChange={(e) => {
                  setEquipmentSearch(e.target.value);
                  setPage(0);
                }}
                className="pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select
              value={severityFilter}
              onChange={(e) => {
                setSeverityFilter(e.target.value);
                setPage(0);
              }}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">{t("allSeverity")}</option>
              <option value="critical">{t("sevCritical")}</option>
              <option value="warning">{t("sevWarning")}</option>
              <option value="minor">{t("sevMinor")}</option>
            </select>
            <Button variant="outline" size="sm" onClick={downloadCSV} disabled={alarms.length === 0}>
              <Download className="h-3.5 w-3.5 mr-1" />
              CSV
            </Button>
          </div>
        </div>

        {/* 억제 인라인 패널 */}
        {suppressId !== null && (
          <Card>
            <CardContent className="py-4 px-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <BellOff className="h-4 w-4 text-purple-500" />
                  {t("suppressInlineTitle", { id: suppressId })}
                </h4>
                <button onClick={() => setSuppressId(null)}>
                  <X className="h-4 w-4 text-gray-400" />
                </button>
              </div>
              <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">{t("suppressDuration")}</label>
                  <div className="flex gap-1">
                    {[1, 4, 12, 24].map((h) => (
                      <Button
                        key={h}
                        size="sm"
                        variant={suppressDuration === h ? "default" : "outline"}
                        onClick={() => setSuppressDuration(h)}
                      >
                        {h}h
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="flex-1">
                  <label className="text-xs text-gray-500 block mb-1">{t("suppressReason")}</label>
                  <input
                    type="text"
                    value={suppressReason}
                    onChange={(e) => setSuppressReason(e.target.value)}
                    placeholder={t("suppressReasonPlaceholder")}
                    className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg"
                  />
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={suppressing}
                  onClick={handleSuppress}
                >
                  {suppressing ? <Loader2 className="h-3 w-3 animate-spin" /> : t("suppress")}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 테이블 */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
              </div>
            ) : alarms.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="text-left py-2.5 px-3 text-gray-500 font-medium">{t("thSeverity")}</th>
                      <th className="text-left py-2.5 px-3 text-gray-500 font-medium">{t("thEquipment")}</th>
                      <th className="text-left py-2.5 px-3 text-gray-500 font-medium">{t("thType")}</th>
                      <th className="text-right py-2.5 px-3 text-gray-500 font-medium">{t("thValueThreshold")}</th>
                      <th className="text-left py-2.5 px-3 text-gray-500 font-medium">{t("thOccurred")}</th>
                      <th className="text-left py-2.5 px-3 text-gray-500 font-medium">{t("thCleared")}</th>
                      <th className="text-left py-2.5 px-3 text-gray-500 font-medium">{t("thAcknowledged")}</th>
                      <th className="text-center py-2.5 px-3 text-gray-500 font-medium">{t("thAction")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alarms.map((alarm) => (
                      <tr key={alarm.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-2 px-3">{getSeverityBadge(alarm.severity, t)}</td>
                        <td className="py-2 px-3 font-medium text-xs">{alarm.equipment_id}</td>
                        <td className="py-2 px-3 text-xs text-gray-600">{alarm.alarm_type}</td>
                        <td className="py-2 px-3 text-right text-xs font-mono">
                          {alarm.actual_value?.toFixed(1) ?? "-"} / {alarm.threshold_value?.toFixed(1) ?? "-"}
                        </td>
                        <td className="py-2 px-3 text-xs text-gray-500 whitespace-nowrap">
                          {alarm.onset_at ? new Date(alarm.onset_at).toLocaleString("ko-KR", {
                            month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
                          }) : "-"}
                        </td>
                        <td className="py-2 px-3 text-xs text-gray-500 whitespace-nowrap">
                          {alarm.cleared_at ? new Date(alarm.cleared_at).toLocaleString("ko-KR", {
                            month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
                          }) : "-"}
                        </td>
                        <td className="py-2 px-3">
                          <Badge variant={alarm.acknowledged_at ? "success" : "secondary"}>
                            {alarm.acknowledged_at ? t("acknowledged") : t("unacknowledged")}
                          </Badge>
                        </td>
                        <td className="py-2 px-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {!alarm.acknowledged_at && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs"
                                disabled={acking === alarm.id}
                                onClick={() => handleAck(alarm.id)}
                              >
                                {acking === alarm.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Check className="h-3 w-3" />
                                )}
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-purple-600"
                              onClick={() => setSuppressId(alarm.id)}
                            >
                              <BellOff className="h-3 w-3" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-16 text-gray-400 text-sm">
                <Clock className="h-8 w-8 mx-auto mb-3 opacity-30" />
                <p>{t("noAlarmHistory")}</p>
              </div>
            )}

            {/* 페이지네이션 */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                <p className="text-xs text-gray-400">
                  {tc("totalOf", { total, start: page * PAGE_SIZE + 1, end: Math.min((page + 1) * PAGE_SIZE, total) })}
                </p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-gray-600">{tc("pageOf", { page: page + 1, totalPages })}</span>
                  <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

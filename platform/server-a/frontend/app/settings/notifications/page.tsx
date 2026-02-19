"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  getNotificationLog,
  getNotificationLogStats,
  type NotificationLogItem,
  type NotificationLogStats,
} from "@/lib/api";
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Mail,
  MessageSquare,
  CheckCircle,
  XCircle,
  AlertOctagon,
  AlertTriangle,
  Info,
} from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

const PAGE_SIZE = 50;

function getSeverityBadge(severity: string, labels: Record<string, string>) {
  switch (severity) {
    case "critical":
      return <Badge variant="danger"><AlertOctagon className="h-3 w-3 mr-1" />{labels.critical}</Badge>;
    case "warning":
      return <Badge variant="warning"><AlertTriangle className="h-3 w-3 mr-1" />{labels.warning}</Badge>;
    case "minor":
      return <Badge variant="default"><Info className="h-3 w-3 mr-1" />{labels.minor}</Badge>;
    default:
      return <Badge variant="secondary">{severity}</Badge>;
  }
}

function getChannelBadge(channel: string) {
  if (channel === "email") {
    return (
      <Badge variant="default" className="bg-cyan-500/10 text-cyan-300 border-cyan-500/20">
        <Mail className="h-3 w-3 mr-1" />Email
      </Badge>
    );
  }
  return (
    <Badge variant="default" className="bg-purple-500/10 text-purple-300 border-purple-500/20">
      <MessageSquare className="h-3 w-3 mr-1" />Slack
    </Badge>
  );
}

function getStatusBadge(status: string, labels: Record<string, string>) {
  if (status === "success") {
    return (
      <Badge variant="success">
        <CheckCircle className="h-3 w-3 mr-1" />{labels.success}
      </Badge>
    );
  }
  return (
    <Badge variant="danger">
      <XCircle className="h-3 w-3 mr-1" />{labels.failed}
    </Badge>
  );
}

export default function NotificationLogPage() {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const ta = useTranslations("alarms");

  const sevLabels: Record<string, string> = {
    critical: ta("sevCritical"),
    warning: ta("sevWarning"),
    minor: ta("sevMinor"),
  };
  const statusLabels: Record<string, string> = {
    success: tc("success"),
    failed: tc("failed"),
  };

  const [items, setItems] = useState<NotificationLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<NotificationLogStats | null>(null);
  const [channelFilter, setChannelFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: { channel?: string; status?: string; limit: number; offset: number } = {
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      };
      if (channelFilter) params.channel = channelFilter;
      if (statusFilter) params.status = statusFilter;
      const data = await getNotificationLog(params);
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [page, channelFilter, statusFilter]);

  const fetchStats = useCallback(async () => {
    try {
      const data = await getNotificationLogStats();
      setStats(data);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="min-h-screen">
      <Header title={t("notifTitle")} description={t("notifDesc")} />

      <div className="p-3 md:p-6 space-y-6">
        {/* 상단 네비게이션 */}
        <div className="flex items-center justify-between">
          <Link href="/settings">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" />
              {t("backToSettings")}
            </Button>
          </Link>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-emerald-400">{stats?.email?.success ?? 0}</div>
              <div className="text-xs text-slate-400 mt-1">{t("emailSuccess")}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-rose-400">{stats?.email?.failed ?? 0}</div>
              <div className="text-xs text-slate-400 mt-1">{t("emailFailed")}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-emerald-400">{stats?.slack?.success ?? 0}</div>
              <div className="text-xs text-slate-400 mt-1">{t("slackSuccess")}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-rose-400">{stats?.slack?.failed ?? 0}</div>
              <div className="text-xs text-slate-400 mt-1">{t("slackFailed")}</div>
            </CardContent>
          </Card>
        </div>

        {/* 필터 바 */}
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={channelFilter}
            onChange={(e) => {
              setChannelFilter(e.target.value);
              setPage(0);
            }}
            className="text-sm bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
          >
            <option value="">{t("allChannels")}</option>
            <option value="email">Email</option>
            <option value="slack">Slack</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(0);
            }}
            className="text-sm bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
          >
            <option value="">{t("allStatus")}</option>
            <option value="success">{tc("success")}</option>
            <option value="failed">{tc("failed")}</option>
          </select>
        </div>

        {/* 테이블 */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-cyan-400" />
              </div>
            ) : items.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/5">
                      <th className="text-left py-2.5 px-3 text-slate-400 font-medium">{t("thTime")}</th>
                      <th className="text-left py-2.5 px-3 text-slate-400 font-medium">{t("thChannel")}</th>
                      <th className="text-left py-2.5 px-3 text-slate-400 font-medium">{t("thEquipment")}</th>
                      <th className="text-left py-2.5 px-3 text-slate-400 font-medium">{t("thSeverity")}</th>
                      <th className="text-left py-2.5 px-3 text-slate-400 font-medium">{t("thRecipient")}</th>
                      <th className="text-left py-2.5 px-3 text-slate-400 font-medium">{t("thStatus")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id} className="border-b border-white/5 hover:bg-white/5">
                        <td className="py-2 px-3 text-xs text-slate-400 whitespace-nowrap">
                          {item.created_at
                            ? new Date(item.created_at).toLocaleString("ko-KR", {
                                month: "2-digit",
                                day: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "-"}
                        </td>
                        <td className="py-2 px-3">{getChannelBadge(item.channel)}</td>
                        <td className="py-2 px-3 font-medium text-xs">{item.alarm_equipment}</td>
                        <td className="py-2 px-3">{getSeverityBadge(item.alarm_severity, sevLabels)}</td>
                        <td className="py-2 px-3 text-xs text-slate-300">{item.recipient}</td>
                        <td className="py-2 px-3">{getStatusBadge(item.status, statusLabels)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-16 text-slate-500 text-sm">
                <Mail className="h-8 w-8 mx-auto mb-3 opacity-30" />
                <p>{t("noNotifHistory")}</p>
              </div>
            )}

            {/* 페이지네이션 */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-white/10">
                <p className="text-xs text-slate-500">
                  {tc("totalOf", { total, start: page * PAGE_SIZE + 1, end: Math.min((page + 1) * PAGE_SIZE, total) })}
                </p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-slate-300">{tc("pageOf", { page: page + 1, totalPages })}</span>
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

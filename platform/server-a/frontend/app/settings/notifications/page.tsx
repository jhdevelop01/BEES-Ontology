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

const PAGE_SIZE = 50;

function getSeverityBadge(severity: string) {
  switch (severity) {
    case "critical":
      return <Badge variant="danger"><AlertOctagon className="h-3 w-3 mr-1" />위험</Badge>;
    case "warning":
      return <Badge variant="warning"><AlertTriangle className="h-3 w-3 mr-1" />경고</Badge>;
    case "minor":
      return <Badge variant="default"><Info className="h-3 w-3 mr-1" />경미</Badge>;
    default:
      return <Badge variant="secondary">{severity}</Badge>;
  }
}

function getChannelBadge(channel: string) {
  if (channel === "email") {
    return (
      <Badge variant="default" className="bg-blue-100 text-blue-700 border-blue-200">
        <Mail className="h-3 w-3 mr-1" />Email
      </Badge>
    );
  }
  return (
    <Badge variant="default" className="bg-purple-100 text-purple-700 border-purple-200">
      <MessageSquare className="h-3 w-3 mr-1" />Slack
    </Badge>
  );
}

function getStatusBadge(status: string) {
  if (status === "success") {
    return (
      <Badge variant="success">
        <CheckCircle className="h-3 w-3 mr-1" />성공
      </Badge>
    );
  }
  return (
    <Badge variant="danger">
      <XCircle className="h-3 w-3 mr-1" />실패
    </Badge>
  );
}

export default function NotificationLogPage() {
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
      <Header title="알림 이력" description="Email/Slack 알림 전송 이력" />

      <div className="p-3 md:p-6 space-y-6">
        {/* 상단 네비게이션 */}
        <div className="flex items-center justify-between">
          <Link href="/settings">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" />
              설정
            </Button>
          </Link>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600">{stats?.email?.success ?? 0}</div>
              <div className="text-xs text-gray-500 mt-1">Email 성공</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-red-600">{stats?.email?.failed ?? 0}</div>
              <div className="text-xs text-gray-500 mt-1">Email 실패</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600">{stats?.slack?.success ?? 0}</div>
              <div className="text-xs text-gray-500 mt-1">Slack 성공</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-red-600">{stats?.slack?.failed ?? 0}</div>
              <div className="text-xs text-gray-500 mt-1">Slack 실패</div>
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
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">전체 채널</option>
            <option value="email">Email</option>
            <option value="slack">Slack</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(0);
            }}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">전체 상태</option>
            <option value="success">성공</option>
            <option value="failed">실패</option>
          </select>
        </div>

        {/* 테이블 */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
              </div>
            ) : items.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="text-left py-2.5 px-3 text-gray-500 font-medium">시간</th>
                      <th className="text-left py-2.5 px-3 text-gray-500 font-medium">채널</th>
                      <th className="text-left py-2.5 px-3 text-gray-500 font-medium">장비</th>
                      <th className="text-left py-2.5 px-3 text-gray-500 font-medium">심각도</th>
                      <th className="text-left py-2.5 px-3 text-gray-500 font-medium">수신자</th>
                      <th className="text-left py-2.5 px-3 text-gray-500 font-medium">상태</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-2 px-3 text-xs text-gray-500 whitespace-nowrap">
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
                        <td className="py-2 px-3">{getSeverityBadge(item.alarm_severity)}</td>
                        <td className="py-2 px-3 text-xs text-gray-600">{item.recipient}</td>
                        <td className="py-2 px-3">{getStatusBadge(item.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-16 text-gray-400 text-sm">
                <Mail className="h-8 w-8 mx-auto mb-3 opacity-30" />
                <p>알림 이력이 없습니다</p>
              </div>
            )}

            {/* 페이지네이션 */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                <p className="text-xs text-gray-400">
                  총 {total}건 중 {page * PAGE_SIZE + 1}~{Math.min((page + 1) * PAGE_SIZE, total)}
                </p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-gray-600">{page + 1} / {totalPages}</span>
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

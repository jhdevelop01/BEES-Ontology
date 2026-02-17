"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSSE } from "@/lib/sse";
import {
  getActiveAlarms,
  getAlarmHistory,
  getAlarmStats,
  acknowledgeAlarm,
  suppressAlarm,
  getSuppressedAlarms,
  unsuppressAlarm,
  type ActiveAlarm,
  type AlarmItem,
  type SuppressedAlarm,
} from "@/lib/api";
import {
  Bell,
  AlertTriangle,
  AlertOctagon,
  Info,
  Search,
  Check,
  Clock,
  Loader2,
  ChevronLeft,
  ChevronRight,
  X,
  History,
  BellOff,
  Shield,
} from "lucide-react";
import Link from "next/link";

/* ── 심각도 설정 ── */

const SEVERITY_CONFIG: Record<string, {
  label: string;
  color: string;
  bgColor: string;
  icon: React.ComponentType<{ className?: string }>;
  variant: "danger" | "warning" | "default" | "secondary";
}> = {
  critical: {
    label: "위험",
    color: "text-red-600",
    bgColor: "bg-red-50 border-red-200",
    icon: AlertOctagon,
    variant: "danger",
  },
  major: {
    label: "주의",
    color: "text-orange-600",
    bgColor: "bg-orange-50 border-orange-200",
    icon: AlertTriangle,
    variant: "warning",
  },
  warning: {
    label: "경고",
    color: "text-yellow-600",
    bgColor: "bg-yellow-50 border-yellow-200",
    icon: AlertTriangle,
    variant: "warning",
  },
  minor: {
    label: "경미",
    color: "text-blue-600",
    bgColor: "bg-blue-50 border-blue-200",
    icon: Info,
    variant: "default",
  },
  info: {
    label: "정보",
    color: "text-gray-600",
    bgColor: "bg-gray-50 border-gray-200",
    icon: Info,
    variant: "secondary",
  },
};

function getSeverityConfig(severity: string) {
  return SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.info;
}

/* ── 억제 모달 ── */

function SuppressModal({
  alarmId,
  equipment,
  onClose,
  onConfirm,
}: {
  alarmId: number;
  equipment: string;
  onClose: () => void;
  onConfirm: (duration: number, reason: string) => void;
}) {
  const [duration, setDuration] = useState(1);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold flex items-center gap-2">
            <BellOff className="h-5 w-5 text-gray-500" />
            알람 억제
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="text-sm text-gray-500 mb-4">
          <span className="font-medium text-gray-700">{equipment}</span> 장비의 알람을 지정 기간 동안 숨깁니다.
        </p>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-2">억제 기간</label>
            <div className="flex gap-2">
              {[
                { label: "1시간", value: 1 },
                { label: "4시간", value: 4 },
                { label: "12시간", value: 12 },
                { label: "24시간", value: 24 },
              ].map((opt) => (
                <Button
                  key={opt.value}
                  size="sm"
                  variant={duration === opt.value ? "default" : "outline"}
                  onClick={() => setDuration(opt.value)}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 block mb-2">사유</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="억제 사유 입력 (선택)"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" size="sm" onClick={onClose}>
            취소
          </Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={submitting}
            onClick={async () => {
              setSubmitting(true);
              onConfirm(duration, reason);
            }}
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <BellOff className="h-4 w-4 mr-1" />
            )}
            억제
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ── 확인 모달 ── */

function AckModal({
  alarmId,
  equipment,
  onClose,
  onConfirm,
}: {
  alarmId: number;
  equipment: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
        <h3 className="text-base font-semibold mb-3">알람 확인</h3>
        <p className="text-sm text-gray-500 mb-4">
          <span className="font-medium text-gray-700">{equipment}</span> 알람 #{alarmId}을 확인 처리합니다.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>취소</Button>
          <Button
            size="sm"
            disabled={submitting}
            onClick={async () => {
              setSubmitting(true);
              onConfirm();
            }}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
            확인
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ── 메인 ── */

export default function AlarmsPage() {
  const { alarms: sseAlarms, connected } = useSSE();

  const [activeAlarms, setActiveAlarms] = useState<ActiveAlarm[]>([]);
  const [historyAlarms, setHistoryAlarms] = useState<AlarmItem[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);

  // 억제 목록
  const [suppressed, setSuppressed] = useState<SuppressedAlarm[]>([]);
  const [showSuppressed, setShowSuppressed] = useState(false);

  // 필터
  const [severityFilter, setSeverityFilter] = useState<string>("");
  const [equipmentSearch, setEquipmentSearch] = useState("");
  const [showUnackOnly, setShowUnackOnly] = useState(false);

  // 페이지
  const [page, setPage] = useState(0);
  const pageSize = 20;

  // 선택된 알람
  const [selectedAlarm, setSelectedAlarm] = useState<AlarmItem | null>(null);

  // 모달
  const [ackTarget, setAckTarget] = useState<AlarmItem | null>(null);
  const [suppressTarget, setSuppressTarget] = useState<AlarmItem | null>(null);

  // 활성 알람 로딩
  const fetchActive = useCallback(async () => {
    try {
      const params: { severity?: string; equipment?: string } = {};
      if (severityFilter) params.severity = severityFilter;
      if (equipmentSearch.trim()) params.equipment = equipmentSearch.trim();
      const data = await getActiveAlarms(params);
      setActiveAlarms(data.alarms || []);
    } catch {
      // 실패 시 빈 배열
    }
  }, [severityFilter, equipmentSearch]);

  // 이력 알람 로딩
  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const params: { severity?: string; equipment?: string; limit: number; offset: number } = {
        limit: pageSize,
        offset: page * pageSize,
      };
      if (severityFilter) params.severity = severityFilter;
      if (equipmentSearch.trim()) params.equipment = equipmentSearch.trim();
      const data = await getAlarmHistory(params);
      setHistoryAlarms(data.items || []);
      setHistoryTotal(data.total || 0);
    } catch {
      setHistoryAlarms([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [severityFilter, equipmentSearch, page]);

  // 억제 목록 로딩
  const fetchSuppressed = useCallback(async () => {
    try {
      const data = await getSuppressedAlarms();
      setSuppressed(data.items || []);
    } catch {
      // ignore
    }
  }, []);

  // 초기 로딩
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchActive(), fetchHistory(), fetchSuppressed()]);
      setLoading(false);
    };
    load();
  }, [fetchActive, fetchHistory, fetchSuppressed]);

  // SSE 새 알람 수신 시 자동 갱신
  useEffect(() => {
    if (sseAlarms.length > 0) {
      fetchActive();
    }
  }, [sseAlarms.length, fetchActive]);

  // 심각도별 카운트
  const severityCounts = useMemo(() => {
    const counts: Record<string, number> = {
      critical: 0,
      warning: 0,
      minor: 0,
      info: 0,
    };
    for (const a of activeAlarms) {
      const sev = a.severity || "info";
      counts[sev] = (counts[sev] || 0) + 1;
    }
    return counts;
  }, [activeAlarms]);

  // 알람 확인 처리
  const handleAcknowledge = async (alarmId: number) => {
    try {
      await acknowledgeAlarm(alarmId);
      await fetchHistory();
    } catch {
      // 실패 무시
    }
    setAckTarget(null);
  };

  // 알람 억제 처리
  const handleSuppress = async (alarmId: number, duration: number, reason: string) => {
    try {
      await suppressAlarm(alarmId, duration, reason);
      await Promise.all([fetchActive(), fetchSuppressed()]);
    } catch {
      // ignore
    }
    setSuppressTarget(null);
  };

  // 알람 억제 해제
  const handleUnsuppress = async (alarmId: number) => {
    try {
      await unsuppressAlarm(alarmId);
      await Promise.all([fetchActive(), fetchSuppressed()]);
    } catch {
      // ignore
    }
  };

  // 필터된 이력
  const filteredHistory = useMemo(() => {
    if (!showUnackOnly) return historyAlarms;
    return historyAlarms.filter((a) => !a.acknowledged_at);
  }, [historyAlarms, showUnackOnly]);

  const totalPages = Math.ceil(historyTotal / pageSize);

  return (
    <div className="min-h-screen">
      <Header
        title="알람 관리"
        description="실시간 알람 모니터링 및 이력 관리"
        connected={connected}
      />

      <div className="p-3 md:p-6 space-y-6">
        {/* 심각도 요약 카드 */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {(["critical", "warning", "minor", "info"] as const).map((sev) => {
            const config = getSeverityConfig(sev);
            const Icon = config.icon;
            const count = severityCounts[sev] || 0;
            return (
              <Card
                key={sev}
                className={`cursor-pointer transition-shadow hover:shadow-md ${
                  severityFilter === sev ? "ring-2 ring-blue-400" : ""
                }`}
                onClick={() => {
                  setSeverityFilter(severityFilter === sev ? "" : sev);
                  setPage(0);
                }}
              >
                <CardContent className="pt-4 pb-3 px-4">
                  <div className="flex items-center justify-between">
                    <Icon className={`h-5 w-5 ${config.color}`} />
                    <span className={`text-2xl font-bold ${config.color}`}>{count}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{config.label}</p>
                </CardContent>
              </Card>
            );
          })}

          {/* 억제 카운트 카드 */}
          <Card
            className={`cursor-pointer transition-shadow hover:shadow-md ${
              showSuppressed ? "ring-2 ring-purple-400" : ""
            }`}
            onClick={() => setShowSuppressed(!showSuppressed)}
          >
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center justify-between">
                <BellOff className="h-5 w-5 text-purple-500" />
                <span className="text-2xl font-bold text-purple-600">{suppressed.length}</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">억제 중</p>
            </CardContent>
          </Card>
        </div>

        {/* 억제 목록 패널 */}
        {showSuppressed && suppressed.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <BellOff className="h-4 w-4 text-purple-500" />
                억제 중인 알람 ({suppressed.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {suppressed.map((s) => (
                  <div
                    key={s.alarm_id}
                    className="flex items-center justify-between px-4 py-3 rounded-lg border bg-purple-50 border-purple-200"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{s.equipment || "알 수 없는 장비"}</span>
                        <Badge variant="secondary">{s.severity}</Badge>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        사유: {s.reason || "-"} | 남은 시간: {Math.round(s.remaining_seconds / 60)}분
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => handleUnsuppress(s.alarm_id)}
                    >
                      <Shield className="h-3 w-3 mr-1" />
                      해제
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 필터 바 */}
        <Card>
          <CardContent className="py-3 px-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="relative flex-1 w-full sm:w-auto">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="장비 검색..."
                  value={equipmentSearch}
                  onChange={(e) => {
                    setEquipmentSearch(e.target.value);
                    setPage(0);
                  }}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={severityFilter}
                  onChange={(e) => {
                    setSeverityFilter(e.target.value);
                    setPage(0);
                  }}
                  className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">전체 심각도</option>
                  <option value="critical">위험</option>
                  <option value="warning">경고</option>
                  <option value="minor">경미</option>
                  <option value="info">정보</option>
                </select>
                <Button
                  variant={showUnackOnly ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowUnackOnly(!showUnackOnly)}
                >
                  <Check className="h-3.5 w-3.5 mr-1" />
                  미확인만
                </Button>
                <Link href="/alarms/history">
                  <Button variant="outline" size="sm">
                    <History className="h-3.5 w-3.5 mr-1" />
                    전체 이력
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 활성 알람 (실시간) */}
        {activeAlarms.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Bell className="h-4 w-4 text-red-500" />
                활성 알람 ({activeAlarms.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {activeAlarms.map((alarm, idx) => {
                  const config = getSeverityConfig(alarm.severity);
                  const Icon = config.icon;
                  return (
                    <div
                      key={idx}
                      className={`flex items-start gap-3 px-4 py-3 rounded-lg border ${config.bgColor}`}
                    >
                      <Icon className={`h-5 w-5 flex-shrink-0 mt-0.5 ${config.color}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm">
                            {alarm.equipment || "알 수 없는 장비"}
                          </span>
                          <Badge variant={config.variant}>{config.label}</Badge>
                        </div>
                        <p className="text-xs text-gray-600 mt-0.5">
                          {alarm.type || "알람"} — 값: {alarm.value?.toFixed(1) ?? "-"} (임계: {alarm.threshold?.toFixed(1) ?? "-"})
                        </p>
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          {new Date(alarm.ts * 1000).toLocaleString("ko-KR")}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 알람 이력 테이블 */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="h-4 w-4" />
                알람 이력
              </CardTitle>
              {historyLoading && (
                <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
              )}
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
              </div>
            ) : filteredHistory.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-2 px-3 text-gray-500 font-medium">심각도</th>
                        <th className="text-left py-2 px-3 text-gray-500 font-medium">장비</th>
                        <th className="text-left py-2 px-3 text-gray-500 font-medium">유형</th>
                        <th className="text-right py-2 px-3 text-gray-500 font-medium">값</th>
                        <th className="text-right py-2 px-3 text-gray-500 font-medium">임계값</th>
                        <th className="text-left py-2 px-3 text-gray-500 font-medium">발생</th>
                        <th className="text-left py-2 px-3 text-gray-500 font-medium">상태</th>
                        <th className="text-center py-2 px-3 text-gray-500 font-medium">조치</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredHistory.map((alarm) => {
                        const config = getSeverityConfig(alarm.severity);
                        const Icon = config.icon;
                        return (
                          <tr
                            key={alarm.id}
                            className={`border-b border-gray-50 hover:bg-gray-50 cursor-pointer ${
                              selectedAlarm?.id === alarm.id ? "bg-blue-50" : ""
                            }`}
                            onClick={() =>
                              setSelectedAlarm(
                                selectedAlarm?.id === alarm.id ? null : alarm
                              )
                            }
                          >
                            <td className="py-2 px-3">
                              <Badge variant={config.variant}>
                                <Icon className="h-3 w-3 mr-1" />
                                {config.label}
                              </Badge>
                            </td>
                            <td className="py-2 px-3 font-medium text-xs">
                              {alarm.equipment_id || "-"}
                            </td>
                            <td className="py-2 px-3 text-xs text-gray-600">
                              {alarm.alarm_type}
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-xs">
                              {alarm.actual_value?.toFixed(1) ?? "-"}
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-xs">
                              {alarm.threshold_value?.toFixed(1) ?? "-"}
                            </td>
                            <td className="py-2 px-3 text-xs text-gray-500 whitespace-nowrap">
                              {alarm.onset_at
                                ? new Date(alarm.onset_at).toLocaleString("ko-KR", {
                                    month: "2-digit",
                                    day: "2-digit",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })
                                : "-"}
                            </td>
                            <td className="py-2 px-3">
                              <Badge
                                variant={alarm.acknowledged_at ? "success" : "secondary"}
                              >
                                {alarm.acknowledged_at ? "확인됨" : "미확인"}
                              </Badge>
                            </td>
                            <td className="py-2 px-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                {!alarm.acknowledged_at && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-xs"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setAckTarget(alarm);
                                    }}
                                  >
                                    <Check className="h-3 w-3" />
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs text-purple-600"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSuppressTarget(alarm);
                                  }}
                                >
                                  <BellOff className="h-3 w-3" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* 선택된 알람 상세 패널 */}
                {selectedAlarm && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-semibold">알람 상세 #{selectedAlarm.id}</h4>
                      <button onClick={() => setSelectedAlarm(null)}>
                        <X className="h-4 w-4 text-gray-400" />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                      <div>
                        <span className="text-gray-500">장비:</span>
                        <span className="ml-2 font-medium">{selectedAlarm.equipment_id}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">유형:</span>
                        <span className="ml-2">{selectedAlarm.alarm_type}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">심각도:</span>
                        <span className="ml-2">
                          <Badge variant={getSeverityConfig(selectedAlarm.severity).variant}>
                            {getSeverityConfig(selectedAlarm.severity).label}
                          </Badge>
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">현재값:</span>
                        <span className="ml-2 font-mono">{selectedAlarm.actual_value?.toFixed(2) ?? "-"}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">임계값:</span>
                        <span className="ml-2 font-mono">{selectedAlarm.threshold_value?.toFixed(2) ?? "-"}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">메시지:</span>
                        <span className="ml-2">{selectedAlarm.message || "-"}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">발생:</span>
                        <span className="ml-2">
                          {selectedAlarm.onset_at
                            ? new Date(selectedAlarm.onset_at).toLocaleString("ko-KR")
                            : "-"}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">해소:</span>
                        <span className="ml-2">
                          {selectedAlarm.cleared_at
                            ? new Date(selectedAlarm.cleared_at).toLocaleString("ko-KR")
                            : "미해소"}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">확인:</span>
                        <span className="ml-2">
                          {selectedAlarm.acknowledged_at
                            ? new Date(selectedAlarm.acknowledged_at).toLocaleString("ko-KR")
                            : "미확인"}
                        </span>
                      </div>
                    </div>

                    {/* 액션 버튼 */}
                    <div className="flex gap-2 mt-4 pt-3 border-t border-gray-200">
                      {!selectedAlarm.acknowledged_at && (
                        <Button size="sm" onClick={() => setAckTarget(selectedAlarm)}>
                          <Check className="h-4 w-4 mr-1" />
                          확인 처리
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSuppressTarget(selectedAlarm)}
                      >
                        <BellOff className="h-4 w-4 mr-1" />
                        억제
                      </Button>
                      <Link href={`/monitoring/${encodeURIComponent(selectedAlarm.equipment_id)}`}>
                        <Button variant="outline" size="sm">
                          장비 상세 보기
                        </Button>
                      </Link>
                    </div>
                  </div>
                )}

                {/* 페이지네이션 */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
                    <p className="text-xs text-gray-400">
                      총 {historyTotal}건 중 {page * pageSize + 1}~
                      {Math.min((page + 1) * pageSize, historyTotal)}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={page === 0}
                        onClick={() => setPage((p) => p - 1)}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm text-gray-600">
                        {page + 1} / {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={page >= totalPages - 1}
                        onClick={() => setPage((p) => p + 1)}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12 text-gray-400 text-sm">
                <Bell className="h-8 w-8 mx-auto mb-3 opacity-30" />
                <p>알람 이력이 없습니다</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 확인 모달 */}
      {ackTarget && (
        <AckModal
          alarmId={ackTarget.id}
          equipment={ackTarget.equipment_id}
          onClose={() => setAckTarget(null)}
          onConfirm={() => handleAcknowledge(ackTarget.id)}
        />
      )}

      {/* 억제 모달 */}
      {suppressTarget && (
        <SuppressModal
          alarmId={suppressTarget.id}
          equipment={suppressTarget.equipment_id}
          onClose={() => setSuppressTarget(null)}
          onConfirm={(duration, reason) =>
            handleSuppress(suppressTarget.id, duration, reason)
          }
        />
      )}
    </div>
  );
}

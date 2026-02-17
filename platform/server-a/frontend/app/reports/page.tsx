"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import {
  getReportPresets,
  generateReport,
  getReportHistory,
  getReportDownloadUrl,
  type ReportPreset,
  type ReportHistoryItem,
} from "@/lib/api";
import {
  FileText,
  FileSpreadsheet,
  Zap,
  Wrench,
  Thermometer,
  Bell,
  Download,
  Loader2,
  X,
  Calendar,
} from "lucide-react";
import { useTranslations } from "next-intl";

/* ── 상수 ── */

const PRESET_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  energy_monthly: Zap,
  maintenance_status: Wrench,
  comfort: Thermometer,
  alarm_summary: Bell,
};

const FORMAT_OPTIONS = [
  { label: "JSON", value: "json" },
  { label: "CSV", value: "csv" },
  { label: "Excel", value: "xlsx" },
  { label: "PDF", value: "pdf" },
] as const;

/* ── 메인 페이지 ── */

export default function ReportsPage() {
  const t = useTranslations("reports");
  const tc = useTranslations("common");
  const { addToast } = useToast();

  // 프리셋 목록
  const [presets, setPresets] = useState<ReportPreset[]>([]);
  const [presetsLoading, setPresetsLoading] = useState(true);

  // 보고서 생성 모달
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<ReportPreset | null>(null);

  // 보고서 이력
  const [history, setHistory] = useState<ReportHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  // 프리셋 로드
  useEffect(() => {
    setPresetsLoading(true);
    getReportPresets()
      .then(setPresets)
      .catch(() => {
        // 프리셋 API 미연결 시 기본값
        setPresets([
          { id: "energy_monthly", name: t("presetEnergy"), description: t("presetEnergyDesc"), icon: "Zap" },
          { id: "maintenance_status", name: t("presetMaintenance"), description: t("presetMaintenanceDesc"), icon: "Wrench" },
          { id: "comfort", name: t("presetComfort"), description: t("presetComfortDesc"), icon: "Thermometer" },
          { id: "alarm_summary", name: t("presetAlarm"), description: t("presetAlarmDesc"), icon: "Bell" },
        ]);
      })
      .finally(() => setPresetsLoading(false));
  }, []);

  // 이력 로드
  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await getReportHistory({ limit: 20 });
      setHistory(res.items);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // 프리셋 카드 클릭 → 생성 모달
  const handlePresetClick = (preset: ReportPreset) => {
    setSelectedPreset(preset);
    setShowGenerateModal(true);
  };

  return (
    <div className="min-h-screen">
      <Header title={t("title")} description={t("description")} />

      <div className="p-3 md:p-6 space-y-6">
        {/* 프리셋 보고서 카드 */}
        <div>
          <h3 className="text-sm font-medium text-gray-500 mb-3">{t("presets")}</h3>
          {presetsLoading ? (
            <div className="flex items-center justify-center py-8 text-gray-400 text-sm">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              {tc("loading")}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {presets.map((preset) => {
                const Icon = PRESET_ICONS[preset.id] || FileText;
                return (
                  <Card key={preset.id} className="hover:shadow-md transition-shadow cursor-pointer">
                    <CardContent className="pt-5 pb-4 px-4">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-blue-50 rounded-lg">
                          <Icon className="h-5 w-5 text-blue-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-semibold text-gray-900">{preset.name}</h4>
                          <p className="text-xs text-gray-500 mt-1">{preset.description}</p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        className="w-full mt-3"
                        onClick={() => handlePresetClick(preset)}
                      >
                        {t("generate")}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* 보고서 이력 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              {t("reportHistory")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {historyLoading ? (
              <div className="flex items-center justify-center py-12 text-gray-400 text-sm">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                {tc("loading")}
              </div>
            ) : history.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p>{t("noReports")}</p>
                <p className="text-xs mt-1">{t("noReportsHint")}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-3 text-gray-500 font-medium">{t("thCreatedAt")}</th>
                      <th className="text-left py-2 px-3 text-gray-500 font-medium">{t("thType")}</th>
                      <th className="text-left py-2 px-3 text-gray-500 font-medium">{t("thPeriod")}</th>
                      <th className="text-left py-2 px-3 text-gray-500 font-medium">{t("thFormat")}</th>
                      <th className="text-left py-2 px-3 text-gray-500 font-medium">{t("thStatus")}</th>
                      <th className="text-right py-2 px-3 text-gray-500 font-medium">{t("thDownload")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((item) => (
                      <tr key={item.report_id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-2 px-3 text-xs text-gray-500">
                          {new Date(item.generated_at).toLocaleString("ko-KR")}
                        </td>
                        <td className="py-2 px-3 font-medium">{item.preset_id || t("custom")}</td>
                        <td className="py-2 px-3 text-xs text-gray-500">
                          {item.period_start} ~ {item.period_end}
                        </td>
                        <td className="py-2 px-3">
                          <Badge variant="secondary">{item.format.toUpperCase()}</Badge>
                        </td>
                        <td className="py-2 px-3">
                          <Badge variant={item.status === "completed" ? "success" : "warning"}>
                            {item.status === "completed" ? t("statusCompleted") : t("statusGenerating")}
                          </Badge>
                        </td>
                        <td className="py-2 px-3 text-right">
                          {item.status === "completed" && (
                            <a
                              href={getReportDownloadUrl(item.report_id)}
                              className="inline-flex items-center text-blue-600 hover:text-blue-800 text-xs"
                            >
                              <Download className="h-3.5 w-3.5 mr-1" />
                              {tc("download")}
                            </a>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 생성 모달 */}
      {showGenerateModal && selectedPreset && (
        <GenerateReportModal
          preset={selectedPreset}
          onClose={() => setShowGenerateModal(false)}
          onGenerated={() => {
            setShowGenerateModal(false);
            fetchHistory();
            addToast({ title: t("generateSuccess"), variant: "success" });
          }}
        />
      )}
    </div>
  );
}

/* ── 보고서 생성 모달 ── */

function GenerateReportModal({
  preset,
  onClose,
  onGenerated,
}: {
  preset: ReportPreset;
  onClose: () => void;
  onGenerated: () => void;
}) {
  const t = useTranslations("reports");
  const tc = useTranslations("common");
  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

  const [startDate, setStartDate] = useState(weekAgo);
  const [endDate, setEndDate] = useState(today);
  const [format, setFormat] = useState("json");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      await generateReport({
        preset_id: preset.id,
        period: { start: startDate, end: endDate },
        format,
      });
      onGenerated();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("generateFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold">{preset.name}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <p className="text-sm text-gray-500">{preset.description}</p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Calendar className="inline h-3.5 w-3.5 mr-1" />
                {t("startDate")}
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Calendar className="inline h-3.5 w-3.5 mr-1" />
                {t("endDate")}
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t("outputFormat")}</label>
            <div className="flex gap-3">
              {FORMAT_OPTIONS.map((opt) => (
                <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="format"
                    value={opt.value}
                    checked={format === opt.value}
                    onChange={(e) => setFormat(e.target.value)}
                    className="text-blue-600"
                  />
                  <span className="text-sm">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              {tc("cancel")}
            </Button>
            <Button type="submit" size="sm" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <FileText className="h-4 w-4 mr-1" />}
              {t("generate")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

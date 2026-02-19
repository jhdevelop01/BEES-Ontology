"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Activity,
  Zap,
  AlertTriangle,
  Radio,
  TrendingUp,
  TrendingDown,
} from "lucide-react";

interface WidgetKPIProps {
  activeDevices: number;
  totalDevices: number;
  energyKw: number | null;
  energyChangePct: number | null;
  alarmCritical: number;
  alarmWarning: number;
  alarmInfo: number;
  simStatus: string;
}

export function WidgetKPI({
  activeDevices,
  totalDevices,
  energyKw,
  energyChangePct,
  alarmCritical,
  alarmWarning,
  alarmInfo,
  simStatus,
}: WidgetKPIProps) {
  const t = useTranslations("dashboard");
  const pct = totalDevices > 0 ? Math.round((activeDevices / totalDevices) * 100) : 0;
  const totalAlarms = alarmCritical + alarmWarning + alarmInfo;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 h-full">
      {/* 카드 1: 장비 가동률 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-gray-500">
            {t("equipmentHealth")}
          </CardTitle>
          <Activity className="h-4 w-4 text-blue-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {activeDevices}
            <span className="text-sm font-normal text-gray-400 ml-1">
              / {totalDevices}
            </span>
          </div>
          <div className="text-xs text-gray-500 mt-1 mb-2">
            {pct}%
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div
              className="bg-green-500 h-1.5 rounded-full"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {t("equipmentHealthDesc", { total: totalDevices })}
          </p>
        </CardContent>
      </Card>

      {/* 카드 2: 실시간 전력 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-gray-500">
            {t("realtimePower")}
          </CardTitle>
          <Zap className="h-4 w-4 text-amber-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {energyKw?.toFixed(0) || "—"}
            <span className="text-sm font-normal text-gray-400 ml-1">kW</span>
          </div>
          {energyChangePct !== null && energyChangePct !== undefined ? (
            <div className={`flex items-center gap-1 text-xs mt-1 ${energyChangePct >= 0 ? "text-green-600" : "text-red-500"}`}>
              {energyChangePct >= 0 ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              <span>{Math.abs(energyChangePct).toFixed(1)}%</span>
              <span className="text-gray-400">{t("vsLastWeek")}</span>
            </div>
          ) : (
            <div className="h-4 mt-1" />
          )}
        </CardContent>
      </Card>

      {/* 카드 3: 알람 현황 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-gray-500">
            {t("alarmStatus")}
          </CardTitle>
          <AlertTriangle className="h-4 w-4 text-yellow-500" />
        </CardHeader>
        <CardContent>
          {totalAlarms === 0 ? (
            <p className="text-sm text-green-600 font-medium mt-1">{t("noActiveAlarms")}</p>
          ) : (
            <div className="flex flex-col gap-1 mt-1">
              <div className="flex items-center gap-1.5 text-xs">
                <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                <span className="font-medium text-gray-700">{alarmCritical}</span>
                <span className="text-gray-400">{t("alarmCritical")}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <span className="w-2 h-2 rounded-full bg-yellow-500 flex-shrink-0" />
                <span className="font-medium text-gray-700">{alarmWarning}</span>
                <span className="text-gray-400">{t("alarmWarning")}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <span className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
                <span className="font-medium text-gray-700">{alarmInfo}</span>
                <span className="text-gray-400">{t("alarmInfo")}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 카드 4: 시뮬레이션 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-gray-500">
            {t("simulation")}
          </CardTitle>
          <Radio className="h-4 w-4 text-green-500" />
        </CardHeader>
        <CardContent>
          <Badge variant={simStatus === "running" ? "success" : "secondary"}>
            {simStatus === "running" ? t("simRunning") : t("simStopped")}
          </Badge>
          <p className="text-xs text-gray-500 mt-2">{t("simDesc")}</p>
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Activity,
  Thermometer,
  AlertTriangle,
  Radio,
} from "lucide-react";

interface WidgetKPIProps {
  activeDevices: number;
  totalDevices: number;
  avgTemperature: number;
  alarmCount: number;
  simStatus: string;
}

export function WidgetKPI({
  activeDevices,
  totalDevices,
  avgTemperature,
  alarmCount,
  simStatus,
}: WidgetKPIProps) {
  const t = useTranslations("dashboard");
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 h-full">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-gray-500">
            {t("activeDevices")}
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
          <p className="text-xs text-gray-500 mt-1">{t("activeDevicesDesc")}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-gray-500">
            {t("avgTemp")}
          </CardTitle>
          <Thermometer className="h-4 w-4 text-orange-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {avgTemperature}
            <span className="text-sm font-normal text-gray-400 ml-1">°C</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">{t("avgTempDesc")}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-gray-500">
            {t("activeAlarms")}
          </CardTitle>
          <AlertTriangle className="h-4 w-4 text-yellow-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {alarmCount}
            <span className="text-sm font-normal text-gray-400 ml-1">{t("alarmUnit")}</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">{t("activeAlarmsDesc")}</p>
        </CardContent>
      </Card>

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

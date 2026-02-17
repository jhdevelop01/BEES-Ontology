"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle } from "lucide-react";
import type { SSEAlarmEvent } from "@/lib/sse";

interface WidgetAlarmsProps {
  alarms: SSEAlarmEvent[];
}

export function WidgetAlarms({ alarms }: WidgetAlarmsProps) {
  const t = useTranslations("dashboard");
  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex-shrink-0">
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-yellow-500" />
          {t("recentAlarms")}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-auto">
        {alarms.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">
                    {t("thSeverity")}
                  </th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">
                    {t("thEquipment")}
                  </th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">
                    {t("thType")}
                  </th>
                  <th className="text-right py-2 px-3 text-gray-500 font-medium">
                    {t("thValue")}
                  </th>
                  <th className="text-right py-2 px-3 text-gray-500 font-medium">
                    {t("thThreshold")}
                  </th>
                  <th className="text-right py-2 px-3 text-gray-500 font-medium">
                    {t("thTime")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {alarms
                  .slice(-10)
                  .reverse()
                  .map((a, i) => (
                    <tr
                      key={`alarm-${i}`}
                      className="border-b border-gray-50 hover:bg-gray-50"
                    >
                      <td className="py-2 px-3">
                        <Badge
                          variant={
                            a.severity === "critical" ? "danger" : "warning"
                          }
                        >
                          {a.severity}
                        </Badge>
                      </td>
                      <td className="py-2 px-3 font-mono text-xs">
                        {a.equipment || "-"}
                      </td>
                      <td className="py-2 px-3">{a.type || "-"}</td>
                      <td className="py-2 px-3 text-right">
                        {a.value?.toFixed(1) ?? "-"}
                      </td>
                      <td className="py-2 px-3 text-right">
                        {a.threshold?.toFixed(1) ?? "-"}
                      </td>
                      <td className="py-2 px-3 text-right text-xs text-gray-400">
                        {a.ts
                          ? new Date(a.ts * 1000).toLocaleTimeString("ko-KR")
                          : "-"}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            <div className="text-center">
              <CheckCircle className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p>{t("noAlarms")}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

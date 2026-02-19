"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { SSEPointEvent } from "@/lib/sse";

interface WidgetSensorsProps {
  points: Record<string, SSEPointEvent>;
}

export function WidgetSensors({ points }: WidgetSensorsProps) {
  const t = useTranslations("dashboard");
  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex-shrink-0">
        <CardTitle className="text-base">{t("recentSensors")}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-auto">
        {Object.keys(points).length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-2 px-3 text-slate-400 font-medium">
                    {t("thSensorId")}
                  </th>
                  <th className="text-right py-2 px-3 text-slate-400 font-medium">
                    {t("thValue")}
                  </th>
                  <th className="text-left py-2 px-3 text-slate-400 font-medium">
                    {t("thUnit")}
                  </th>
                  <th className="text-left py-2 px-3 text-slate-400 font-medium">
                    {t("thQuality")}
                  </th>
                  <th className="text-right py-2 px-3 text-slate-400 font-medium">
                    {t("thTime")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {Object.values(points)
                  .sort((a, b) => (b.ts || 0) - (a.ts || 0))
                  .slice(0, 10)
                  .map((p) => (
                    <tr
                      key={p.point_id}
                      className="border-b border-white/5 hover:bg-white/5"
                    >
                      <td className="py-2 px-3 font-mono text-xs">
                        {p.point_id}
                      </td>
                      <td className="py-2 px-3 text-right font-semibold text-cyan-400">
                        {typeof p.value === "number"
                          ? p.value.toFixed(2)
                          : "-"}
                      </td>
                      <td className="py-2 px-3 text-slate-400">{p.unit}</td>
                      <td className="py-2 px-3">
                        <Badge
                          variant={
                            p.quality === "good" ? "success" : "warning"
                          }
                        >
                          {p.quality}
                        </Badge>
                      </td>
                      <td className="py-2 px-3 text-right text-xs text-slate-500">
                        {p.ts
                          ? new Date(p.ts * 1000).toLocaleTimeString("ko-KR")
                          : "-"}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-slate-500 text-sm">
            <p>{t("noSensorData")}</p>
            <p className="text-xs mt-1">
              {t("noSensorHint")}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

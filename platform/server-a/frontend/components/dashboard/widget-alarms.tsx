"use client";

import React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            {t("recentAlarms")}
          </CardTitle>
          <Link href="/alarms" className="text-xs text-cyan-400 hover:text-cyan-300">
            {t("viewAllAlarms")}
          </Link>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-auto">
        {alarms.length > 0 ? (
          <div>
            {alarms
              .slice(-8)
              .reverse()
              .map((a, i) => (
                <div
                  key={`alarm-${i}`}
                  className="flex items-center gap-2 py-1.5 border-b border-white/5"
                >
                  {/* severity 색상 도트 + glow */}
                  <span
                    className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      a.severity === "critical"
                        ? "bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.6)]"
                        : a.severity === "warning"
                        ? "bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.6)]"
                        : "bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.6)]"
                    }`}
                  />
                  {/* 장비명 */}
                  <span className="text-xs font-medium text-slate-200 truncate max-w-[120px]">
                    {a.equipment?.replace("bldg:", "") || "—"}
                  </span>
                  {/* 유형 */}
                  <span className="text-xs text-slate-500 truncate flex-1">
                    {a.type || "—"}
                  </span>
                  {/* 값 */}
                  <span className="text-xs font-mono text-slate-400 flex-shrink-0">
                    {a.value?.toFixed(1) ?? "—"}
                  </span>
                  {/* 시각 */}
                  <span className="text-[10px] text-slate-500 flex-shrink-0">
                    {a.ts
                      ? new Date(a.ts * 1000).toLocaleTimeString("ko-KR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"}
                  </span>
                </div>
              ))}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-slate-500 text-sm">
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

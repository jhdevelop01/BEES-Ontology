"use client";

import React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { AlertTriangle, CheckCircle } from "lucide-react";
import type { SSEAlarmEvent } from "@/lib/sse";

interface WidgetAlarmsProps {
  alarms: SSEAlarmEvent[];
}

export function WidgetAlarms({ alarms }: WidgetAlarmsProps) {
  const t = useTranslations("dashboard");
  return (
    <div
      className="h-full flex flex-col rounded-xl"
      style={{
        background: "rgba(255,255,255,0.04)",
        backdropFilter: "blur(24px)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderLeft: alarms.length > 0
          ? "4px solid #f43f5e"
          : "4px solid rgba(255,255,255,0.08)",
        boxShadow: alarms.length > 0
          ? "0 0 24px rgba(244,63,94,0.12)"
          : "none",
      }}
    >
      <div className="flex-shrink-0 p-4 pb-2">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <AlertTriangle
              className="h-4 w-4"
              style={{
                color: "#fbbf24",
                filter: "drop-shadow(0 0 4px rgba(251,191,36,0.6))",
              }}
            />
            {t("recentAlarms")}
          </h3>
          <Link
            href="/alarms"
            className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            {t("viewAllAlarms")}
          </Link>
        </div>
      </div>
      <div className="flex-1 overflow-auto px-4 pb-4">
        {alarms.length > 0 ? (
          <div>
            {alarms
              .slice(-8)
              .reverse()
              .map((a, i) => (
                <div
                  key={`alarm-${i}`}
                  className="flex items-center gap-2 py-1.5 border-b border-white/5 transition-colors hover:bg-white/[0.02] rounded px-1"
                >
                  {/* severity dot with neon glow */}
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{
                      background:
                        a.severity === "critical"
                          ? "#f43f5e"
                          : a.severity === "warning"
                          ? "#f59e0b"
                          : "#22d3ee",
                      boxShadow:
                        a.severity === "critical"
                          ? "0 0 8px rgba(244,63,94,0.7)"
                          : a.severity === "warning"
                          ? "0 0 8px rgba(245,158,11,0.7)"
                          : "0 0 8px rgba(34,211,238,0.7)",
                    }}
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
              <CheckCircle
                className="h-8 w-8 mx-auto mb-2 opacity-30"
                style={{ filter: "drop-shadow(0 0 4px rgba(52,211,153,0.3))" }}
              />
              <p>{t("noAlarms")}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

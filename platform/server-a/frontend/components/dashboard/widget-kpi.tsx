"use client";

import React from "react";
import { useTranslations } from "next-intl";
import {
  Activity,
  Zap,
  AlertTriangle,
  Radio,
  TrendingUp,
  TrendingDown,
  type LucideIcon,
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

/* ── 3D Sci-fi Icon Container ── */
function Icon3D({
  Icon,
  color,
  active,
  size = 56,
}: {
  Icon: LucideIcon;
  color: string;
  active: boolean;
  size?: number;
}) {
  return (
    <div
      className="relative flex items-center justify-center flex-shrink-0"
      style={{ width: size, height: size }}
    >
      {/* Outer rotating glow ring */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `conic-gradient(from 0deg, transparent 0%, ${color}50 15%, transparent 30%, ${color}30 50%, transparent 65%, ${color}40 80%, transparent 100%)`,
          animation: active ? "spin 6s linear infinite" : "none",
          opacity: active ? 1 : 0.3,
        }}
      />
      {/* Dark spacer */}
      <div
        className="absolute rounded-full"
        style={{ inset: 2, background: "rgba(8,12,24,0.95)" }}
      />
      {/* Middle ring border */}
      <div
        className="absolute rounded-full"
        style={{
          inset: 4,
          border: `1.5px solid ${color}35`,
          background: "transparent",
        }}
      />
      {/* Inner 3D circle */}
      <div
        className="absolute rounded-full"
        style={{
          inset: 8,
          background: `radial-gradient(circle at 35% 30%, ${color}18, rgba(8,12,24,0.95) 70%)`,
          border: `1px solid ${color}20`,
          boxShadow: active
            ? `0 0 20px ${color}35, inset 0 1px 1px ${color}15, inset 0 -3px 6px rgba(0,0,0,0.4)`
            : `inset 0 1px 1px ${color}08, inset 0 -3px 6px rgba(0,0,0,0.3)`,
        }}
      />
      {/* Top highlight arc */}
      <div
        className="absolute rounded-full"
        style={{
          inset: 10,
          background: `linear-gradient(160deg, ${color}12 0%, transparent 45%)`,
          pointerEvents: "none",
        }}
      />
      {/* Indicator dots */}
      {active && (
        <>
          <div
            className="absolute rounded-full"
            style={{
              width: 3,
              height: 3,
              top: 4,
              right: 9,
              background: color,
              boxShadow: `0 0 5px ${color}`,
            }}
          />
          <div
            className="absolute rounded-full"
            style={{
              width: 2,
              height: 2,
              bottom: 6,
              left: 10,
              background: color,
              boxShadow: `0 0 4px ${color}`,
              opacity: 0.6,
            }}
          />
        </>
      )}
      {/* Icon */}
      <Icon
        size={size * 0.38}
        strokeWidth={1.5}
        style={{
          color,
          filter: active
            ? `drop-shadow(0 0 6px ${color}90) drop-shadow(0 0 2px ${color}60)`
            : `drop-shadow(0 0 2px ${color}40)`,
          position: "relative",
          zIndex: 1,
        }}
      />
    </div>
  );
}

/* ── KPI Card Colors ── */
const KPI_COLORS = {
  equipment: "#22d3ee", // cyan
  energy: "#fbbf24", // amber
  alarm: "#f43f5e", // rose
  simulation: "#34d399", // emerald
};

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
  const isRunning = simStatus === "running";

  const pctGrad =
    pct > 80
      ? `linear-gradient(90deg, ${KPI_COLORS.equipment}, rgba(52,211,153,0.8))`
      : pct > 50
      ? `linear-gradient(90deg, rgba(251,191,36,0.8), rgba(245,158,11,0.6))`
      : `linear-gradient(90deg, rgba(251,113,133,0.8), rgba(239,68,68,0.6))`;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 h-full">
      {/* 카드 1: 장비 가동률 */}
      <div
        className="rounded-xl transition-all duration-200 hover:scale-[1.02] cursor-default"
        style={{
          background: "rgba(255,255,255,0.04)",
          backdropFilter: "blur(24px)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderLeft: `4px solid ${KPI_COLORS.equipment}`,
          boxShadow: pct > 80 ? `0 0 24px ${KPI_COLORS.equipment}15` : "none",
        }}
      >
        <div className="p-4 flex items-start gap-3">
          <Icon3D Icon={Activity} color={KPI_COLORS.equipment} active={pct > 50} />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-slate-400 mb-1">
              {t("equipmentHealth")}
            </p>
            <div className="text-2xl font-bold font-mono text-white">
              {activeDevices}
              <span className="text-sm font-normal text-slate-500 ml-1">/ {totalDevices}</span>
            </div>
            <div className="text-xs text-slate-400 mt-0.5 mb-2">{pct}%</div>
            {/* 3D Progress bar */}
            <div className="w-full h-[6px] bg-white/[0.06] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${Math.max(pct, 2)}%`, background: pctGrad }}
              />
            </div>
            <p className="text-[10px] text-slate-500 mt-1.5">
              {t("equipmentHealthDesc", { total: totalDevices })}
            </p>
          </div>
        </div>
      </div>

      {/* 카드 2: 실시간 전력 */}
      <div
        className="rounded-xl transition-all duration-200 hover:scale-[1.02] cursor-default"
        style={{
          background: "rgba(255,255,255,0.04)",
          backdropFilter: "blur(24px)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderLeft: `4px solid ${KPI_COLORS.energy}`,
          boxShadow: energyKw ? `0 0 24px ${KPI_COLORS.energy}15` : "none",
        }}
      >
        <div className="p-4 flex items-start gap-3">
          <Icon3D Icon={Zap} color={KPI_COLORS.energy} active={!!energyKw} />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-slate-400 mb-1">
              {t("realtimePower")}
            </p>
            <div className="text-2xl font-bold font-mono text-white">
              {energyKw?.toFixed(0) || "—"}
              <span className="text-sm font-normal text-slate-500 ml-1">kW</span>
            </div>
            {energyChangePct !== null && energyChangePct !== undefined ? (
              <div
                className={`flex items-center gap-1 text-xs mt-1 ${
                  energyChangePct >= 0 ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {energyChangePct >= 0 ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                <span>{Math.abs(energyChangePct).toFixed(1)}%</span>
                <span className="text-slate-500">{t("vsLastWeek")}</span>
              </div>
            ) : (
              <div className="h-4 mt-1" />
            )}
          </div>
        </div>
      </div>

      {/* 카드 3: 알람 현황 */}
      <div
        className="rounded-xl transition-all duration-200 hover:scale-[1.02] cursor-default"
        style={{
          background: "rgba(255,255,255,0.04)",
          backdropFilter: "blur(24px)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderLeft: `4px solid ${totalAlarms > 0 ? KPI_COLORS.alarm : "#34d399"}`,
          boxShadow:
            totalAlarms > 0 ? `0 0 24px ${KPI_COLORS.alarm}20` : "none",
        }}
      >
        <div className="p-4 flex items-start gap-3">
          <Icon3D
            Icon={AlertTriangle}
            color={totalAlarms > 0 ? KPI_COLORS.alarm : "#34d399"}
            active={totalAlarms > 0}
          />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-slate-400 mb-1">
              {t("alarmStatus")}
            </p>
            {totalAlarms === 0 ? (
              <p className="text-sm text-emerald-400 font-medium mt-1">
                {t("noActiveAlarms")}
              </p>
            ) : (
              <div className="flex flex-col gap-1 mt-0.5">
                <div className="flex items-center gap-1.5 text-xs">
                  <span
                    className="w-2 h-2 rounded-full bg-rose-500 flex-shrink-0"
                    style={{ boxShadow: "0 0 6px rgba(244,63,94,0.6)" }}
                  />
                  <span className="font-medium text-slate-200">{alarmCritical}</span>
                  <span className="text-slate-500">{t("alarmCritical")}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                  <span
                    className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0"
                    style={{ boxShadow: "0 0 6px rgba(245,158,11,0.6)" }}
                  />
                  <span className="font-medium text-slate-200">{alarmWarning}</span>
                  <span className="text-slate-500">{t("alarmWarning")}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                  <span
                    className="w-2 h-2 rounded-full bg-cyan-400 flex-shrink-0"
                    style={{ boxShadow: "0 0 6px rgba(34,211,238,0.6)" }}
                  />
                  <span className="font-medium text-slate-200">{alarmInfo}</span>
                  <span className="text-slate-500">{t("alarmInfo")}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 카드 4: 시뮬레이션 */}
      <div
        className="rounded-xl transition-all duration-200 hover:scale-[1.02] cursor-default"
        style={{
          background: "rgba(255,255,255,0.04)",
          backdropFilter: "blur(24px)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderLeft: `4px solid ${KPI_COLORS.simulation}`,
          boxShadow: isRunning ? `0 0 24px ${KPI_COLORS.simulation}20` : "none",
        }}
      >
        <div className="p-4 flex items-start gap-3">
          <Icon3D Icon={Radio} color={KPI_COLORS.simulation} active={isRunning} />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-slate-400 mb-1">
              {t("simulation")}
            </p>
            {/* Status badge with glow */}
            <div className="flex items-center gap-2 mt-1">
              <span
                className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                  isRunning
                    ? "bg-emerald-400"
                    : "bg-slate-500"
                }`}
                style={{
                  boxShadow: isRunning
                    ? "0 0 10px rgba(52,211,153,0.7)"
                    : "none",
                }}
              />
              <span
                className={`text-sm font-semibold ${
                  isRunning ? "text-emerald-400" : "text-slate-400"
                }`}
              >
                {isRunning ? t("simRunning") : t("simStopped")}
              </span>
            </div>
            <p className="text-[10px] text-slate-500 mt-2">{t("simDesc")}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

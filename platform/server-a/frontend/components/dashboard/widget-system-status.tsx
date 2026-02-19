"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  Snowflake,
  Flame,
  Wind,
  Zap,
  Droplets,
  Cpu,
  type LucideIcon,
} from "lucide-react";
import type { EquipmentListItem } from "@/lib/api";

interface WidgetSystemStatusProps {
  devices: Record<string, { is_active: boolean; device_id: string }>;
  equipmentList: EquipmentListItem[];
}

type SystemKey =
  | "cooling"
  | "heating"
  | "air_handling"
  | "electrical"
  | "water"
  | "automation";

const SYSTEM_META: Record<
  SystemKey,
  { icon: LucideIcon; color: string; i18nKey: string }
> = {
  cooling: { icon: Snowflake, color: "#22d3ee", i18nKey: "systemCooling" },
  heating: { icon: Flame, color: "#fb7185", i18nKey: "systemHeating" },
  air_handling: { icon: Wind, color: "#2dd4bf", i18nKey: "systemAirHandling" },
  electrical: { icon: Zap, color: "#fbbf24", i18nKey: "systemElectrical" },
  water: { icon: Droplets, color: "#06b6d4", i18nKey: "systemWater" },
  automation: { icon: Cpu, color: "#a78bfa", i18nKey: "systemAutomation" },
};

/* ── Compact 3D Icon ── */
function SystemIcon3D({
  Icon,
  color,
  active,
}: {
  Icon: LucideIcon;
  color: string;
  active: boolean;
}) {
  return (
    <div
      className="relative flex items-center justify-center flex-shrink-0"
      style={{ width: 40, height: 40 }}
    >
      {/* Outer rotating ring */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `conic-gradient(from 0deg, transparent 0%, ${color}50 15%, transparent 30%, ${color}30 50%, transparent 65%, ${color}40 80%, transparent 100%)`,
          animation: active ? "spin 6s linear infinite" : "none",
          opacity: active ? 1 : 0.25,
        }}
      />
      {/* Dark spacer */}
      <div
        className="absolute rounded-full"
        style={{ inset: 2, background: "rgba(8,12,24,0.95)" }}
      />
      {/* Inner circle */}
      <div
        className="absolute rounded-full"
        style={{
          inset: 4,
          background: `radial-gradient(circle at 35% 30%, ${color}18, rgba(8,12,24,0.95) 70%)`,
          border: `1px solid ${color}20`,
          boxShadow: active
            ? `0 0 14px ${color}30, inset 0 1px 1px ${color}10, inset 0 -2px 4px rgba(0,0,0,0.3)`
            : `inset 0 -2px 4px rgba(0,0,0,0.2)`,
        }}
      />
      {/* Icon */}
      <Icon
        size={18}
        strokeWidth={1.5}
        style={{
          color,
          filter: active
            ? `drop-shadow(0 0 5px ${color}90) drop-shadow(0 0 2px ${color}60)`
            : `drop-shadow(0 0 2px ${color}30)`,
          position: "relative",
          zIndex: 1,
        }}
      />
    </div>
  );
}

export function WidgetSystemStatus({
  devices,
  equipmentList,
}: WidgetSystemStatusProps) {
  const t = useTranslations("dashboard");

  const systemStats = useMemo(() => {
    const filtered = equipmentList.filter((eq) => eq.category !== "component");

    const groups: Record<SystemKey, EquipmentListItem[]> = {
      cooling: [],
      heating: [],
      air_handling: [],
      electrical: [],
      water: [],
      automation: [],
    };

    for (const eq of filtered) {
      if (eq.subcategory === "cooling") {
        groups.cooling.push(eq);
      } else if (eq.subcategory === "heating") {
        groups.heating.push(eq);
      } else if (
        eq.subcategory === "air_handling" ||
        eq.subcategory === "special"
      ) {
        groups.air_handling.push(eq);
      } else if (
        eq.category === "electrical_transport" ||
        eq.category === "electrical"
      ) {
        groups.electrical.push(eq);
      } else if (eq.category === "water") {
        groups.water.push(eq);
      } else if (
        eq.category === "automation" ||
        eq.category === "lighting"
      ) {
        groups.automation.push(eq);
      }
    }

    return (Object.keys(groups) as SystemKey[]).map((key) => {
      const items = groups[key];
      const total = items.length;
      const active = items.filter((eq) => {
        const deviceId = eq.id;
        const info = devices[deviceId];
        return info?.is_active === true;
      }).length;
      return { key, total, active };
    });
  }, [equipmentList, devices]);

  return (
    <div
      className="h-full flex flex-col rounded-xl"
      style={{
        background: "rgba(255,255,255,0.04)",
        backdropFilter: "blur(24px)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div className="flex-shrink-0 p-4 pb-2">
        <h3 className="text-base font-semibold text-white">
          {t("systemStatus")}
        </h3>
      </div>
      <div className="flex-1 grid grid-cols-2 md:grid-cols-3 gap-3 p-4 pt-2">
        {systemStats.map(({ key, total, active }) => {
          if (total === 0) return null;
          const meta = SYSTEM_META[key];
          const allGood = total > 0 && active === total;
          const allOff = active === 0;
          const offCount = total - active;
          const statusText = allGood
            ? t("systemAllGood")
            : t("systemSomeOff", { count: offCount });
          const activePct = total > 0 ? (active / total) * 100 : 0;

          const barGrad = allGood
            ? `linear-gradient(90deg, ${meta.color}, rgba(52,211,153,0.8))`
            : allOff
            ? `linear-gradient(90deg, rgba(251,113,133,0.8), rgba(239,68,68,0.6))`
            : `linear-gradient(90deg, rgba(251,191,36,0.8), rgba(245,158,11,0.6))`;

          return (
            <Link key={key} href="/monitoring">
              <div
                className="rounded-lg p-3 cursor-pointer transition-all duration-200 hover:scale-[1.02]"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderLeft: `3px solid ${meta.color}`,
                  boxShadow: allGood
                    ? `0 0 16px ${meta.color}15`
                    : "none",
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <SystemIcon3D
                    Icon={meta.icon}
                    color={meta.color}
                    active={!allOff}
                  />
                  <div className="min-w-0">
                    <span className="text-xs font-medium text-slate-300 block truncate">
                      {t(meta.i18nKey)}
                    </span>
                    <span className="text-lg font-bold text-white font-mono">
                      {t("systemActive", { active, total })}
                    </span>
                  </div>
                </div>
                {/* Mini progress bar */}
                <div className="w-full h-[5px] bg-white/[0.06] rounded-full overflow-hidden mb-1">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${Math.max(activePct, 2)}%`,
                      background: barGrad,
                    }}
                  />
                </div>
                <p className="text-[10px] text-slate-500">{statusText}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

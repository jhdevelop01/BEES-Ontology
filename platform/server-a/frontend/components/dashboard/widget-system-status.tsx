"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Snowflake, Flame, Wind, Zap, Droplets, Cpu } from "lucide-react";
import type { EquipmentListItem } from "@/lib/api";

interface WidgetSystemStatusProps {
  devices: Record<string, { is_active: boolean; device_id: string }>;
  equipmentList: EquipmentListItem[];
}

type SystemKey = "cooling" | "heating" | "air_handling" | "electrical" | "water" | "automation";

const SYSTEM_ICONS: Record<SystemKey, React.ReactNode> = {
  cooling: <Snowflake className="h-5 w-5 text-blue-500" />,
  heating: <Flame className="h-5 w-5 text-red-500" />,
  air_handling: <Wind className="h-5 w-5 text-teal-500" />,
  electrical: <Zap className="h-5 w-5 text-yellow-500" />,
  water: <Droplets className="h-5 w-5 text-cyan-500" />,
  automation: <Cpu className="h-5 w-5 text-purple-500" />,
};

const I18N_KEYS: Record<SystemKey, string> = {
  cooling: "systemCooling",
  heating: "systemHeating",
  air_handling: "systemAirHandling",
  electrical: "systemElectrical",
  water: "systemWater",
  automation: "systemAutomation",
};

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
      } else if (eq.subcategory === "air_handling" || eq.subcategory === "special") {
        groups.air_handling.push(eq);
      } else if (eq.category === "electrical_transport" || eq.category === "electrical") {
        groups.electrical.push(eq);
      } else if (eq.category === "water") {
        groups.water.push(eq);
      } else if (eq.category === "automation" || eq.category === "lighting") {
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
    <Card className="h-full flex flex-col">
      <CardHeader className="flex-shrink-0 pb-2">
        <CardTitle className="text-base">{t("systemStatus")}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 grid grid-cols-2 md:grid-cols-3 gap-3">
        {systemStats.map(({ key, total, active }) => {
          if (total === 0) return null;
          const allGood = total > 0 && active === total;
          const allOff = active === 0;
          const bgColor = allGood
            ? "bg-green-50 border-green-200"
            : allOff
            ? "bg-red-50 border-red-200"
            : "bg-yellow-50 border-yellow-200";
          const offCount = total - active;
          const statusText = allGood
            ? t("systemAllGood")
            : t("systemSomeOff", { count: offCount });

          return (
            <Link key={key} href="/monitoring">
              <div
                className={`rounded-lg border p-3 cursor-pointer hover:opacity-80 transition-opacity ${bgColor}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  {SYSTEM_ICONS[key as SystemKey]}
                  <span className="text-xs font-medium text-gray-700">
                    {t(I18N_KEYS[key as SystemKey])}
                  </span>
                </div>
                <div className="text-lg font-bold text-gray-800">
                  {t("systemActive", { active, total })}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{statusText}</p>
              </div>
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}

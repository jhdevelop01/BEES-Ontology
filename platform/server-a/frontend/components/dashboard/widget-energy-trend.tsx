"use client";

import React, { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Zap } from "lucide-react";
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { EnergyProfileData } from "@/lib/api";

interface WidgetEnergyTrendProps {
  profileData: EnergyProfileData | null;
}

interface CumulativeDataPoint {
  time: string;
  ts: number;
  cumulativeKwh: number;
  currentKw: number;
}

export function WidgetEnergyTrend({ profileData }: WidgetEnergyTrendProps) {
  const t = useTranslations("dashboard");

  const chartData: CumulativeDataPoint[] = useMemo(() => {
    if (!profileData?.data?.length) return [];

    // Step 1: Filter for _kW power points only
    const kwPoints = profileData.data.filter((d) =>
      d.point_id.includes("_kW")
    );
    if (kwPoints.length === 0) return [];

    // Step 2: Group by timestamp and sum kW values
    const tsMap = new Map<number, number>();
    for (const d of kwPoints) {
      tsMap.set(d.ts, (tsMap.get(d.ts) ?? 0) + d.value);
    }

    // Step 3: Sort by timestamp
    const sorted = Array.from(tsMap.entries()).sort((a, b) => a[0] - b[0]);

    // Step 4: Calculate cumulative kWh
    let cumulativeKwh = 0;
    const result: CumulativeDataPoint[] = [];

    for (let i = 0; i < sorted.length; i++) {
      const [ts, totalKw] = sorted[i];

      if (i > 0) {
        const prevTs = sorted[i - 1][0];
        const dtHours = (ts - prevTs) / 3600;
        // Use trapezoidal rule: average of previous and current power
        const prevKw = sorted[i - 1][1];
        cumulativeKwh += ((prevKw + totalKw) / 2) * dtHours;
      }

      const timeLabel = new Date(ts * 1000).toLocaleTimeString("ko-KR", {
        hour: "2-digit",
        minute: "2-digit",
      });

      result.push({
        time: timeLabel,
        ts,
        cumulativeKwh: Math.round(cumulativeKwh),
        currentKw: Math.round(totalKw),
      });
    }

    return result;
  }, [profileData]);

  const totalKwh =
    chartData.length > 0 ? chartData[chartData.length - 1].cumulativeKwh : 0;

  const currentKw =
    chartData.length > 0 ? chartData[chartData.length - 1].currentKw : 0;

  const hasData = chartData.length > 0 && totalKwh > 0;

  return (
    <div
      className="h-full flex flex-col rounded-xl"
      style={{
        background: "rgba(255,255,255,0.04)",
        backdropFilter: "blur(24px)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderLeft: "4px solid #fbbf24",
        boxShadow: hasData ? "0 0 24px rgba(251,191,36,0.10)" : "none",
      }}
    >
      <div className="flex-shrink-0 p-4 pb-2">
        <h3 className="text-base font-semibold text-white flex items-center gap-2">
          <Zap
            className="h-4 w-4"
            style={{
              color: "#fbbf24",
              filter: "drop-shadow(0 0 4px rgba(251,191,36,0.6))",
            }}
          />
          {t("energyCumulative")}
        </h3>
        {hasData && (
          <div className="flex items-center gap-4 text-sm mt-1">
            <span className="font-semibold text-amber-400">
              {t("energyTotalKwh", { value: totalKwh.toLocaleString() })}
            </span>
            <span className="text-slate-400">
              {t("energyCurrentKw", { value: currentKw.toLocaleString() })}
            </span>
          </div>
        )}
      </div>
      <div className="flex-1 min-h-0 px-4 pb-4">
        {hasData ? (
          <ResponsiveContainer width="100%" height={200}>
            <ComposedChart
              data={chartData}
              margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
            >
              <defs>
                <linearGradient
                  id="kwhGradient"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="5%" stopColor="#fbbf24" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#fbbf24" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.05)"
              />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                yAxisId="kwh"
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => v.toLocaleString()}
                width={55}
              />
              <YAxis
                yAxisId="kw"
                orientation="right"
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => v.toLocaleString()}
                width={55}
                hide
              />
              <Tooltip
                formatter={(value: number, name: string) => {
                  if (name === "cumulativeKwh") {
                    return [
                      `${value.toLocaleString()} kWh`,
                      t("energyTooltipCumul"),
                    ];
                  }
                  return [
                    `${value.toLocaleString()} kW`,
                    t("energyTooltipPower"),
                  ];
                }}
                labelStyle={{ fontWeight: 600, color: "#e2e8f0" }}
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 8,
                  background: "rgba(15,23,42,0.9)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "#e2e8f0",
                }}
              />
              <Legend
                formatter={(value: string) => {
                  if (value === "cumulativeKwh") return t("energyLegendCumul");
                  if (value === "currentKw") return t("energyLegendPower");
                  return value;
                }}
                iconSize={10}
                wrapperStyle={{ fontSize: 11, color: "#94a3b8" }}
              />
              <Area
                yAxisId="kwh"
                type="monotone"
                dataKey="cumulativeKwh"
                stroke="#fbbf24"
                strokeWidth={2}
                fill="url(#kwhGradient)"
                dot={false}
                activeDot={{ r: 4 }}
              />
              <Line
                yAxisId="kw"
                type="monotone"
                dataKey="currentKw"
                stroke="#94a3b8"
                strokeWidth={1.5}
                strokeDasharray="4 3"
                dot={false}
                activeDot={{ r: 3 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-48 text-sm text-slate-500">
            {t("energyNoData")}
          </div>
        )}
      </div>
    </div>
  );
}

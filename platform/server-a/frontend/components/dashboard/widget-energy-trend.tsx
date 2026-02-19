"use client";

import React, { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

  const totalKwh = chartData.length > 0
    ? chartData[chartData.length - 1].cumulativeKwh
    : 0;

  const currentKw = chartData.length > 0
    ? chartData[chartData.length - 1].currentKw
    : 0;

  const hasData = chartData.length > 0 && totalKwh > 0;

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex-shrink-0 pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Zap className="h-4 w-4 text-amber-500" />
          {t("energyCumulative")}
        </CardTitle>
        {hasData && (
          <div className="flex items-center gap-4 text-sm">
            <span className="font-semibold text-amber-600">
              {t("energyTotalKwh", { value: totalKwh.toLocaleString() })}
            </span>
            <span className="text-muted-foreground">
              {t("energyCurrentKw", { value: currentKw.toLocaleString() })}
            </span>
          </div>
        )}
      </CardHeader>
      <CardContent className="flex-1 min-h-0">
        {hasData ? (
          <ResponsiveContainer width="100%" height={200}>
            <ComposedChart
              data={chartData}
              margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
            >
              <defs>
                <linearGradient id="kwhGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                yAxisId="kwh"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => v.toLocaleString()}
                width={55}
              />
              <YAxis
                yAxisId="kw"
                orientation="right"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => v.toLocaleString()}
                width={55}
                hide
              />
              <Tooltip
                formatter={(value: number, name: string) => {
                  if (name === "cumulativeKwh") {
                    return [`${value.toLocaleString()} kWh`, t("energyTooltipCumul")];
                  }
                  return [`${value.toLocaleString()} kW`, t("energyTooltipPower")];
                }}
                labelStyle={{ fontWeight: 600 }}
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 8,
                  border: "1px solid #e5e7eb",
                }}
              />
              <Legend
                formatter={(value: string) => {
                  if (value === "cumulativeKwh") return t("energyLegendCumul");
                  if (value === "currentKw") return t("energyLegendPower");
                  return value;
                }}
                iconSize={10}
                wrapperStyle={{ fontSize: 11 }}
              />
              <Area
                yAxisId="kwh"
                type="monotone"
                dataKey="cumulativeKwh"
                stroke="#f59e0b"
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
          <div className="flex items-center justify-center h-48 text-sm text-gray-400">
            {t("energyNoData")}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

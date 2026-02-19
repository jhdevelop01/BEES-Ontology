"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LiveChart, type ChartDataPoint } from "@/components/charts/live-chart";
import { Radio } from "lucide-react";

interface WidgetChartProps {
  data: ChartDataPoint[];
}

export function WidgetChart({ data }: WidgetChartProps) {
  const t = useTranslations("dashboard");
  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex-shrink-0">
        <CardTitle className="text-base">
          {t("chartTitle")}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-0">
        {data.length > 0 ? (
          <LiveChart
            data={data}
            unit="°C"
            color="#22d3ee"
            height={200}
            yMin={10}
            yMax={30}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-slate-500 text-sm">
            <div className="text-center">
              <Radio className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p>{t("waitingData")}</p>
              <p className="text-xs mt-1">
                {t("waitingDataHint")}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

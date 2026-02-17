"use client";

import React, { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  ResponsiveGridLayout,
  useContainerWidth,
  type ResponsiveLayouts,
  type Layout,
} from "react-grid-layout";
import { Button } from "@/components/ui/button";
import { Lock, Unlock, RotateCcw } from "lucide-react";
import { WidgetKPI } from "./widget-kpi";
import { WidgetChart } from "./widget-chart";
import { WidgetEquipment } from "./widget-equipment";
import { WidgetAlarms } from "./widget-alarms";
import { WidgetSensors } from "./widget-sensors";
import type { ChartDataPoint } from "@/components/charts/live-chart";
import type { SSEAlarmEvent, SSEPointEvent } from "@/lib/sse";

import "react-grid-layout/css/styles.css";

const STORAGE_KEY = "bees-dashboard-layout";

const BREAKPOINTS = { lg: 1200, md: 996, sm: 768 };
const COLS = { lg: 12, md: 12, sm: 6 };
const ROW_HEIGHT = 80;

const DEFAULT_LAYOUTS: ResponsiveLayouts = {
  lg: [
    { i: "kpi", x: 0, y: 0, w: 12, h: 2, minH: 2, minW: 6 },
    { i: "chart", x: 0, y: 2, w: 8, h: 4, minH: 3, minW: 4 },
    { i: "equipment", x: 8, y: 2, w: 4, h: 4, minH: 3, minW: 3 },
    { i: "alarms", x: 0, y: 6, w: 12, h: 4, minH: 2, minW: 4 },
    { i: "sensors", x: 0, y: 10, w: 12, h: 5, minH: 3, minW: 4 },
  ],
  md: [
    { i: "kpi", x: 0, y: 0, w: 12, h: 2, minH: 2, minW: 6 },
    { i: "chart", x: 0, y: 2, w: 12, h: 4, minH: 3, minW: 4 },
    { i: "equipment", x: 0, y: 6, w: 12, h: 4, minH: 3, minW: 3 },
    { i: "alarms", x: 0, y: 10, w: 12, h: 4, minH: 2, minW: 4 },
    { i: "sensors", x: 0, y: 14, w: 12, h: 5, minH: 3, minW: 4 },
  ],
  sm: [
    { i: "kpi", x: 0, y: 0, w: 6, h: 4, minH: 2, minW: 6 },
    { i: "chart", x: 0, y: 4, w: 6, h: 4, minH: 3, minW: 6 },
    { i: "equipment", x: 0, y: 8, w: 6, h: 4, minH: 3, minW: 6 },
    { i: "alarms", x: 0, y: 12, w: 6, h: 4, minH: 2, minW: 6 },
    { i: "sensors", x: 0, y: 16, w: 6, h: 5, minH: 3, minW: 6 },
  ],
};

function loadLayouts(): ResponsiveLayouts {
  if (typeof window === "undefined") return DEFAULT_LAYOUTS;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {
    // ignore parse errors
  }
  return DEFAULT_LAYOUTS;
}

function saveLayouts(layouts: ResponsiveLayouts) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layouts));
  } catch {
    // ignore storage errors
  }
}

export interface DashboardGridProps {
  activeDevices: number;
  totalDevices: number;
  avgTemperature: number;
  alarmCount: number;
  simStatus: string;
  satChartData: ChartDataPoint[];
  deviceList: { device_id: string; is_active: boolean }[];
  alarms: SSEAlarmEvent[];
  points: Record<string, SSEPointEvent>;
}

export function DashboardGrid(props: DashboardGridProps) {
  const t = useTranslations("dashboard");
  const { width, containerRef, mounted } = useContainerWidth();
  const [layouts, setLayouts] = useState<ResponsiveLayouts>(loadLayouts);
  const [editing, setEditing] = useState(false);

  const handleLayoutChange = useCallback(
    (_currentLayout: Layout, allLayouts: ResponsiveLayouts) => {
      setLayouts(allLayouts);
      saveLayouts(allLayouts);
    },
    []
  );

  const handleReset = useCallback(() => {
    setLayouts(DEFAULT_LAYOUTS);
    saveLayouts(DEFAULT_LAYOUTS);
  }, []);

  const editRing = editing
    ? "ring-2 ring-blue-200 ring-dashed rounded-lg"
    : "";

  return (
    <div ref={containerRef as React.RefObject<HTMLDivElement>}>
      <div className="flex justify-end gap-2 mb-3">
        {editing && (
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="h-4 w-4 mr-1" />
            {t("reset")}
          </Button>
        )}
        <Button
          variant={editing ? "default" : "outline"}
          size="sm"
          onClick={() => setEditing(!editing)}
        >
          {editing ? (
            <>
              <Lock className="h-4 w-4 mr-1" />
              {t("lock")}
            </>
          ) : (
            <>
              <Unlock className="h-4 w-4 mr-1" />
              {t("edit")}
            </>
          )}
        </Button>
      </div>

      {mounted && <ResponsiveGridLayout
        className="layout"
        width={width}
        layouts={layouts}
        breakpoints={BREAKPOINTS}
        cols={COLS}
        rowHeight={ROW_HEIGHT}
        dragConfig={{
          enabled: editing,
          cancel: "a, button, input, select, textarea, .recharts-wrapper",
        }}
        resizeConfig={{ enabled: editing }}
        onLayoutChange={handleLayoutChange}
        margin={[16, 16] as readonly [number, number]}
      >
        <div key="kpi" className={editRing}>
          <WidgetKPI
            activeDevices={props.activeDevices}
            totalDevices={props.totalDevices}
            avgTemperature={props.avgTemperature}
            alarmCount={props.alarmCount}
            simStatus={props.simStatus}
          />
        </div>
        <div key="chart" className={editRing}>
          <WidgetChart data={props.satChartData} />
        </div>
        <div key="equipment" className={editRing}>
          <WidgetEquipment devices={props.deviceList} />
        </div>
        <div key="alarms" className={editRing}>
          <WidgetAlarms alarms={props.alarms} />
        </div>
        <div key="sensors" className={editRing}>
          <WidgetSensors points={props.points} />
        </div>
      </ResponsiveGridLayout>}
    </div>
  );
}

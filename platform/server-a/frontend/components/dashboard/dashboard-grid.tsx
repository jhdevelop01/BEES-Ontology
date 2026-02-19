"use client";

import React, { useState, useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  ResponsiveGridLayout,
  useContainerWidth,
  type ResponsiveLayouts,
  type Layout,
} from "react-grid-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock, Unlock, RotateCcw, LayoutGrid, List, Building2, Loader2 } from "lucide-react";
import { WidgetKPI } from "./widget-kpi";
import { WidgetAlarms } from "./widget-alarms";
import { WidgetSystemStatus } from "./widget-system-status";
import { WidgetEnergyTrend } from "./widget-energy-trend";
import { useFloorData } from "@/components/floors/use-floor-data";
import CardViewComponent from "@/components/floors/card-view";
import ListViewComponent from "@/components/floors/list-view";
import { FloorDetailPanel } from "@/components/floors/floor-detail-panel";
import type { SSEAlarmEvent, SSEPointEvent } from "@/lib/sse";
import type { EquipmentListItem, EnergyProfileData } from "@/lib/api";

import "react-grid-layout/css/styles.css";

const STORAGE_KEY = "bees-dashboard-layout-v3";

const BREAKPOINTS = { lg: 1200, md: 996, sm: 768 };
const COLS = { lg: 12, md: 12, sm: 6 };
const ROW_HEIGHT = 80;

type FloorViewMode = "card" | "list";

const DEFAULT_LAYOUTS: ResponsiveLayouts = {
  lg: [
    { i: "kpi",     x: 0, y: 0, w: 12, h: 2, minH: 2, minW: 6 },
    { i: "systems", x: 0, y: 2, w: 12, h: 3, minH: 2, minW: 4 },
    { i: "energy",  x: 0, y: 5, w: 12, h: 4, minH: 3, minW: 4 },
    { i: "alarms",  x: 0, y: 9, w: 12, h: 4, minH: 2, minW: 4 },
  ],
  md: [
    { i: "kpi",     x: 0, y: 0, w: 12, h: 2, minH: 2, minW: 6 },
    { i: "systems", x: 0, y: 2, w: 12, h: 3, minH: 2, minW: 4 },
    { i: "energy",  x: 0, y: 5, w: 12, h: 4, minH: 3, minW: 4 },
    { i: "alarms",  x: 0, y: 9, w: 12, h: 4, minH: 2, minW: 4 },
  ],
  sm: [
    { i: "kpi",     x: 0, y: 0,  w: 6, h: 4, minH: 2, minW: 6 },
    { i: "systems", x: 0, y: 4,  w: 6, h: 4, minH: 2, minW: 6 },
    { i: "energy",  x: 0, y: 8,  w: 6, h: 4, minH: 3, minW: 6 },
    { i: "alarms",  x: 0, y: 12, w: 6, h: 4, minH: 2, minW: 6 },
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
  // KPI
  activeDevices: number;
  totalDevices: number;
  energyKw: number | null;
  energyChangePct: number | null;
  alarmCritical: number;
  alarmWarning: number;
  alarmInfo: number;
  simStatus: string;
  // System Status
  devices: Record<string, { is_active: boolean; device_id: string }>;
  equipmentList: EquipmentListItem[];
  // Alarms
  points: Record<string, SSEPointEvent>;
  alarms: SSEAlarmEvent[];
  // Energy Trend
  energyProfile: EnergyProfileData | null;
}

export function DashboardGrid(props: DashboardGridProps) {
  const t = useTranslations("dashboard");
  const tFloors = useTranslations("floors");
  const { width, containerRef, mounted } = useContainerWidth();
  const [layouts, setLayouts] = useState<ResponsiveLayouts>(loadLayouts);
  const [editing, setEditing] = useState(false);

  // --- Floor overview ---
  const {
    floorData,
    equipmentList: floorEquipmentList,
    activeAlarms,
    loading: floorLoading,
    points: floorPoints,
    devices: floorDevices,
  } = useFloorData();

  const [floorView, setFloorView] = useState<FloorViewMode>("card");
  const [selectedFloorKey, setSelectedFloorKey] = useState<string | null>(null);

  const selectedFloor = useMemo(
    () => floorData.find((f) => f.key === selectedFloorKey) || null,
    [floorData, selectedFloorKey]
  );

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

  const viewButtons: { key: FloorViewMode; icon: React.ComponentType<{ className?: string }>; labelKey: string }[] = [
    { key: "card", icon: LayoutGrid, labelKey: "viewCard" },
    { key: "list", icon: List, labelKey: "viewList" },
  ];

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
            energyKw={props.energyKw}
            energyChangePct={props.energyChangePct}
            alarmCritical={props.alarmCritical}
            alarmWarning={props.alarmWarning}
            alarmInfo={props.alarmInfo}
            simStatus={props.simStatus}
          />
        </div>
        <div key="systems" className={editRing}>
          <WidgetSystemStatus
            devices={props.devices}
            equipmentList={props.equipmentList}
          />
        </div>
        <div key="energy" className={editRing}>
          <WidgetEnergyTrend profileData={props.energyProfile} />
        </div>
        <div key="alarms" className={editRing}>
          <WidgetAlarms alarms={props.alarms} />
        </div>
      </ResponsiveGridLayout>}

      {/* ---- 층별 현황 섹션 ---- */}
      <Card className="mt-4">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4 text-gray-500" />
              {t("floorOverview")}
            </CardTitle>
            <div className="flex gap-1.5">
              {viewButtons.map(({ key, icon: Icon, labelKey }) => (
                <Button
                  key={key}
                  variant={floorView === key ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFloorView(key)}
                  className="gap-1.5"
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{tFloors(labelKey)}</span>
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {floorLoading && floorData.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-gray-400">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              {tFloors("loading")}
            </div>
          ) : (
            <>
              {floorView === "card" && (
                <CardViewComponent data={floorData} onSelectFloor={setSelectedFloorKey} />
              )}
              {floorView === "list" && (
                <ListViewComponent data={floorData} onSelectFloor={setSelectedFloorKey} />
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* ---- 층 상세 패널 ---- */}
      <FloorDetailPanel
        floor={selectedFloor}
        equipmentList={floorEquipmentList}
        points={floorPoints}
        devices={floorDevices as Record<string, { device_id: string; is_active: boolean; mode: string; ts: number }>}
        activeAlarms={activeAlarms}
        open={!!selectedFloorKey}
        onClose={() => setSelectedFloorKey(null)}
      />
    </div>
  );
}

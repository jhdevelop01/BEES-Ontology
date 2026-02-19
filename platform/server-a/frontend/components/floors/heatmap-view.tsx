"use client";

import React from "react";
import { useTranslations } from "next-intl";
import type { FloorData } from "./floor-constants";
import { tempToHex } from "./floor-constants";

/* ------------------------------------------------------------------ */
/* Props                                                               */
/* ------------------------------------------------------------------ */

interface HeatmapViewProps {
  data: FloorData[];
  onSelectFloor: (floorKey: string) => void;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** Left-border colour based on floor status. */
function statusBorderColor(status: FloorData["status"]): string {
  switch (status) {
    case "critical":
      return "border-l-red-500";
    case "warning":
      return "border-l-amber-400";
    default:
      return "border-l-transparent";
  }
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function HeatmapView({ data, onSelectFloor }: HeatmapViewProps) {
  const t = useTranslations("floors");

  return (
    <div className="flex flex-col gap-1">
      {data.map((floor) => {
        const hasData = floor.temperature !== null;
        const bgHex = tempToHex(floor.temperature);

        return (
          <button
            key={floor.key}
            type="button"
            onClick={() => onSelectFloor(floor.key)}
            className={`
              group flex items-center gap-2 w-full rounded-md border-l-4
              px-2 py-1.5 text-left transition-colors
              hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2
              focus-visible:ring-blue-400 focus-visible:ring-offset-1
              ${statusBorderColor(floor.status)}
            `}
          >
            {/* ---- Floor label ---- */}
            <span className="w-[3rem] shrink-0 text-xs font-semibold text-gray-700 text-right pr-1">
              {floor.label}
            </span>

            {/* ---- Temperature bar (heatmap core) ---- */}
            <div className="flex-1 relative h-7 rounded overflow-hidden bg-gray-100">
              {hasData ? (
                <>
                  {/* Coloured bar — full width, colour encodes temperature */}
                  <div
                    className="absolute inset-0 rounded transition-colors duration-500"
                    style={{ backgroundColor: bgHex }}
                  />

                  {/* Temperature value overlay */}
                  <span className="relative z-10 flex items-center h-full px-2 text-xs font-medium text-gray-800/90">
                    {floor.temperature!.toFixed(1)}{"\u00B0"}C
                  </span>
                </>
              ) : (
                <span className="relative z-10 flex items-center h-full px-2 text-xs text-gray-400 italic">
                  {t("noData")}
                </span>
              )}
            </div>

            {/* ---- Equipment count ---- */}
            <span className="w-[4rem] shrink-0 text-xs text-gray-500 tabular-nums text-center">
              {floor.totalEquipment > 0 ? (
                <>
                  <span className="text-gray-700 font-medium">
                    {floor.activeEquipment}
                  </span>
                  /{floor.totalEquipment}
                </>
              ) : (
                <span className="text-gray-300">&mdash;</span>
              )}
            </span>

            {/* ---- Power ---- */}
            <span className="w-[4.5rem] shrink-0 text-xs text-gray-500 tabular-nums text-right">
              {floor.powerKw !== null ? (
                <>
                  {floor.powerKw < 10
                    ? floor.powerKw.toFixed(1)
                    : Math.round(floor.powerKw)}
                  <span className="text-gray-400 ml-0.5">kW</span>
                </>
              ) : (
                <span className="text-gray-300">&mdash;</span>
              )}
            </span>

            {/* ---- Alarm dots ---- */}
            <span className="w-[2rem] shrink-0 flex items-center justify-end gap-0.5">
              {floor.alarmCritical > 0 && (
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"
                  title={`Critical: ${floor.alarmCritical}`}
                />
              )}
              {floor.alarmWarning > 0 && (
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full bg-amber-400"
                  title={`Warning: ${floor.alarmWarning}`}
                />
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

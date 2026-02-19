"use client";

import type { FloorData } from "./floor-constants";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface ListViewProps {
  data: FloorData[];
  onSelectFloor: (floorKey: string) => void;
}

type SortKey =
  | "floor"
  | "status"
  | "temperature"
  | "humidity"
  | "co2"
  | "power"
  | "energy"
  | "equipment"
  | "alarm";

type SortDir = "asc" | "desc";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const STATUS_ORDER: Record<FloorData["status"], number> = {
  critical: 2,
  warning: 1,
  normal: 0,
};

/** Compare numbers with null-last semantics */
function compareNum(
  a: number | null,
  b: number | null,
  dir: SortDir,
): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1; // null always last
  if (b === null) return -1;
  return dir === "asc" ? a - b : b - a;
}

function sortData(
  data: FloorData[],
  key: SortKey,
  dir: SortDir,
): FloorData[] {
  const indexed = data.map((d, i) => ({ d, i }));

  indexed.sort((a, b) => {
    switch (key) {
      case "floor":
        return dir === "asc" ? a.i - b.i : b.i - a.i;
      case "status": {
        const sa = STATUS_ORDER[a.d.status];
        const sb = STATUS_ORDER[b.d.status];
        return dir === "asc" ? sa - sb : sb - sa;
      }
      case "temperature":
        return compareNum(a.d.temperature, b.d.temperature, dir);
      case "humidity":
        return compareNum(a.d.humidity, b.d.humidity, dir);
      case "co2":
        return compareNum(a.d.co2, b.d.co2, dir);
      case "power":
        return compareNum(a.d.powerKw, b.d.powerKw, dir);
      case "energy":
        return compareNum(a.d.energyKwh, b.d.energyKwh, dir);
      case "equipment":
        return dir === "asc"
          ? a.d.activeEquipment - b.d.activeEquipment
          : b.d.activeEquipment - a.d.activeEquipment;
      case "alarm": {
        const totalA =
          a.d.alarmCritical + a.d.alarmWarning + a.d.alarmInfo;
        const totalB =
          b.d.alarmCritical + b.d.alarmWarning + b.d.alarmInfo;
        return dir === "asc" ? totalA - totalB : totalB - totalA;
      }
      default:
        return 0;
    }
  });

  return indexed.map(({ d }) => d);
}

function fmt(value: number | null, decimals = 1): string {
  if (value === null || value === undefined) return "\u2014";
  return value.toFixed(decimals);
}

/** Temperature text color based on thresholds */
function tempTextClass(temp: number | null): string {
  if (temp === null) return "text-slate-500";
  if (temp > 28 || temp < 18) return "text-rose-400 font-medium";
  if (temp > 26 || temp < 20) return "text-amber-400 font-medium";
  return "";
}

/** CO2 text color based on thresholds */
function co2TextClass(co2: number | null): string {
  if (co2 === null) return "text-slate-500";
  if (co2 > 1000) return "text-rose-400 font-medium";
  if (co2 > 800) return "text-amber-400 font-medium";
  return "";
}

/** Status dot color */
function statusDotClass(status: FloorData["status"]): string {
  if (status === "critical") return "bg-rose-500";
  if (status === "warning") return "bg-amber-400";
  return "bg-emerald-500";
}

/** Status text color */
function statusTextClass(status: FloorData["status"]): string {
  if (status === "critical") return "text-rose-400 font-medium";
  if (status === "warning") return "text-amber-400 font-medium";
  return "text-emerald-400";
}

/** Alarm text color */
function alarmTextClass(floor: FloorData): string {
  if (floor.alarmCritical > 0) return "text-rose-400 font-medium";
  if (floor.alarmWarning > 0) return "text-amber-400 font-medium";
  return "";
}

/* ------------------------------------------------------------------ */
/* Column definitions                                                  */
/* ------------------------------------------------------------------ */

interface Column {
  key: SortKey;
  labelKey: string;
  align: "left" | "right" | "center";
}

const COLUMNS: Column[] = [
  { key: "floor", labelKey: "sortFloor", align: "left" },
  { key: "status", labelKey: "status", align: "center" },
  { key: "temperature", labelKey: "temperature", align: "right" },
  { key: "humidity", labelKey: "humidity", align: "right" },
  { key: "co2", labelKey: "co2Level", align: "right" },
  { key: "power", labelKey: "powerUsage", align: "right" },
  { key: "energy", labelKey: "cumulativeEnergy", align: "right" },
  { key: "equipment", labelKey: "equipment", align: "right" },
  { key: "alarm", labelKey: "alarms", align: "right" },
];

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function ListView({ data, onSelectFloor }: ListViewProps) {
  const t = useTranslations("floors");

  const [sortKey, setSortKey] = useState<SortKey>("floor");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const sorted = sortData(data, sortKey, sortDir);

  const alignClass = (align: Column["align"]): string => {
    if (align === "right") return "text-right";
    if (align === "center") return "text-center";
    return "text-left";
  };

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            {/* ---- Header ---- */}
            <thead className="sticky top-0 z-10 bg-white/[0.02] border-b border-white/10">
              <tr>
                {COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    className={`px-4 py-3 font-medium text-slate-400 select-none cursor-pointer hover:bg-white/5 transition-colors whitespace-nowrap ${alignClass(col.align)}`}
                    onClick={() => handleSort(col.key)}
                  >
                    <span className="inline-flex items-center gap-1">
                      {t(col.labelKey)}
                      {sortKey === col.key &&
                        (sortDir === "asc" ? (
                          <ChevronUp className="h-3.5 w-3.5 text-white" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5 text-white" />
                        ))}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>

            {/* ---- Body ---- */}
            <tbody className="divide-y divide-white/5">
              {sorted.length === 0 ? (
                <tr>
                  <td
                    colSpan={COLUMNS.length}
                    className="px-4 py-8 text-center text-slate-500"
                  >
                    {t("noData")}
                  </td>
                </tr>
              ) : (
                sorted.map((floor) => {
                  const totalAlarms =
                    floor.alarmCritical +
                    floor.alarmWarning +
                    floor.alarmInfo;

                  const statusLabel =
                    floor.status === "critical"
                      ? t("statusCritical")
                      : floor.status === "warning"
                        ? t("statusWarning")
                        : t("statusNormal");

                  return (
                    <tr
                      key={floor.key}
                      className="cursor-pointer hover:bg-white/5 transition-colors"
                      onClick={() => onSelectFloor(floor.key)}
                    >
                      {/* Floor */}
                      <td className="px-4 py-3 font-semibold text-white whitespace-nowrap">
                        {floor.label}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5">
                          <span
                            className={`inline-block h-2 w-2 rounded-full ${statusDotClass(floor.status)}`}
                          />
                          <span className={statusTextClass(floor.status)}>
                            {statusLabel}
                          </span>
                        </span>
                      </td>

                      {/* Temperature */}
                      <td
                        className={`px-4 py-3 text-right whitespace-nowrap ${tempTextClass(floor.temperature)}`}
                      >
                        {floor.temperature !== null
                          ? `${fmt(floor.temperature)}\u00B0C`
                          : "\u2014"}
                      </td>

                      {/* Humidity */}
                      <td
                        className={`px-4 py-3 text-right whitespace-nowrap ${floor.humidity === null ? "text-slate-500" : ""}`}
                      >
                        {floor.humidity !== null
                          ? `${fmt(floor.humidity, 0)}%`
                          : "\u2014"}
                      </td>

                      {/* CO2 */}
                      <td
                        className={`px-4 py-3 text-right whitespace-nowrap ${co2TextClass(floor.co2)}`}
                      >
                        {floor.co2 !== null
                          ? `${fmt(floor.co2, 0)} ppm`
                          : "\u2014"}
                      </td>

                      {/* Power */}
                      <td
                        className={`px-4 py-3 text-right whitespace-nowrap ${floor.powerKw === null ? "text-slate-500" : ""}`}
                      >
                        {floor.powerKw !== null
                          ? `${fmt(floor.powerKw)} kW`
                          : "\u2014"}
                      </td>

                      {/* Energy kWh */}
                      <td
                        className={`px-4 py-3 text-right whitespace-nowrap ${floor.energyKwh === null ? "text-slate-500" : ""}`}
                      >
                        {floor.energyKwh !== null
                          ? `${fmt(floor.energyKwh, 0)} kWh`
                          : "\u2014"}
                      </td>

                      {/* Equipment */}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <span className="text-slate-200">
                          {floor.activeEquipment}
                        </span>
                        <span className="text-slate-500">
                          {" / "}
                          {floor.totalEquipment}
                        </span>
                      </td>

                      {/* Alarms */}
                      <td
                        className={`px-4 py-3 text-right whitespace-nowrap ${alarmTextClass(floor)}`}
                      >
                        {totalAlarms > 0 ? totalAlarms : "\u2014"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

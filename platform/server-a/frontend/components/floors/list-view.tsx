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
  if (value === null || value === undefined) return "—";
  return value.toFixed(decimals);
}

/** Temperature text color based on thresholds */
function tempTextClass(temp: number | null): string {
  if (temp === null) return "text-gray-400";
  if (temp > 28 || temp < 18) return "text-red-600 font-medium";
  if (temp > 26 || temp < 20) return "text-amber-600 font-medium";
  return "";
}

/** CO2 text color based on thresholds */
function co2TextClass(co2: number | null): string {
  if (co2 === null) return "text-gray-400";
  if (co2 > 1000) return "text-red-600 font-medium";
  if (co2 > 800) return "text-amber-600 font-medium";
  return "";
}

/** Status dot color */
function statusDotClass(status: FloorData["status"]): string {
  if (status === "critical") return "bg-red-500";
  if (status === "warning") return "bg-amber-400";
  return "bg-emerald-500";
}

/** Status text color */
function statusTextClass(status: FloorData["status"]): string {
  if (status === "critical") return "text-red-600 font-medium";
  if (status === "warning") return "text-amber-600 font-medium";
  return "text-emerald-600";
}

/** Alarm text color */
function alarmTextClass(floor: FloorData): string {
  if (floor.alarmCritical > 0) return "text-red-600 font-medium";
  if (floor.alarmWarning > 0) return "text-amber-600 font-medium";
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
            <thead className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200">
              <tr>
                {COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    className={`px-4 py-3 font-medium text-gray-600 select-none cursor-pointer hover:bg-gray-100 transition-colors whitespace-nowrap ${alignClass(col.align)}`}
                    onClick={() => handleSort(col.key)}
                  >
                    <span className="inline-flex items-center gap-1">
                      {t(col.labelKey)}
                      {sortKey === col.key &&
                        (sortDir === "asc" ? (
                          <ChevronUp className="h-3.5 w-3.5 text-gray-900" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5 text-gray-900" />
                        ))}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>

            {/* ---- Body ---- */}
            <tbody className="divide-y divide-gray-100">
              {sorted.length === 0 ? (
                <tr>
                  <td
                    colSpan={COLUMNS.length}
                    className="px-4 py-8 text-center text-gray-400"
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
                      className="cursor-pointer hover:bg-gray-50 transition-colors"
                      onClick={() => onSelectFloor(floor.key)}
                    >
                      {/* Floor */}
                      <td className="px-4 py-3 font-semibold text-gray-900 whitespace-nowrap">
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
                          ? `${fmt(floor.temperature)}°C`
                          : "—"}
                      </td>

                      {/* Humidity */}
                      <td
                        className={`px-4 py-3 text-right whitespace-nowrap ${floor.humidity === null ? "text-gray-400" : ""}`}
                      >
                        {floor.humidity !== null
                          ? `${fmt(floor.humidity, 0)}%`
                          : "—"}
                      </td>

                      {/* CO2 */}
                      <td
                        className={`px-4 py-3 text-right whitespace-nowrap ${co2TextClass(floor.co2)}`}
                      >
                        {floor.co2 !== null
                          ? `${fmt(floor.co2, 0)} ppm`
                          : "—"}
                      </td>

                      {/* Power */}
                      <td
                        className={`px-4 py-3 text-right whitespace-nowrap ${floor.powerKw === null ? "text-gray-400" : ""}`}
                      >
                        {floor.powerKw !== null
                          ? `${fmt(floor.powerKw)} kW`
                          : "—"}
                      </td>

                      {/* Energy kWh */}
                      <td
                        className={`px-4 py-3 text-right whitespace-nowrap ${floor.energyKwh === null ? "text-gray-400" : ""}`}
                      >
                        {floor.energyKwh !== null
                          ? `${fmt(floor.energyKwh, 0)} kWh`
                          : "—"}
                      </td>

                      {/* Equipment */}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <span className="text-gray-700">
                          {floor.activeEquipment}
                        </span>
                        <span className="text-gray-400">
                          {" / "}
                          {floor.totalEquipment}
                        </span>
                      </td>

                      {/* Alarms */}
                      <td
                        className={`px-4 py-3 text-right whitespace-nowrap ${alarmTextClass(floor)}`}
                      >
                        {totalAlarms > 0 ? totalAlarms : "—"}
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

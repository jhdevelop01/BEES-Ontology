"use client";

import { useState } from "react";
import type { FloorData, FloorRoomData, FloorEquipmentData } from "./floor-constants";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTranslations } from "next-intl";
import {
  Thermometer,
  Droplets,
  Wind,
  Zap,
  Settings2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  DoorOpen,
  Cog,
  Battery,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface CardViewProps {
  data: FloorData[];
  onSelectFloor: (floorKey: string) => void;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function statusBorderClass(status: FloorData["status"]): string {
  if (status === "critical") return "border-l-4 border-l-red-400 bg-red-50/40";
  if (status === "warning") return "border-l-4 border-l-amber-300";
  return "";
}

function statusBadge(
  status: FloorData["status"],
  label: string,
) {
  if (status === "critical") {
    return <Badge variant="danger">{label}</Badge>;
  }
  if (status === "warning") {
    return <Badge variant="warning">{label}</Badge>;
  }
  return <Badge variant="success">{label}</Badge>;
}

function fmt(value: number | null, unit: string, decimals = 1): string {
  if (value === null || value === undefined) return "—";
  return `${value.toFixed(decimals)}${unit}`;
}

function tempTextClass(temp: number | null): string {
  if (temp === null) return "text-gray-400";
  if (temp > 28 || temp < 18) return "text-red-600 font-medium";
  if (temp > 26 || temp < 20) return "text-amber-600 font-medium";
  return "";
}

function co2TextClass(co2: number | null): string {
  if (co2 === null) return "text-gray-400";
  if (co2 > 1000) return "text-red-600 font-medium";
  if (co2 > 800) return "text-amber-600 font-medium";
  return "";
}

/* ------------------------------------------------------------------ */
/* Room Table                                                          */
/* ------------------------------------------------------------------ */

function RoomTable({ rooms, t }: { rooms: FloorRoomData[]; t: (key: string) => string }) {
  if (rooms.length === 0) {
    return <p className="text-xs text-gray-400 py-2">{t("noRooms")}</p>;
  }

  return (
    <>
      {/* Desktop table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-200 text-gray-500">
              <th className="text-left py-1.5 px-2 font-medium">{t("roomName")}</th>
              <th className="text-left py-1.5 px-2 font-medium">{t("spaceType")}</th>
              <th className="text-right py-1.5 px-2 font-medium">{t("area")}</th>
              <th className="text-right py-1.5 px-2 font-medium">{t("temperature")}</th>
              <th className="text-right py-1.5 px-2 font-medium">{t("humidity")}</th>
              <th className="text-right py-1.5 px-2 font-medium">{t("co2Level")}</th>
              <th className="text-right py-1.5 px-2 font-medium">{t("powerUsage")}</th>
              <th className="text-right py-1.5 px-2 font-medium">{t("cumulativeEnergy")}</th>
            </tr>
          </thead>
          <tbody>
            {rooms.map((room, idx) => (
              <tr key={room.id} className={idx % 2 === 0 ? "" : "bg-gray-50"}>
                <td className="py-1.5 px-2 font-medium text-gray-800">
                  {room.label || room.id}
                </td>
                <td className="py-1.5 px-2 text-gray-600">{room.spaceType || "—"}</td>
                <td className="py-1.5 px-2 text-right text-gray-600">
                  {room.area_m2 != null ? room.area_m2.toFixed(0) : "—"}
                </td>
                <td className={`py-1.5 px-2 text-right ${tempTextClass(room.temperature)}`}>
                  {fmt(room.temperature, "°C")}
                </td>
                <td className="py-1.5 px-2 text-right text-gray-600">
                  {fmt(room.humidity, "%", 0)}
                </td>
                <td className={`py-1.5 px-2 text-right ${co2TextClass(room.co2)}`}>
                  {fmt(room.co2, " ppm", 0)}
                </td>
                <td className="py-1.5 px-2 text-right text-gray-600">
                  {room.powerKw != null ? `${room.powerKw.toFixed(1)} kW` : "—"}
                </td>
                <td className="py-1.5 px-2 text-right text-gray-600">
                  {room.energyKwh != null ? `${room.energyKwh.toFixed(0)} kWh` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile list */}
      <div className="sm:hidden space-y-2">
        {rooms.map((room) => (
          <div key={room.id} className="bg-gray-50 rounded-lg p-2.5 text-xs">
            <p className="font-medium text-gray-800 mb-1">{room.label || room.id}</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-gray-600">
              {room.spaceType && <span>{room.spaceType}</span>}
              {room.area_m2 != null && <span>{room.area_m2.toFixed(0)} m²</span>}
              <span className={tempTextClass(room.temperature)}>{fmt(room.temperature, "°C")}</span>
              <span>{fmt(room.humidity, "%", 0)}</span>
              <span className={co2TextClass(room.co2)}>{fmt(room.co2, " ppm", 0)}</span>
              <span>{room.powerKw != null ? `${room.powerKw.toFixed(1)} kW` : "—"}</span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Equipment Table                                                     */
/* ------------------------------------------------------------------ */

function EquipmentTable({ equipment, t }: { equipment: FloorEquipmentData[]; t: (key: string) => string }) {
  if (equipment.length === 0) {
    return <p className="text-xs text-gray-400 py-2">{t("noEquipment")}</p>;
  }

  return (
    <>
      {/* Desktop table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-200 text-gray-500">
              <th className="text-left py-1.5 px-2 font-medium">{t("equipName")}</th>
              <th className="text-left py-1.5 px-2 font-medium">{t("equipPurpose")}</th>
              <th className="text-left py-1.5 px-2 font-medium">{t("equipLocation")}</th>
              <th className="text-center py-1.5 px-2 font-medium">{t("equipStatus")}</th>
            </tr>
          </thead>
          <tbody>
            {equipment.map((eq, idx) => (
              <tr key={eq.id} className={idx % 2 === 0 ? "" : "bg-gray-50"}>
                <td className="py-1.5 px-2 font-medium text-gray-800">
                  {eq.label || eq.name || eq.id}
                </td>
                <td className="py-1.5 px-2 text-gray-600">{eq.type}</td>
                <td className="py-1.5 px-2 text-gray-600">{eq.location || "—"}</td>
                <td className="py-1.5 px-2 text-center">
                  <span className="inline-flex items-center gap-1">
                    <span
                      className={`inline-block h-2 w-2 rounded-full ${
                        eq.is_active ? "bg-emerald-500" : "bg-red-400"
                      }`}
                    />
                    <span className={eq.is_active ? "text-emerald-700" : "text-red-600"}>
                      {eq.is_active ? t("running") : t("stopped")}
                    </span>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile list */}
      <div className="sm:hidden space-y-1.5">
        {equipment.map((eq) => (
          <div
            key={eq.id}
            className="flex items-center justify-between bg-gray-50 rounded-lg px-2.5 py-2 text-xs"
          >
            <div>
              <p className="font-medium text-gray-800">
                {eq.label || eq.name || eq.id}
              </p>
              <p className="text-gray-500">{eq.type}</p>
            </div>
            <span className="inline-flex items-center gap-1 shrink-0">
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  eq.is_active ? "bg-emerald-500" : "bg-red-400"
                }`}
              />
              <span className={eq.is_active ? "text-emerald-700" : "text-red-600"}>
                {eq.is_active ? t("running") : t("stopped")}
              </span>
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function CardView({ data, onSelectFloor }: CardViewProps) {
  const t = useTranslations("floors");
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const toggleExpand = (key: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedKey((prev) => (prev === key ? null : key));
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      {data.map((floor) => {
        const totalAlarms =
          floor.alarmCritical + floor.alarmWarning + floor.alarmInfo;
        const isExpanded = expandedKey === floor.key;

        const statusLabel =
          floor.status === "critical"
            ? t("statusCritical")
            : floor.status === "warning"
              ? t("statusWarning")
              : t("statusNormal");

        return (
          <Card
            key={floor.key}
            className={`cursor-pointer hover:shadow-md transition-shadow ${statusBorderClass(floor.status)} ${
              isExpanded ? "col-span-2 md:col-span-3 lg:col-span-4" : ""
            }`}
            onClick={() => onSelectFloor(floor.key)}
          >
            <CardContent className="p-3">
              {/* ---- Header: Floor label + Status badge + Expand toggle ---- */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold">{floor.label}</span>
                  {statusBadge(floor.status, statusLabel)}
                </div>
                <button
                  onClick={(e) => toggleExpand(floor.key, e)}
                  className="p-1 rounded hover:bg-gray-100 transition-colors"
                  title={isExpanded ? t("collapseDetails") : t("expandDetails")}
                >
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-gray-500" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-gray-500" />
                  )}
                </button>
              </div>

              {/* ---- Summary: Always visible ---- */}
              <div className="grid grid-cols-3 gap-1 text-xs mb-2">
                {/* Temperature */}
                <div className="flex items-center gap-1" title={t("temperature")}>
                  <Thermometer className="h-3.5 w-3.5 text-orange-500 shrink-0" />
                  <span className={floor.temperature === null ? "text-muted-foreground" : ""}>
                    {fmt(floor.temperature, "°C")}
                  </span>
                </div>

                {/* Humidity */}
                <div className="flex items-center gap-1" title={t("humidity")}>
                  <Droplets className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                  <span className={floor.humidity === null ? "text-muted-foreground" : ""}>
                    {fmt(floor.humidity, "%", 0)}
                  </span>
                </div>

                {/* CO2 */}
                <div className="flex items-center gap-1" title={t("co2Level")}>
                  <Wind className="h-3.5 w-3.5 text-teal-500 shrink-0" />
                  <span className={floor.co2 === null ? "text-muted-foreground" : ""}>
                    {fmt(floor.co2, " ppm", 0)}
                  </span>
                </div>
              </div>

              {/* ---- Power + Energy + Equipment + Alarms ---- */}
              <div className="space-y-1 text-xs">
                {/* Power */}
                <div className="flex items-center gap-1.5" title={t("powerUsage")}>
                  <Zap className="h-3.5 w-3.5 text-yellow-500 shrink-0" />
                  <span className={floor.powerKw === null ? "text-muted-foreground" : ""}>
                    {fmt(floor.powerKw, " kW")}
                  </span>
                </div>

                {/* Energy kWh */}
                <div className="flex items-center gap-1.5" title={t("cumulativeEnergy")}>
                  <Battery className="h-3.5 w-3.5 text-green-500 shrink-0" />
                  <span className={floor.energyKwh === null ? "text-muted-foreground" : ""}>
                    {floor.energyKwh != null ? `${floor.energyKwh.toFixed(0)} kWh` : "—"}
                  </span>
                </div>

                {/* Equipment */}
                <div className="flex items-center gap-1.5" title={t("equipment")}>
                  <Settings2 className="h-3.5 w-3.5 text-gray-500 shrink-0" />
                  <span>
                    {t("equipActive", {
                      active: floor.activeEquipment,
                      total: floor.totalEquipment,
                    })}
                  </span>
                </div>

                {/* Alarms */}
                <div className="flex items-center gap-1.5" title={t("alarms")}>
                  <AlertTriangle
                    className={`h-3.5 w-3.5 shrink-0 ${
                      floor.alarmCritical > 0
                        ? "text-red-500"
                        : floor.alarmWarning > 0
                          ? "text-amber-500"
                          : "text-gray-400"
                    }`}
                  />
                  {totalAlarms === 0 ? (
                    <span className="text-muted-foreground">{t("noAlarms")}</span>
                  ) : (
                    <span
                      className={
                        floor.alarmCritical > 0
                          ? "text-red-600 font-medium"
                          : "text-amber-600 font-medium"
                      }
                    >
                      {totalAlarms}
                    </span>
                  )}
                </div>

                {/* Rooms count */}
                {floor.rooms.length > 0 && (
                  <div className="flex items-center gap-1.5" title={t("roomSection")}>
                    <DoorOpen className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                    <span>{floor.rooms.length} {t("roomSection")}</span>
                  </div>
                )}
              </div>

              {/* ---- Compact Room List (always visible) ---- */}
              {floor.rooms.length > 0 && !isExpanded && (
                <div className="mt-2 pt-2 border-t border-gray-100">
                  <p className="text-[10px] font-semibold text-gray-500 mb-1 flex items-center gap-1">
                    <DoorOpen className="h-3 w-3 text-indigo-400" />
                    {t("roomSection")} ({floor.rooms.length})
                  </p>
                  <div className="space-y-0.5">
                    {floor.rooms.slice(0, 3).map((room) => (
                      <div key={room.id} className="flex items-center justify-between text-[10px]">
                        <span className="text-gray-600 truncate max-w-[60%]">
                          {room.label || room.id}
                        </span>
                        <span className="text-gray-400">
                          {room.temperature != null ? `${room.temperature.toFixed(1)}°C` : ""}
                          {room.humidity != null ? ` ${room.humidity.toFixed(0)}%` : ""}
                        </span>
                      </div>
                    ))}
                    {floor.rooms.length > 3 && (
                      <p className="text-[10px] text-gray-400">+{floor.rooms.length - 3}...</p>
                    )}
                  </div>
                </div>
              )}

              {/* ---- Expanded Details ---- */}
              {isExpanded && (
                <div className="mt-3 pt-3 border-t border-gray-200 space-y-4" onClick={(e) => e.stopPropagation()}>
                  {/* Room Section */}
                  <section>
                    <h4 className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                      <DoorOpen className="h-3.5 w-3.5 text-indigo-500" />
                      {t("roomSection")} ({floor.rooms.length})
                    </h4>
                    <RoomTable rooms={floor.rooms} t={t} />
                  </section>

                  {/* Equipment Section */}
                  <section>
                    <h4 className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                      <Cog className="h-3.5 w-3.5 text-gray-500" />
                      {t("equipmentSection")} ({floor.equipmentDetails.length})
                    </h4>
                    <EquipmentTable equipment={floor.equipmentDetails} t={t} />
                  </section>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

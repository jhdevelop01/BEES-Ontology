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
  if (status === "critical") return "border-l-4 border-l-rose-400 bg-rose-500/5";
  if (status === "warning") return "border-l-4 border-l-amber-400";
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
  if (value === null || value === undefined) return "\u2014";
  return `${value.toFixed(decimals)}${unit}`;
}

function tempTextClass(temp: number | null): string {
  if (temp === null) return "text-slate-500";
  if (temp > 28 || temp < 18) return "text-rose-400 font-medium";
  if (temp > 26 || temp < 20) return "text-amber-400 font-medium";
  return "";
}

function co2TextClass(co2: number | null): string {
  if (co2 === null) return "text-slate-500";
  if (co2 > 1000) return "text-rose-400 font-medium";
  if (co2 > 800) return "text-amber-400 font-medium";
  return "";
}

/* ------------------------------------------------------------------ */
/* Room Table                                                          */
/* ------------------------------------------------------------------ */

function RoomTable({ rooms, t }: { rooms: FloorRoomData[]; t: (key: string) => string }) {
  if (rooms.length === 0) {
    return <p className="text-xs text-slate-500 py-2">{t("noRooms")}</p>;
  }

  return (
    <>
      {/* Desktop table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-white/10 text-slate-400">
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
              <tr key={room.id} className={idx % 2 === 0 ? "" : "bg-white/[0.02]"}>
                <td className="py-1.5 px-2 font-medium text-slate-200">
                  {room.label || room.id}
                </td>
                <td className="py-1.5 px-2 text-slate-400">{room.spaceType || "\u2014"}</td>
                <td className="py-1.5 px-2 text-right text-slate-400">
                  {room.area_m2 != null ? room.area_m2.toFixed(0) : "\u2014"}
                </td>
                <td className={`py-1.5 px-2 text-right ${tempTextClass(room.temperature)}`}>
                  {fmt(room.temperature, "\u00B0C")}
                </td>
                <td className="py-1.5 px-2 text-right text-slate-400">
                  {fmt(room.humidity, "%", 0)}
                </td>
                <td className={`py-1.5 px-2 text-right ${co2TextClass(room.co2)}`}>
                  {fmt(room.co2, " ppm", 0)}
                </td>
                <td className="py-1.5 px-2 text-right text-slate-400">
                  {room.powerKw != null ? `${room.powerKw.toFixed(1)} kW` : "\u2014"}
                </td>
                <td className="py-1.5 px-2 text-right text-slate-400">
                  {room.energyKwh != null ? `${room.energyKwh.toFixed(0)} kWh` : "\u2014"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile list */}
      <div className="sm:hidden space-y-2">
        {rooms.map((room) => (
          <div key={room.id} className="bg-white/5 rounded-lg p-2.5 text-xs">
            <p className="font-medium text-slate-200 mb-1">{room.label || room.id}</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-slate-400">
              {room.spaceType && <span>{room.spaceType}</span>}
              {room.area_m2 != null && <span>{room.area_m2.toFixed(0)} m\u00B2</span>}
              <span className={tempTextClass(room.temperature)}>{fmt(room.temperature, "\u00B0C")}</span>
              <span>{fmt(room.humidity, "%", 0)}</span>
              <span className={co2TextClass(room.co2)}>{fmt(room.co2, " ppm", 0)}</span>
              <span>{room.powerKw != null ? `${room.powerKw.toFixed(1)} kW` : "\u2014"}</span>
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
    return <p className="text-xs text-slate-500 py-2">{t("noEquipment")}</p>;
  }

  return (
    <>
      {/* Desktop table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-white/10 text-slate-400">
              <th className="text-left py-1.5 px-2 font-medium">{t("equipName")}</th>
              <th className="text-left py-1.5 px-2 font-medium">{t("equipPurpose")}</th>
              <th className="text-left py-1.5 px-2 font-medium">{t("equipLocation")}</th>
              <th className="text-center py-1.5 px-2 font-medium">{t("equipStatus")}</th>
            </tr>
          </thead>
          <tbody>
            {equipment.map((eq, idx) => (
              <tr key={eq.id} className={idx % 2 === 0 ? "" : "bg-white/[0.02]"}>
                <td className="py-1.5 px-2 font-medium text-slate-200">
                  {eq.label || eq.name || eq.id}
                </td>
                <td className="py-1.5 px-2 text-slate-400">{eq.type}</td>
                <td className="py-1.5 px-2 text-slate-400">{eq.location || "\u2014"}</td>
                <td className="py-1.5 px-2 text-center">
                  <span className="inline-flex items-center gap-1">
                    <span
                      className={`inline-block h-2 w-2 rounded-full ${
                        eq.is_active ? "bg-emerald-500" : "bg-rose-400"
                      }`}
                    />
                    <span className={eq.is_active ? "text-emerald-400" : "text-rose-400"}>
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
            className="flex items-center justify-between bg-white/5 rounded-lg px-2.5 py-2 text-xs"
          >
            <div>
              <p className="font-medium text-slate-200">
                {eq.label || eq.name || eq.id}
              </p>
              <p className="text-slate-500">{eq.type}</p>
            </div>
            <span className="inline-flex items-center gap-1 shrink-0">
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  eq.is_active ? "bg-emerald-500" : "bg-rose-400"
                }`}
              />
              <span className={eq.is_active ? "text-emerald-400" : "text-rose-400"}>
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
            className={`cursor-pointer hover:shadow-glow-sm transition-shadow ${statusBorderClass(floor.status)} ${
              isExpanded ? "col-span-2 md:col-span-3 lg:col-span-4" : ""
            }`}
            onClick={() => onSelectFloor(floor.key)}
          >
            <CardContent className="p-3">
              {/* ---- Header: Floor label + Status badge + Expand toggle ---- */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold text-white">{floor.label}</span>
                  {statusBadge(floor.status, statusLabel)}
                </div>
                <button
                  onClick={(e) => toggleExpand(floor.key, e)}
                  className="p-1 rounded hover:bg-white/10 transition-colors"
                  title={isExpanded ? t("collapseDetails") : t("expandDetails")}
                >
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  )}
                </button>
              </div>

              {/* ---- Summary: Always visible ---- */}
              <div className="grid grid-cols-3 gap-1 text-xs mb-2">
                {/* Temperature */}
                <div className="flex items-center gap-1" title={t("temperature")}>
                  <Thermometer className="h-3.5 w-3.5 text-orange-500 shrink-0" />
                  <span className={floor.temperature === null ? "text-muted-foreground" : "text-slate-200"}>
                    {fmt(floor.temperature, "\u00B0C")}
                  </span>
                </div>

                {/* Humidity */}
                <div className="flex items-center gap-1" title={t("humidity")}>
                  <Droplets className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                  <span className={floor.humidity === null ? "text-muted-foreground" : "text-slate-200"}>
                    {fmt(floor.humidity, "%", 0)}
                  </span>
                </div>

                {/* CO2 */}
                <div className="flex items-center gap-1" title={t("co2Level")}>
                  <Wind className="h-3.5 w-3.5 text-teal-500 shrink-0" />
                  <span className={floor.co2 === null ? "text-muted-foreground" : "text-slate-200"}>
                    {fmt(floor.co2, " ppm", 0)}
                  </span>
                </div>
              </div>

              {/* ---- Power + Energy + Equipment + Alarms ---- */}
              <div className="space-y-1 text-xs">
                {/* Power */}
                <div className="flex items-center gap-1.5" title={t("powerUsage")}>
                  <Zap className="h-3.5 w-3.5 text-yellow-500 shrink-0" />
                  <span className={floor.powerKw === null ? "text-muted-foreground" : "text-slate-200"}>
                    {fmt(floor.powerKw, " kW")}
                  </span>
                </div>

                {/* Energy kWh */}
                <div className="flex items-center gap-1.5" title={t("cumulativeEnergy")}>
                  <Battery className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  <span className={floor.energyKwh === null ? "text-muted-foreground" : "text-slate-200"}>
                    {floor.energyKwh != null ? `${floor.energyKwh.toFixed(0)} kWh` : "\u2014"}
                  </span>
                </div>

                {/* Equipment */}
                <div className="flex items-center gap-1.5" title={t("equipment")}>
                  <Settings2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span className="text-slate-300">
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
                        ? "text-rose-500"
                        : floor.alarmWarning > 0
                          ? "text-amber-500"
                          : "text-slate-500"
                    }`}
                  />
                  {totalAlarms === 0 ? (
                    <span className="text-muted-foreground">{t("noAlarms")}</span>
                  ) : (
                    <span
                      className={
                        floor.alarmCritical > 0
                          ? "text-rose-400 font-medium"
                          : "text-amber-400 font-medium"
                      }
                    >
                      {totalAlarms}
                    </span>
                  )}
                </div>

                {/* Rooms count */}
                {floor.rooms.length > 0 && (
                  <div className="flex items-center gap-1.5" title={t("roomSection")}>
                    <DoorOpen className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                    <span className="text-slate-300">{floor.rooms.length} {t("roomSection")}</span>
                  </div>
                )}
              </div>

              {/* ---- Compact Room List (always visible) ---- */}
              {floor.rooms.length > 0 && !isExpanded && (
                <div className="mt-2 pt-2 border-t border-white/5">
                  <p className="text-[10px] font-semibold text-slate-400 mb-1 flex items-center gap-1">
                    <DoorOpen className="h-3 w-3 text-indigo-400" />
                    {t("roomSection")} ({floor.rooms.length})
                  </p>
                  <div className="space-y-0.5">
                    {floor.rooms.slice(0, 3).map((room) => (
                      <div key={room.id} className="flex items-center justify-between text-[10px]">
                        <span className="text-slate-400 truncate max-w-[60%]">
                          {room.label || room.id}
                        </span>
                        <span className="text-slate-500">
                          {room.temperature != null ? `${room.temperature.toFixed(1)}\u00B0C` : ""}
                          {room.humidity != null ? ` ${room.humidity.toFixed(0)}%` : ""}
                        </span>
                      </div>
                    ))}
                    {floor.rooms.length > 3 && (
                      <p className="text-[10px] text-slate-500">+{floor.rooms.length - 3}...</p>
                    )}
                  </div>
                </div>
              )}

              {/* ---- Expanded Details ---- */}
              {isExpanded && (
                <div className="mt-3 pt-3 border-t border-white/10 space-y-4" onClick={(e) => e.stopPropagation()}>
                  {/* Room Section */}
                  <section>
                    <h4 className="text-xs font-semibold text-slate-200 mb-2 flex items-center gap-1.5">
                      <DoorOpen className="h-3.5 w-3.5 text-indigo-400" />
                      {t("roomSection")} ({floor.rooms.length})
                    </h4>
                    <RoomTable rooms={floor.rooms} t={t} />
                  </section>

                  {/* Equipment Section */}
                  <section>
                    <h4 className="text-xs font-semibold text-slate-200 mb-2 flex items-center gap-1.5">
                      <Cog className="h-3.5 w-3.5 text-slate-400" />
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

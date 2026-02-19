"use client";

import React, { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Sheet } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import {
  Thermometer,
  Droplets,
  Wind,
  Zap,
  Settings2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  DoorOpen,
} from "lucide-react";
import type { FloorData } from "./floor-constants";
import { FLOORS, ssePointPrefix } from "./floor-constants";
import type { EquipmentListItem, ActiveAlarm } from "@/lib/api";
import type { SSEPointEvent, SSEDeviceEvent } from "@/lib/sse";

/* ------------------------------------------------------------------ */
/* Props                                                               */
/* ------------------------------------------------------------------ */

interface FloorDetailPanelProps {
  floor: FloorData | null;
  equipmentList: EquipmentListItem[];
  points: Record<string, SSEPointEvent>;
  devices: Record<string, SSEDeviceEvent>;
  activeAlarms: ActiveAlarm[];
  open: boolean;
  onClose: () => void;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function statusBadgeVariant(status: FloorData["status"]): "success" | "warning" | "danger" {
  if (status === "critical") return "danger";
  if (status === "warning") return "warning";
  return "success";
}

function floorTypeKey(type: FloorData["type"]): string {
  switch (type) {
    case "office": return "typeOffice";
    case "mechanical": return "typeMechanical";
    case "parking": return "typeParking";
    case "podium": return "typePodium";
    case "lobby": return "typeLobby";
    default: return "typeOffice";
  }
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function FloorDetailPanel({
  floor,
  equipmentList,
  points,
  devices,
  activeAlarms,
  open,
  onClose,
}: FloorDetailPanelProps) {
  const t = useTranslations("floors");

  // 현재 층 장비 목록
  const floorEquipment = useMemo(() => {
    if (!floor) return [];
    return equipmentList.filter((eq) => {
      if (!eq.location) return false;
      return eq.location === floor.key || eq.location.startsWith(floor.key + "_");
    });
  }, [floor, equipmentList]);

  // 장비별 상세 센서 데이터
  const equipmentDetails = useMemo(() => {
    return floorEquipment.map((eq) => {
      const prefix = ssePointPrefix(eq.id);
      const dev = devices[eq.id];
      const isActive = dev?.is_active ?? null;

      // 해당 장비의 센서 포인트 수집
      const sensorPoints: { key: string; value: number; unit: string }[] = [];
      if (prefix) {
        for (const [pointId, pt] of Object.entries(points)) {
          if (!pointId.startsWith(prefix)) continue;
          if (pt.value === null) continue;
          // 포인트 이름에서 접미사 추출
          const suffix = pointId.slice(prefix.length);
          sensorPoints.push({
            key: suffix,
            value: Number(pt.value),
            unit: pt.unit || "",
          });
        }
      }

      return { equipment: eq, isActive, sensorPoints };
    });
  }, [floorEquipment, points, devices]);

  // 층별 활성 알람
  const floorAlarms = useMemo(() => {
    if (!floor) return [];
    const floorEquipIds = new Set(floorEquipment.map((eq) => eq.id));
    const floorEquipNames = new Set(
      floorEquipment.map((eq) =>
        eq.id.startsWith("bldg:") ? eq.id.slice(5) : eq.id
      )
    );

    return activeAlarms.filter((alarm) => {
      const eqName = alarm.equipment || "";
      const eqId = eqName.startsWith("bldg:") ? eqName : `bldg:${eqName}`;
      const bareName = eqName.startsWith("bldg:") ? eqName.slice(5) : eqName;
      return floorEquipIds.has(eqId) || floorEquipNames.has(bareName);
    });
  }, [floor, floorEquipment, activeAlarms]);

  if (!floor) return null;

  const statusLabel =
    floor.status === "critical"
      ? t("statusCritical")
      : floor.status === "warning"
        ? t("statusWarning")
        : t("statusNormal");

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t("floorDetail", { floor: floor.label })}
    >
      <div className="p-4 space-y-5">
        {/* ---- 층 정보 헤더 ---- */}
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm text-gray-500">{t("floorType")}</span>
            <p className="text-sm font-medium">{t(floorTypeKey(floor.type))}</p>
          </div>
          <Badge variant={statusBadgeVariant(floor.status)}>
            {statusLabel}
          </Badge>
        </div>

        {/* ---- 환경 센서 ---- */}
        <section>
          <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-1.5">
            <Thermometer className="h-4 w-4 text-orange-500" />
            {t("environment")}
          </h3>
          <div className="grid grid-cols-3 gap-3">
            {/* 온도 */}
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500 mb-1">{t("temperature")}</p>
              <p className="text-lg font-bold text-gray-900">
                {floor.temperature !== null
                  ? `${floor.temperature.toFixed(1)}°C`
                  : "—"}
              </p>
              {floor.temperature !== null && (
                <p className={`text-xs mt-0.5 ${
                  floor.temperature > 26 || floor.temperature < 20
                    ? "text-amber-600"
                    : "text-emerald-600"
                }`}>
                  {floor.temperature > 28 || floor.temperature < 18
                    ? t("tempHigh")
                    : floor.temperature > 26 || floor.temperature < 20
                      ? t("tempHigh")
                      : t("tempNormal")}
                </p>
              )}
            </div>

            {/* 습도 */}
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500 mb-1">{t("humidity")}</p>
              <p className="text-lg font-bold text-gray-900">
                {floor.humidity !== null
                  ? `${floor.humidity.toFixed(0)}%`
                  : "—"}
              </p>
            </div>

            {/* CO2 */}
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500 mb-1">{t("co2Level")}</p>
              <p className="text-lg font-bold text-gray-900">
                {floor.co2 !== null ? `${floor.co2.toFixed(0)}` : "—"}
              </p>
              {floor.co2 !== null && (
                <p className={`text-xs mt-0.5 ${
                  floor.co2 > 1000
                    ? "text-red-600"
                    : floor.co2 > 800
                      ? "text-amber-600"
                      : "text-emerald-600"
                }`}>
                  {floor.co2 > 1000
                    ? t("co2Poor")
                    : floor.co2 > 800
                      ? t("co2Caution")
                      : t("co2Good")}
                </p>
              )}
            </div>
          </div>
        </section>

        {/* ---- 에너지 ---- */}
        <section>
          <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-1.5">
            <Zap className="h-4 w-4 text-yellow-500" />
            {t("energy")}
          </h3>
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">{t("powerUsage")}</span>
              <span className="text-lg font-bold text-gray-900">
                {floor.powerKw !== null
                  ? `${floor.powerKw.toFixed(1)} kW`
                  : "—"}
              </span>
            </div>
            {floor.energyKwh != null && (
              <div className="flex items-center justify-between mt-2">
                <span className="text-sm text-gray-600">{t("cumulativeEnergy")}</span>
                <span className="text-lg font-bold text-gray-900">
                  {floor.energyKwh.toFixed(0)} kWh
                </span>
              </div>
            )}
          </div>
        </section>

        {/* ---- 공간 현황 ---- */}
        <section>
          <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-1.5">
            <DoorOpen className="h-4 w-4 text-indigo-500" />
            {t("roomSection")} ({floor.rooms.length})
          </h3>
          {floor.rooms.length === 0 ? (
            <p className="text-sm text-gray-400 py-2">{t("noRooms")}</p>
          ) : (
            <div className="space-y-1.5">
              {floor.rooms.map((room) => (
                <div
                  key={room.id}
                  className="bg-gray-50 rounded-lg px-3 py-2"
                >
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-medium text-gray-800">
                      {room.label || room.id}
                    </p>
                    {room.spaceType && (
                      <span className="text-[10px] text-gray-400">{room.spaceType}</span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-[11px] text-gray-600">
                    <span>
                      {room.temperature != null ? `${room.temperature.toFixed(1)}°C` : "—"}
                    </span>
                    <span>
                      {room.humidity != null ? `${room.humidity.toFixed(0)}%` : "—"}
                    </span>
                    <span>
                      {room.co2 != null ? `${room.co2.toFixed(0)} ppm` : "—"}
                    </span>
                  </div>
                  {(room.area_m2 != null || room.powerKw != null) && (
                    <div className="flex gap-3 text-[10px] text-gray-400 mt-1">
                      {room.area_m2 != null && <span>{room.area_m2.toFixed(0)} m²</span>}
                      {room.powerKw != null && <span>{room.powerKw.toFixed(1)} kW</span>}
                      {room.energyKwh != null && <span>{room.energyKwh.toFixed(0)} kWh</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ---- 장비 목록 ---- */}
        <section>
          <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-1.5">
            <Settings2 className="h-4 w-4 text-gray-500" />
            {t("equipmentList")} ({floorEquipment.length})
          </h3>
          {floorEquipment.length === 0 ? (
            <p className="text-sm text-gray-400 py-2">{t("noData")}</p>
          ) : (
            <div className="space-y-1.5">
              {equipmentDetails.map(({ equipment, isActive, sensorPoints }) => (
                <div
                  key={equipment.id}
                  className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    {isActive !== null ? (
                      isActive ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                      ) : (
                        <XCircle className="h-4 w-4 text-gray-300 shrink-0" />
                      )
                    ) : (
                      <div className="h-4 w-4 rounded-full bg-gray-200 shrink-0" />
                    )}
                    <div>
                      <p className="text-xs font-medium text-gray-800">
                        {equipment.label || equipment.name || equipment.id.replace("bldg:", "")}
                      </p>
                      {sensorPoints.length > 0 && (
                        <p className="text-[10px] text-gray-400">
                          {sensorPoints
                            .slice(0, 3)
                            .map((s) => `${s.key}: ${s.value.toFixed(1)}${s.unit}`)
                            .join(" | ")}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className="text-[10px] text-gray-400 shrink-0">
                    {isActive !== null
                      ? isActive
                        ? t("running")
                        : t("stopped")
                      : "—"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ---- 활성 알람 ---- */}
        <section>
          <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            {t("activeAlarms")} ({floorAlarms.length})
          </h3>
          {floorAlarms.length === 0 ? (
            <p className="text-sm text-gray-400 py-2">{t("noAlarms")}</p>
          ) : (
            <div className="space-y-1.5">
              {floorAlarms.map((alarm, idx) => (
                <div
                  key={idx}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs ${
                    alarm.severity === "critical"
                      ? "bg-red-50 text-red-800"
                      : alarm.severity === "warning"
                        ? "bg-amber-50 text-amber-800"
                        : "bg-blue-50 text-blue-800"
                  }`}
                >
                  <span
                    className={`inline-block h-2 w-2 rounded-full shrink-0 ${
                      alarm.severity === "critical"
                        ? "bg-red-500"
                        : alarm.severity === "warning"
                          ? "bg-amber-400"
                          : "bg-blue-400"
                    }`}
                  />
                  <span className="font-medium">{alarm.severity}</span>
                  <span className="truncate">
                    {alarm.equipment} — {alarm.type}
                  </span>
                  {alarm.value !== undefined && alarm.value !== null && (
                    <span className="ml-auto shrink-0 tabular-nums">
                      {alarm.value.toFixed(1)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </Sheet>
  );
}

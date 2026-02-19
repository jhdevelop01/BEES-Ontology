"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Header } from "@/components/layout/header";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { useSSE } from "@/lib/sse";
import {
  sendControlCommand,
  getDeviceStatus,
  startSimulation,
  stopSimulation,
  getSimulationStatusFromBackend,
  type DeviceStatus,
} from "@/lib/api";
import {
  Power,
  PowerOff,
  Loader2,
  Send,
  PlayCircle,
  StopCircle,
  Activity,
  Snowflake,
  Flame,
  Wind,
  Fan,
  Droplets,
  Gauge,
  Zap,
  BatteryCharging,
  ToggleLeft,
  Sun,
  ArrowUpDown,
  ArrowLeftRight,
  SlidersHorizontal,
  Cpu,
  Thermometer,
  Box,
  type LucideIcon,
} from "lucide-react";
import { getDisplayName, localizeType, formatLocation } from "@/lib/utils";

/* ── Equipment Icon Mapping ── */

const EQUIP_ICON_RULES: { match: RegExp; icon: LucideIcon }[] = [
  { match: /chiller/i, icon: Snowflake },
  { match: /boiler/i, icon: Flame },
  { match: /ahu|doas|air_handling/i, icon: Wind },
  { match: /fcu|fan_coil/i, icon: Fan },
  { match: /vav/i, icon: SlidersHorizontal },
  { match: /cooling_tower/i, icon: Droplets },
  { match: /heat_exchanger/i, icon: ArrowLeftRight },
  { match: /pump/i, icon: Gauge },
  { match: /fan/i, icon: Fan },
  { match: /transformer/i, icon: Zap },
  { match: /ups/i, icon: BatteryCharging },
  { match: /switchgear|distribution/i, icon: ToggleLeft },
  { match: /generator/i, icon: Activity },
  { match: /solar|pv/i, icon: Sun },
  { match: /elevator/i, icon: ArrowUpDown },
  { match: /cc_panel/i, icon: Cpu },
  { match: /meter/i, icon: Gauge },
  { match: /damper|valve/i, icon: SlidersHorizontal },
  { match: /sensor|thermometer|temp/i, icon: Thermometer },
];

function getEquipIcon(device: DeviceStatus): LucideIcon {
  const combined = `${device.device_id} ${device.type || ""} ${device.category || ""}`.toLowerCase();
  for (const rule of EQUIP_ICON_RULES) {
    if (rule.match.test(combined)) return rule.icon;
  }
  return Box;
}

/* ── System Color Detection ── */

function getSystemColor(device: DeviceStatus): string {
  const combined = `${device.device_id} ${device.type || ""} ${device.category || ""}`.toLowerCase();
  if (/chw|chill|chilled/.test(combined)) return "rgb(34,211,238)";
  if (/\bhw\b|hot_water|boiler|heating/.test(combined)) return "rgb(251,113,133)";
  if (/\bcw\b|cooling_tower|condenser/.test(combined)) return "rgb(129,140,248)";
  if (/transformer|ups|switchgear|generator|solar|pv|panel|power|elec/.test(combined)) return "rgb(251,191,36)";
  if (/ahu|doas|fcu|fan|vav|air|damper/.test(combined)) return "rgb(148,163,184)";
  return "rgb(34,211,238)";
}

/* ── 3D Circular Icon Component ── */

function EquipIcon3D({
  device,
  systemColor,
  size = 72,
}: {
  device: DeviceStatus;
  systemColor: string;
  size?: number;
}) {
  const Icon = getEquipIcon(device);
  const isActive = device.is_active;
  const iconSize = Math.round(size * 0.36);

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      {/* Outer rotating conic-gradient ring */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `conic-gradient(from 0deg, transparent 0%, ${systemColor}50 15%, transparent 30%, ${systemColor}30 50%, transparent 65%, ${systemColor}40 80%, transparent 100%)`,
          animation: isActive ? "ctrl-icon-spin 6s linear infinite" : "none",
          opacity: isActive ? 1 : 0.3,
        }}
      />
      {/* Dark spacer ring */}
      <div
        className="absolute rounded-full"
        style={{ inset: 3, background: "rgba(8,12,24,0.95)" }}
      />
      {/* Middle ring border */}
      <div
        className="absolute rounded-full"
        style={{
          inset: 5,
          border: `1.5px solid ${systemColor}35`,
          background: "transparent",
        }}
      />
      {/* Inner 3D radial gradient circle */}
      <div
        className="absolute rounded-full"
        style={{
          inset: 9,
          background: `radial-gradient(circle at 35% 30%, ${systemColor}18, rgba(8,12,24,0.95) 70%)`,
          border: `1px solid ${systemColor}20`,
          boxShadow: isActive
            ? `0 0 24px ${systemColor}35, inset 0 1px 1px ${systemColor}15, inset 0 -4px 8px rgba(0,0,0,0.4)`
            : `inset 0 1px 1px ${systemColor}08, inset 0 -4px 8px rgba(0,0,0,0.3)`,
        }}
      />
      {/* Top highlight arc (3D glossy) */}
      <div
        className="absolute rounded-full"
        style={{
          inset: 11,
          background: `linear-gradient(160deg, ${systemColor}12 0%, transparent 45%)`,
          pointerEvents: "none",
        }}
      />
      {/* Indicator dots (active only) */}
      {isActive && (
        <>
          <div
            className="absolute rounded-full"
            style={{
              width: 4, height: 4, top: 5, right: 10,
              background: systemColor,
              boxShadow: `0 0 6px ${systemColor}`,
            }}
          />
          <div
            className="absolute rounded-full"
            style={{
              width: 3, height: 3, bottom: 7, left: 12,
              background: systemColor,
              boxShadow: `0 0 4px ${systemColor}`,
              opacity: 0.6,
            }}
          />
        </>
      )}
      {/* Icon */}
      <Icon
        size={iconSize}
        strokeWidth={1.5}
        style={{
          color: systemColor,
          filter: isActive
            ? `drop-shadow(0 0 8px ${systemColor}90) drop-shadow(0 0 3px ${systemColor}60)`
            : `drop-shadow(0 0 3px ${systemColor}40)`,
          position: "relative",
          zIndex: 1,
        }}
      />
    </div>
  );
}

/* ── 3D Control Button Component ── */

function ControlButton3D({
  onClick,
  disabled,
  loading,
  variant,
  children,
  fullWidth,
}: {
  onClick: () => void;
  disabled: boolean;
  loading?: boolean;
  variant: "start" | "stop" | "startLg" | "stopLg";
  children: React.ReactNode;
  fullWidth?: boolean;
}) {
  const colorMap = {
    start: { bg: "rgba(52,211,153,0.12)", border: "rgba(52,211,153,0.3)", glow: "rgba(52,211,153,0.4)", text: "rgb(52,211,153)" },
    startLg: { bg: "rgba(52,211,153,0.15)", border: "rgba(52,211,153,0.35)", glow: "rgba(52,211,153,0.5)", text: "rgb(52,211,153)" },
    stop: { bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.3)", glow: "rgba(239,68,68,0.4)", text: "rgb(239,68,68)" },
    stopLg: { bg: "rgba(239,68,68,0.15)", border: "rgba(239,68,68,0.35)", glow: "rgba(239,68,68,0.5)", text: "rgb(239,68,68)" },
  };
  const c = colorMap[variant];
  const isLg = variant === "startLg" || variant === "stopLg";

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        relative overflow-hidden rounded-lg font-medium transition-all duration-300
        disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none
        ${isLg ? "px-6 py-3 text-sm min-w-[140px]" : "px-4 py-2.5 text-sm"}
        ${fullWidth ? "flex-1" : ""}
      `}
      style={{
        background: disabled ? "rgba(255,255,255,0.03)" : c.bg,
        border: `1px solid ${disabled ? "rgba(255,255,255,0.06)" : c.border}`,
        color: disabled ? "rgba(255,255,255,0.3)" : c.text,
        boxShadow: disabled
          ? "inset 0 1px 2px rgba(0,0,0,0.3)"
          : `0 0 15px ${c.glow}, inset 0 1px 1px rgba(255,255,255,0.05), inset 0 -2px 4px rgba(0,0,0,0.2)`,
      }}
    >
      <span className="relative z-10 flex items-center justify-center gap-2">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : children}
      </span>
    </button>
  );
}

/**
 * 제어 페이지 — 3D Sci-Fi 리얼리티 디자인
 * 전체 시뮬레이션 가동/정지 + 개별 장비 ON/OFF 토글
 */
export default function ControlPage() {
  const { devices, connected } = useSSE();
  const { addToast } = useToast();
  const t = useTranslations("control");
  const locale = useLocale();
  const [deviceList, setDeviceList] = useState<DeviceStatus[]>([]);
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [simStatus, setSimStatus] = useState<string>("unknown");
  const [simLoading, setSimLoading] = useState(false);
  const [commandHistory, setCommandHistory] = useState<
    Array<{
      id: string;
      deviceId: string;
      command: string;
      success: boolean;
      message: string;
      timestamp: Date;
    }>
  >([]);

  // 시뮬레이션 상태 폴링
  const fetchSimStatus = useCallback(async () => {
    try {
      const data = await getSimulationStatusFromBackend();
      setSimStatus((data.status as string) || "unknown");
    } catch {
      setSimStatus("disconnected");
    }
  }, []);

  // 초기 장비 상태 + 시뮬레이션 상태 로딩
  useEffect(() => {
    const fetchDevices = async () => {
      try {
        const data = await getDeviceStatus();
        setDeviceList(data.devices);
      } catch {
        setDeviceList([]);
      }
    };
    fetchDevices();
    fetchSimStatus();
    const interval = setInterval(fetchSimStatus, 10000);
    return () => clearInterval(interval);
  }, [fetchSimStatus]);

  // MQTT 실시간 업데이트 반영
  useEffect(() => {
    if (Object.keys(devices).length > 0) {
      setDeviceList((prev) =>
        prev.map((d) => {
          const mqtt = devices[d.device_id];
          if (mqtt) {
            return {
              ...d,
              is_active: mqtt.is_active,
              mode: mqtt.mode,
              ts: mqtt.ts,
            };
          }
          return d;
        })
      );
    }
  }, [devices]);

  // 전체 시뮬레이션 시작
  const handleStartAll = async () => {
    setSimLoading(true);
    try {
      const result = await startSimulation();
      addToast({
        title: t("startAllSuccess"),
        description: result.message,
        variant: "success",
      });
      setSimStatus("running");
      setDeviceList(prev => prev.map(d => ({ ...d, is_active: true, mode: "auto" })));
      setCommandHistory((prev) => [{
        id: Math.random().toString(36).substring(7),
        deviceId: "ALL",
        command: "START_ALL",
        success: true,
        message: result.message,
        timestamp: new Date(),
      }, ...prev.slice(0, 9)]);
    } catch (error) {
      addToast({
        title: t("commandError"),
        description: error instanceof Error ? error.message : t("unknownError"),
        variant: "error",
      });
    } finally {
      setSimLoading(false);
    }
  };

  // 전체 시뮬레이션 정지
  const handleStopAll = async () => {
    setSimLoading(true);
    try {
      const result = await stopSimulation();
      addToast({
        title: t("stopAllSuccess"),
        description: result.message,
        variant: "success",
      });
      setSimStatus("stopped");
      setDeviceList(prev => prev.map(d => ({ ...d, is_active: false, mode: "standby" })));
      setCommandHistory((prev) => [{
        id: Math.random().toString(36).substring(7),
        deviceId: "ALL",
        command: "STOP_ALL",
        success: true,
        message: result.message,
        timestamp: new Date(),
      }, ...prev.slice(0, 9)]);
    } catch (error) {
      addToast({
        title: t("commandError"),
        description: error instanceof Error ? error.message : t("unknownError"),
        variant: "error",
      });
    } finally {
      setSimLoading(false);
    }
  };

  // 개별 제어 명령 전송
  const handleCommand = async (deviceId: string, command: string) => {
    setLoading((prev) => ({ ...prev, [deviceId]: true }));

    const safetyTimer = setTimeout(() => {
      setLoading((prev) => ({ ...prev, [deviceId]: false }));
    }, 15000);

    try {
      const result = await sendControlCommand({
        deviceId: deviceId.startsWith("bldg:") ? deviceId : `bldg:${deviceId}`,
        command,
      });

      const entry = {
        id: Math.random().toString(36).substring(7),
        deviceId,
        command,
        success: result.success,
        message: result.message,
        timestamp: new Date(),
      };
      setCommandHistory((prev) => [entry, ...prev.slice(0, 9)]);

      addToast({
        title: result.success ? t("commandSuccess") : t("commandFailed"),
        description: result.message,
        variant: result.success ? "success" : "error",
      });

      if (result.success) {
        setDeviceList((prev) =>
          prev.map((d) =>
            d.device_id === deviceId
              ? { ...d, is_active: command === "ON", mode: command === "ON" ? "auto" : "standby" }
              : d
          )
        );
      }
    } catch (error) {
      addToast({
        title: t("commandError"),
        description: error instanceof Error ? error.message : t("unknownError"),
        variant: "error",
      });
    } finally {
      clearTimeout(safetyTimer);
      setLoading((prev) => ({ ...prev, [deviceId]: false }));
    }
  };

  const activeCount = deviceList.filter(d => d.is_active).length;
  const allActive = deviceList.length > 0 && activeCount === deviceList.length;
  const noneActive = activeCount === 0;
  const activeRatio = deviceList.length > 0 ? activeCount / deviceList.length : 0;

  return (
    <div className="min-h-screen">
      <Header
        title={t("title")}
        description={`${t("description")} — ${deviceList.length}${locale === "ko" ? "대" : " devices"}`}
        connected={connected}
      />

      <div className="p-3 md:p-6 space-y-6">
        {/* ── 시뮬레이션 제어 패널 (3D Glassmorphism) ── */}
        <div className="ctrl-sim-panel p-6">
          <div className="relative flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            {/* Left: Icon + Info */}
            <div className="flex items-center gap-5">
              {/* 3D Activity Icon */}
              <div className="relative flex items-center justify-center" style={{ width: 64, height: 64 }}>
                <div
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: activeCount > 0
                      ? "conic-gradient(from 0deg, transparent 0%, rgba(52,211,153,0.5) 15%, transparent 30%, rgba(52,211,153,0.3) 50%, transparent 65%, rgba(52,211,153,0.4) 80%, transparent 100%)"
                      : "conic-gradient(from 0deg, transparent 0%, rgba(148,163,184,0.3) 15%, transparent 30%, rgba(148,163,184,0.2) 50%, transparent 65%, rgba(148,163,184,0.25) 80%, transparent 100%)",
                    animation: activeCount > 0 ? "ctrl-icon-spin 6s linear infinite" : "none",
                  }}
                />
                <div className="absolute rounded-full" style={{ inset: 3, background: "rgba(8,12,24,0.95)" }} />
                <div
                  className="absolute rounded-full"
                  style={{
                    inset: 5,
                    border: activeCount > 0
                      ? "1.5px solid rgba(52,211,153,0.25)"
                      : "1.5px solid rgba(148,163,184,0.15)",
                    background: "transparent",
                  }}
                />
                <div
                  className="absolute rounded-full"
                  style={{
                    inset: 8,
                    background: activeCount > 0
                      ? "radial-gradient(circle at 35% 30%, rgba(52,211,153,0.1), rgba(8,12,24,0.95) 70%)"
                      : "radial-gradient(circle at 35% 30%, rgba(148,163,184,0.05), rgba(8,12,24,0.95) 70%)",
                    boxShadow: activeCount > 0
                      ? "0 0 20px rgba(52,211,153,0.25), inset 0 1px 1px rgba(52,211,153,0.1)"
                      : "inset 0 -3px 6px rgba(0,0,0,0.3)",
                  }}
                />
                <Activity
                  size={24}
                  style={{
                    color: activeCount > 0 ? "rgb(52,211,153)" : "rgb(148,163,184)",
                    filter: activeCount > 0
                      ? "drop-shadow(0 0 8px rgba(52,211,153,0.7))"
                      : "none",
                    position: "relative",
                    zIndex: 1,
                  }}
                />
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white">{t("simulationControl")}</h3>
                <p className="text-sm text-slate-400 mt-0.5">{t("simulationDesc")}</p>
                <div className="flex items-center gap-3 mt-2">
                  <Badge
                    variant={activeCount > 0 ? "success" : simStatus === "disconnected" ? "danger" : "secondary"}
                  >
                    {activeCount > 0 ? t("simRunning") : simStatus === "disconnected" ? t("simDisconnected") : t("simStopped")}
                  </Badge>
                  <span className="text-sm font-mono text-slate-500">
                    {activeCount}/{deviceList.length}
                  </span>
                </div>
                {/* Active ratio progress bar */}
                <div className="mt-3 w-64">
                  <div className="w-full h-[6px] bg-white/[0.06] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${Math.max(activeRatio * 100, 1)}%`,
                        background: activeRatio > 0.8
                          ? "linear-gradient(90deg, rgb(52,211,153), rgb(34,211,238))"
                          : activeRatio > 0.3
                          ? "linear-gradient(90deg, rgb(251,191,36), rgb(245,158,11))"
                          : "linear-gradient(90deg, rgb(251,113,133), rgb(239,68,68))",
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Start/Stop Buttons */}
            <div className="flex gap-3">
              <ControlButton3D
                variant="startLg"
                disabled={simLoading || allActive}
                loading={simLoading && !allActive}
                onClick={handleStartAll}
              >
                <PlayCircle className="h-4 w-4" />
                {t("startAll")}
              </ControlButton3D>
              <ControlButton3D
                variant="stopLg"
                disabled={simLoading || noneActive}
                loading={simLoading && !noneActive}
                onClick={handleStopAll}
              >
                <StopCircle className="h-4 w-4" />
                {t("stopAll")}
              </ControlButton3D>
            </div>
          </div>
        </div>

        {/* ── 장비 제어 카드 그리드 (3D Glassmorphism) ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
          {deviceList.map((device) => {
            const isLoading = loading[device.device_id];
            const isActive = device.is_active;
            const systemColor = getSystemColor(device);

            return (
              <div
                key={device.device_id}
                className="ctrl-card-3d relative overflow-hidden"
                style={{
                  borderLeft: `4px solid ${systemColor}`,
                  boxShadow: isActive
                    ? `0 0 20px ${systemColor}15, inset 0 1px 0 rgba(255,255,255,0.04)`
                    : "inset 0 1px 0 rgba(255,255,255,0.03)",
                }}
              >
                {/* Top glow bar */}
                <div
                  className="absolute top-0 left-0 right-0 h-[2px]"
                  style={{
                    background: isActive
                      ? `linear-gradient(90deg, ${systemColor}80, ${systemColor}20, transparent)`
                      : "rgba(255,255,255,0.04)",
                  }}
                />

                <div className="p-4">
                  {/* Row 1: Icon + Name + Status */}
                  <div className="flex items-center gap-4">
                    {/* 3D Circular Icon */}
                    <EquipIcon3D device={device} systemColor={systemColor} size={64} />

                    {/* Name & Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-base font-semibold text-white truncate leading-tight">
                          {getDisplayName(locale, device.label, device.device_id)}
                        </span>
                        {/* Status neon dot */}
                        <div
                          className={`w-3 h-3 rounded-full flex-shrink-0 ${isActive ? "ctrl-status-dot" : ""}`}
                          style={{
                            background: isActive ? "rgb(52,211,153)" : "rgb(100,116,139)",
                            boxShadow: isActive
                              ? "0 0 8px rgba(52,211,153,0.6)"
                              : "inset 0 1px 2px rgba(0,0,0,0.3)",
                            ["--dot-color" as string]: "rgba(52,211,153,0.6)",
                          }}
                        />
                      </div>
                      <p className="text-[10px] text-slate-600 font-mono mt-0.5 truncate">
                        {device.device_id}
                      </p>
                      <p className="text-xs text-slate-400 mt-1 truncate">
                        {device.type && `${localizeType(locale, device.type)} `}
                        {device.location && `| ${formatLocation(locale, device.location)}`}
                      </p>
                    </div>
                  </div>

                  {/* Row 2: Mode + Timestamp */}
                  <div className="flex items-center justify-between mt-3 px-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">{t("operationMode")}</span>
                      <span
                        className="text-xs font-medium font-mono px-2 py-0.5 rounded"
                        style={{
                          background: isActive ? `${systemColor}10` : "rgba(255,255,255,0.03)",
                          color: isActive ? systemColor : "rgb(100,116,139)",
                          border: `1px solid ${isActive ? `${systemColor}20` : "rgba(255,255,255,0.04)"}`,
                        }}
                      >
                        {device.mode === "auto"
                          ? t("modeAuto")
                          : device.mode === "standby"
                          ? t("modeStandby")
                          : device.mode}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-slate-600">
                      {device.ts
                        ? new Date(device.ts * 1000).toLocaleTimeString("ko-KR")
                        : "-"}
                    </span>
                  </div>

                  {/* Row 3: ON/OFF 3D Toggle Buttons */}
                  <div className="flex gap-3 mt-4">
                    {/* ON Button */}
                    <button
                      className="flex-1 relative overflow-hidden rounded-lg py-2.5 font-medium text-sm transition-all duration-300 disabled:opacity-35 disabled:cursor-not-allowed"
                      disabled={isLoading || isActive}
                      onClick={() => handleCommand(device.device_id, "ON")}
                      style={{
                        background: isActive
                          ? "rgba(255,255,255,0.03)"
                          : "rgba(52,211,153,0.12)",
                        border: isActive
                          ? "1px solid rgba(255,255,255,0.06)"
                          : "1px solid rgba(52,211,153,0.3)",
                        color: isActive
                          ? "rgba(255,255,255,0.25)"
                          : "rgb(52,211,153)",
                        boxShadow: isActive
                          ? "inset 0 2px 4px rgba(0,0,0,0.2)"
                          : "0 0 15px rgba(52,211,153,0.3), inset 0 1px 1px rgba(255,255,255,0.05), inset 0 -2px 4px rgba(0,0,0,0.15)",
                      }}
                    >
                      <span className="relative z-10 flex items-center justify-center gap-2">
                        {isLoading && !isActive ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Power className="h-4 w-4" />
                        )}
                        {t("start")}
                      </span>
                    </button>

                    {/* OFF Button */}
                    <button
                      className="flex-1 relative overflow-hidden rounded-lg py-2.5 font-medium text-sm transition-all duration-300 disabled:opacity-35 disabled:cursor-not-allowed"
                      disabled={isLoading || !isActive}
                      onClick={() => handleCommand(device.device_id, "OFF")}
                      style={{
                        background: !isActive
                          ? "rgba(255,255,255,0.03)"
                          : "rgba(239,68,68,0.12)",
                        border: !isActive
                          ? "1px solid rgba(255,255,255,0.06)"
                          : "1px solid rgba(239,68,68,0.3)",
                        color: !isActive
                          ? "rgba(255,255,255,0.25)"
                          : "rgb(239,68,68)",
                        boxShadow: !isActive
                          ? "inset 0 2px 4px rgba(0,0,0,0.2)"
                          : "0 0 15px rgba(239,68,68,0.3), inset 0 1px 1px rgba(255,255,255,0.05), inset 0 -2px 4px rgba(0,0,0,0.15)",
                      }}
                    >
                      <span className="relative z-10 flex items-center justify-center gap-2">
                        {isLoading && isActive ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <PowerOff className="h-4 w-4" />
                        )}
                        {t("stop")}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── 명령 이력 (3D Glassmorphism) ── */}
        <div className="ctrl-card-3d p-5" style={{ borderLeft: "4px solid rgba(34,211,238,0.3)" }}>
          <div className="flex items-center gap-3 mb-4">
            {/* 3D Send Icon */}
            <div className="relative flex items-center justify-center" style={{ width: 36, height: 36 }}>
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  background: "conic-gradient(from 0deg, transparent 0%, rgba(34,211,238,0.3) 25%, transparent 50%, rgba(34,211,238,0.2) 75%, transparent 100%)",
                  opacity: 0.5,
                }}
              />
              <div className="absolute rounded-full" style={{ inset: 2, background: "rgba(8,12,24,0.95)" }} />
              <div
                className="absolute rounded-full"
                style={{
                  inset: 4,
                  background: "radial-gradient(circle at 35% 30%, rgba(34,211,238,0.08), rgba(8,12,24,0.95) 70%)",
                }}
              />
              <Send
                size={14}
                style={{
                  color: "rgb(34,211,238)",
                  filter: "drop-shadow(0 0 4px rgba(34,211,238,0.5))",
                  position: "relative",
                  zIndex: 1,
                }}
              />
            </div>
            <span className="text-base font-semibold text-white">{t("recentCommands")}</span>
          </div>

          {commandHistory.length > 0 ? (
            <div className="space-y-2">
              {commandHistory.map((entry) => (
                <div
                  key={entry.id}
                  className="ctrl-history-entry flex items-center justify-between py-2.5 px-3 text-sm"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant={entry.success ? "success" : "danger"}>
                      {entry.success ? t("commandSuccess") : t("commandFailed")}
                    </Badge>
                    <span className="font-medium text-white">{entry.deviceId}</span>
                    <span
                      className="font-mono text-xs px-1.5 py-0.5 rounded"
                      style={{
                        background: entry.command.includes("START") || entry.command === "ON"
                          ? "rgba(52,211,153,0.1)"
                          : "rgba(239,68,68,0.1)",
                        color: entry.command.includes("START") || entry.command === "ON"
                          ? "rgb(52,211,153)"
                          : "rgb(239,68,68)",
                      }}
                    >
                      {entry.command}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500 hidden sm:inline">{entry.message}</span>
                    <span className="text-xs text-slate-600 font-mono">
                      {entry.timestamp.toLocaleTimeString("ko-KR")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10 text-slate-500 text-sm">
              <div className="relative inline-flex items-center justify-center mb-3" style={{ width: 48, height: 48 }}>
                <div
                  className="absolute inset-0 rounded-full"
                  style={{
                    border: "1px solid rgba(148,163,184,0.1)",
                    background: "rgba(148,163,184,0.03)",
                  }}
                />
                <Send
                  className="h-6 w-6 opacity-30"
                  style={{ position: "relative", zIndex: 1, color: "rgb(148,163,184)" }}
                />
              </div>
              <p>{t("noCommands")}</p>
              <p className="text-xs mt-1 text-slate-600">{t("noCommandsHint")}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

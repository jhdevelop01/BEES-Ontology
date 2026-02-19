"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { Power, PowerOff, Loader2, Send, PlayCircle, StopCircle, Activity, ChevronDown, ChevronRight, Eye } from "lucide-react";
import { getDisplayName, localizeType, formatLocation } from "@/lib/utils";

const NON_CONTROLLABLE_TYPES = new Set(["elevator", "chilled_ceiling_panel"]);

function isControllable(device: DeviceStatus): boolean {
  if (device.controllable !== undefined) return device.controllable;
  if (!device.type) return true;
  return !NON_CONTROLLABLE_TYPES.has(device.type.toLowerCase());
}

/**
 * 제어 페이지
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
  const [showMonitorOnly, setShowMonitorOnly] = useState(false);
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

  const controllableDevices = useMemo(() => deviceList.filter(isControllable), [deviceList]);
  const monitorOnlyDevices = useMemo(() => deviceList.filter(d => !isControllable(d)), [deviceList]);

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
      // 명령 이력 추가
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
      // 명령 이력 추가
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

  const isRunning = simStatus === "running";
  const activeCount = deviceList.filter(d => d.is_active).length;
  const allActive = deviceList.length > 0 && activeCount === deviceList.length;
  const noneActive = activeCount === 0;

  return (
    <div className="min-h-screen">
      <Header
        title={t("title")}
        description={`${t("description")} — ${t("controllableCount", { count: controllableDevices.length, total: deviceList.length })}`}
        connected={connected}
      />

      <div className="p-3 md:p-6 space-y-6">
        {/* 전체 시뮬레이션 제어 패널 */}
        <Card className="border-2 border-blue-100 bg-gradient-to-r from-blue-50/50 to-indigo-50/50">
          <CardContent className="py-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Activity className={`h-5 w-5 ${activeCount > 0 ? "text-green-500" : "text-gray-400"}`} />
                <div>
                  <h3 className="font-semibold text-gray-900">{t("simulationControl")}</h3>
                  <p className="text-sm text-gray-500">
                    {t("simulationDesc")}
                  </p>
                </div>
                <Badge
                  variant={activeCount > 0 ? "success" : simStatus === "disconnected" ? "danger" : "secondary"}
                  className="ml-2"
                >
                  {activeCount > 0 ? t("simRunning") : simStatus === "disconnected" ? t("simDisconnected") : t("simStopped")}
                </Badge>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="success"
                  size="lg"
                  disabled={simLoading || allActive}
                  onClick={handleStartAll}
                  className="min-w-[140px]"
                >
                  {simLoading && !allActive ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <PlayCircle className="h-4 w-4 mr-2" />
                  )}
                  {t("startAll")}
                </Button>
                <Button
                  variant="destructive"
                  size="lg"
                  disabled={simLoading || noneActive}
                  onClick={handleStopAll}
                  className="min-w-[140px]"
                >
                  {simLoading && !noneActive ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <StopCircle className="h-4 w-4 mr-2" />
                  )}
                  {t("stopAll")}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 제어 가능 장비 카드 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {controllableDevices.map((device) => {
            const isLoading = loading[device.device_id];
            const isActive = device.is_active;

            return (
              <Card key={device.device_id} className="relative overflow-hidden">
                <div
                  className={`absolute top-0 left-0 right-0 h-1 ${
                    isActive ? "bg-green-500" : "bg-gray-300"
                  }`}
                />

                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">
                      {getDisplayName(locale, device.label, device.device_id)}
                    </CardTitle>
                    <p className="text-[10px] text-gray-400 font-mono mt-0.5">
                      {device.device_id}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      {device.type && `${localizeType(locale, device.type)} `}
                      {device.location && `| ${formatLocation(locale, device.location)}`}
                    </p>
                  </div>
                  <Badge
                    variant={isActive ? "success" : "secondary"}
                    className="text-sm px-3 py-1"
                  >
                    {isActive ? (
                      <>
                        <Power className="h-3 w-3 mr-1" />
                        ON
                      </>
                    ) : (
                      <>
                        <PowerOff className="h-3 w-3 mr-1" />
                        OFF
                      </>
                    )}
                  </Badge>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-500">{t("operationMode")}</span>
                      <span className="ml-2 font-medium">
                        {device.mode === "auto"
                          ? t("modeAuto")
                          : device.mode === "standby"
                          ? t("modeStandby")
                          : device.mode}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">{t("lastUpdate")}</span>
                      <span className="ml-2 font-medium text-xs">
                        {device.ts
                          ? new Date(device.ts * 1000).toLocaleTimeString(
                              "ko-KR"
                            )
                          : "-"}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      variant={isActive ? "outline" : "success"}
                      className="flex-1"
                      disabled={isLoading || isActive}
                      onClick={() => handleCommand(device.device_id, "ON")}
                    >
                      {isLoading && !isActive ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Power className="h-4 w-4 mr-2" />
                      )}
                      {t("start")}
                    </Button>
                    <Button
                      variant={!isActive ? "outline" : "destructive"}
                      className="flex-1"
                      disabled={isLoading || !isActive}
                      onClick={() => handleCommand(device.device_id, "OFF")}
                    >
                      {isLoading && isActive ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <PowerOff className="h-4 w-4 mr-2" />
                      )}
                      {t("stop")}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* 모니터링 전용 장비 */}
        {monitorOnlyDevices.length > 0 && (
          <div className="space-y-4">
            <button
              onClick={() => setShowMonitorOnly(prev => !prev)}
              className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
            >
              {showMonitorOnly ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              <Eye className="h-4 w-4" />
              <span>{t("monitorOnlyLabel")} ({monitorOnlyDevices.length})</span>
              <Badge variant="secondary" className="text-xs">
                {t("monitorOnlyDevices")}
              </Badge>
            </button>

            {showMonitorOnly && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                {monitorOnlyDevices.map((device) => {
                  const isActive = device.is_active;

                  return (
                    <Card key={device.device_id} className="relative overflow-hidden opacity-70">
                      <div
                        className={`absolute top-0 left-0 right-0 h-1 ${
                          isActive ? "bg-green-500" : "bg-gray-300"
                        }`}
                      />

                      <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                          <CardTitle className="text-lg">
                            {getDisplayName(locale, device.label, device.device_id)}
                          </CardTitle>
                          <p className="text-[10px] text-gray-400 font-mono mt-0.5">
                            {device.device_id}
                          </p>
                          <p className="text-sm text-gray-500 mt-1">
                            {device.type && `${localizeType(locale, device.type)} `}
                            {device.location && `| ${formatLocation(locale, device.location)}`}
                          </p>
                        </div>
                        <Badge
                          variant={isActive ? "success" : "secondary"}
                          className="text-sm px-3 py-1"
                        >
                          {isActive ? (
                            <>
                              <Power className="h-3 w-3 mr-1" />
                              ON
                            </>
                          ) : (
                            <>
                              <PowerOff className="h-3 w-3 mr-1" />
                              OFF
                            </>
                          )}
                        </Badge>
                      </CardHeader>

                      <CardContent>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <span className="text-gray-500">{t("operationMode")}</span>
                            <span className="ml-2 font-medium">
                              {device.mode === "auto"
                                ? t("modeAuto")
                                : device.mode === "standby"
                                ? t("modeStandby")
                                : device.mode}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500">{t("lastUpdate")}</span>
                            <span className="ml-2 font-medium text-xs">
                              {device.ts
                                ? new Date(device.ts * 1000).toLocaleTimeString(
                                    "ko-KR"
                                  )
                                : "-"}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 명령 이력 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Send className="h-4 w-4" />
              {t("recentCommands")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {commandHistory.length > 0 ? (
              <div className="space-y-2">
                {commandHistory.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50 text-sm"
                  >
                    <div className="flex items-center gap-3">
                      <Badge
                        variant={entry.success ? "success" : "danger"}
                      >
                        {entry.success ? t("commandSuccess") : t("commandFailed")}
                      </Badge>
                      <span className="font-medium">{entry.deviceId}</span>
                      <span className="text-gray-500">{entry.command}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-400">
                        {entry.message}
                      </span>
                      <span className="text-xs text-gray-400">
                        {entry.timestamp.toLocaleTimeString("ko-KR")}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400 text-sm">
                <Send className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p>{t("noCommands")}</p>
                <p className="text-xs mt-1">
                  {t("noCommandsHint")}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

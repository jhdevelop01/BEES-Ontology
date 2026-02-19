"use client";

import React, { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { useSSE } from "@/lib/sse";
import { sendControlCommand, getDeviceStatus, type DeviceStatus } from "@/lib/api";
import { Power, PowerOff, Loader2, Send } from "lucide-react";

/**
 * 제어 페이지
 * AHU_5F ON/OFF 토글 + 현재 상태 + 명령 결과 토스트
 */
export default function ControlPage() {
  const { devices, connected } = useSSE();
  const { addToast } = useToast();
  const t = useTranslations("control");
  const [deviceList, setDeviceList] = useState<DeviceStatus[]>([]);
  const [loading, setLoading] = useState<Record<string, boolean>>({});
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

  // 초기 장비 상태 로딩
  useEffect(() => {
    const fetchDevices = async () => {
      try {
        const data = await getDeviceStatus();
        setDeviceList(data.devices);
      } catch {
        // API 미연결 시 빈 목록
        setDeviceList([]);
      }
    };
    fetchDevices();
  }, []);

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

  // 제어 명령 전송
  const handleCommand = async (deviceId: string, command: string) => {
    setLoading((prev) => ({ ...prev, [deviceId]: true }));

    // 안전장치: 15초 후 강제 로딩 해제
    const safetyTimer = setTimeout(() => {
      setLoading((prev) => ({ ...prev, [deviceId]: false }));
    }, 15000);

    try {
      const result = await sendControlCommand({
        deviceId: deviceId.startsWith("bldg:") ? deviceId : `bldg:${deviceId}`,
        command,
      });

      // 명령 이력 추가
      const entry = {
        id: Math.random().toString(36).substring(7),
        deviceId,
        command,
        success: result.success,
        message: result.message,
        timestamp: new Date(),
      };
      setCommandHistory((prev) => [entry, ...prev.slice(0, 9)]);

      // 토스트 알림
      addToast({
        title: result.success ? t("commandSuccess") : t("commandFailed"),
        description: result.message,
        variant: result.success ? "success" : "error",
      });

      // 로컬 상태 즉시 업데이트 (낙관적 업데이트)
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

  return (
    <div className="min-h-screen">
      <Header
        title={t("title")}
        description={t("description")}
        connected={connected}
      />

      <div className="p-3 md:p-6 space-y-6">
        {/* 장비 제어 카드 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {deviceList.map((device) => {
            const isLoading = loading[device.device_id];
            const isActive = device.is_active;

            return (
              <Card key={device.device_id} className="relative overflow-hidden">
                {/* 상단 상태 바 */}
                <div
                  className={`absolute top-0 left-0 right-0 h-1 ${
                    isActive ? "bg-green-500" : "bg-gray-300"
                  }`}
                />

                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">
                      {device.name || device.device_id}
                    </CardTitle>
                    <p className="text-sm text-gray-500 mt-1">
                      {device.type && `${device.type} `}
                      {device.location && `| ${device.location}`}
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
                  {/* 장비 정보 */}
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

                  {/* ON/OFF 토글 버튼 */}
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

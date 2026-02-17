"use client";

import React, { useState, useEffect, useCallback } from "react";
import { X, AlertTriangle, AlertOctagon, Bell, BellOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSSE, type SSEAlarmEvent } from "@/lib/sse";
import {
  requestNotificationPermission,
  showAlarmNotification,
} from "@/lib/notifications";

const MAX_VISIBLE = 5;
const AUTO_DISMISS_MS = 30_000;

interface AlarmEntry {
  id: string;
  alarm: SSEAlarmEvent;
  dismissed: boolean;
}

export function AlarmBanner() {
  const { alarms } = useSSE();
  const [entries, setEntries] = useState<AlarmEntry[]>([]);
  const [notifEnabled, setNotifEnabled] = useState(false);

  // 브라우저 알림 권한 상태 초기화
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setNotifEnabled(Notification.permission === "granted");
    }
  }, []);

  const toggleNotifications = useCallback(async () => {
    if (notifEnabled) {
      setNotifEnabled(false);
      return;
    }
    const granted = await requestNotificationPermission();
    setNotifEnabled(granted);
  }, [notifEnabled]);

  // 새 알람 수신 시 엔트리 추가 + Push 알림
  useEffect(() => {
    if (alarms.length === 0) return;
    const latest = alarms[alarms.length - 1];
    const id = `${latest.ts}-${latest.equipment || ""}-${Math.random().toString(36).slice(2, 6)}`;

    // 브라우저 Push 알림
    if (notifEnabled) {
      showAlarmNotification(latest);
    }

    setEntries((prev) => {
      const next = [...prev, { id, alarm: latest, dismissed: false }];
      // 최대 개수 유지
      return next.slice(-MAX_VISIBLE * 2);
    });
  }, [alarms.length, notifEnabled]);

  // 자동 dismiss 타이머
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    entries.forEach((entry) => {
      if (!entry.dismissed) {
        const timer = setTimeout(() => {
          setEntries((prev) =>
            prev.map((e) => (e.id === entry.id ? { ...e, dismissed: true } : e))
          );
        }, AUTO_DISMISS_MS);
        timers.push(timer);
      }
    });
    return () => timers.forEach(clearTimeout);
  }, [entries]);

  const dismiss = useCallback((id: string) => {
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, dismissed: true } : e))
    );
  }, []);

  const visible = entries.filter((e) => !e.dismissed).slice(-MAX_VISIBLE);

  if (visible.length === 0) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 pointer-events-none">
      <div className="max-w-2xl mx-auto p-2 space-y-2">
        {/* 알림 권한 토글 버튼 */}
        <div className="flex justify-end pointer-events-auto">
          <button
            onClick={toggleNotifications}
            className={cn(
              "p-1.5 rounded-full shadow-md border text-xs flex items-center gap-1",
              notifEnabled
                ? "bg-blue-50 border-blue-200 text-blue-600"
                : "bg-gray-50 border-gray-200 text-gray-500"
            )}
            title={notifEnabled ? "Push 알림 끄기" : "Push 알림 켜기"}
          >
            {notifEnabled ? (
              <Bell className="h-3.5 w-3.5" />
            ) : (
              <BellOff className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
        {visible.map((entry) => {
          const isCritical = entry.alarm.severity === "critical";
          return (
            <div
              key={entry.id}
              className={cn(
                "pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-lg shadow-lg border text-sm animate-in slide-in-from-top-2",
                isCritical
                  ? "bg-red-50 border-red-200 text-red-800"
                  : "bg-yellow-50 border-yellow-200 text-yellow-800"
              )}
            >
              {isCritical ? (
                <AlertOctagon className="h-5 w-5 flex-shrink-0 mt-0.5 text-red-500" />
              ) : (
                <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5 text-yellow-500" />
              )}

              <div className="flex-1 min-w-0">
                <div className="font-medium">
                  {isCritical ? "[CRITICAL]" : "[WARNING]"}{" "}
                  {entry.alarm.equipment || "알 수 없는 장비"}
                </div>
                <div className="text-xs mt-0.5 opacity-80">
                  {entry.alarm.type || "알람"} — 값: {entry.alarm.value?.toFixed(1) ?? "-"}{" "}
                  (임계: {entry.alarm.threshold?.toFixed(1) ?? "-"})
                </div>
                <div className="text-xs mt-0.5 opacity-60">
                  {new Date(entry.alarm.ts * 1000).toLocaleTimeString("ko-KR")}
                </div>
              </div>

              <button
                onClick={() => dismiss(entry.id)}
                className={cn(
                  "flex-shrink-0 p-1 rounded hover:bg-black/5",
                  isCritical ? "text-red-400" : "text-yellow-400"
                )}
                aria-label="닫기"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

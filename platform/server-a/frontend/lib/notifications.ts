"use client";

import type { SSEAlarmEvent } from "./sse";

/**
 * 브라우저 Push 알림 권한 요청.
 * @returns 권한이 부여되었으면 true
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return false;
  }

  if (Notification.permission === "granted") {
    return true;
  }

  if (Notification.permission === "denied") {
    return false;
  }

  const result = await Notification.requestPermission();
  return result === "granted";
}

/**
 * critical/warning 알람에 대해 브라우저 Push 알림 표시.
 */
export function showAlarmNotification(alarm: SSEAlarmEvent): void {
  if (
    typeof window === "undefined" ||
    !("Notification" in window) ||
    Notification.permission !== "granted"
  ) {
    return;
  }

  const isCritical = alarm.severity === "critical";
  const title = isCritical
    ? `🔴 CRITICAL — ${alarm.equipment || "알 수 없는 장비"}`
    : `🟡 WARNING — ${alarm.equipment || "알 수 없는 장비"}`;

  const body = [
    alarm.type || "알람",
    `값: ${alarm.value?.toFixed(1) ?? "-"}`,
    `임계: ${alarm.threshold?.toFixed(1) ?? "-"}`,
    new Date(alarm.ts * 1000).toLocaleTimeString("ko-KR"),
  ].join(" | ");

  new Notification(title, {
    body,
    tag: `bees-alarm-${alarm.ts}`,
    requireInteraction: isCritical,
  });
}

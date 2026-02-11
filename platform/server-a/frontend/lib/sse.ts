"use client";

import { useEffect, useRef, useState, useCallback } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/**
 * SSE 이벤트 데이터 타입
 */
export interface SSEPointEvent {
  point_id: string;
  value: number | null;
  ts: number;
  unit: string;
  quality: string;
}

export interface SSEDeviceEvent {
  device_id: string;
  is_active: boolean;
  mode: string;
  ts: number;
}

export interface SSEAlarmEvent {
  severity: string;
  equipment?: string;
  type?: string;
  value?: number;
  threshold?: number;
  ts: number;
}

/**
 * SSE 커스텀 훅 — 실시간 센서 데이터 수신
 *
 * @param maxHistory 각 포인트별 이력 최대 개수 (차트용)
 * @returns { points, devices, connected }
 */
export function useSSE(maxHistory: number = 60) {
  // 포인트 최신값
  const [points, setPoints] = useState<Record<string, SSEPointEvent>>({});
  // 포인트별 이력 (차트용)
  const [pointHistory, setPointHistory] = useState<
    Record<string, SSEPointEvent[]>
  >({});
  // 디바이스 상태
  const [devices, setDevices] = useState<Record<string, SSEDeviceEvent>>({});
  // 연결 상태
  const [connected, setConnected] = useState(false);
  // 알람
  const [alarms, setAlarms] = useState<SSEAlarmEvent[]>([]);

  const eventSourceRef = useRef<EventSource | null>(null);

  const connect = useCallback(() => {
    // 이전 연결 정리
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const es = new EventSource(`${API_BASE}/api/stream/points`);
    eventSourceRef.current = es;

    es.onopen = () => {
      setConnected(true);
    };

    es.onerror = () => {
      setConnected(false);
      // 5초 후 재연결 시도
      setTimeout(() => {
        if (eventSourceRef.current === es) {
          connect();
        }
      }, 5000);
    };

    // 포인트 데이터 이벤트
    es.addEventListener("point", (event: MessageEvent) => {
      try {
        const data: SSEPointEvent = JSON.parse(event.data);
        setPoints((prev) => ({
          ...prev,
          [data.point_id]: data,
        }));
        setPointHistory((prev) => {
          const history = prev[data.point_id] || [];
          const updated = [...history, data].slice(-maxHistory);
          return { ...prev, [data.point_id]: updated };
        });
      } catch {
        // 파싱 실패 무시
      }
    });

    // 디바이스 상태 이벤트
    es.addEventListener("device", (event: MessageEvent) => {
      try {
        const data: SSEDeviceEvent = JSON.parse(event.data);
        setDevices((prev) => ({
          ...prev,
          [data.device_id]: data,
        }));
      } catch {
        // 파싱 실패 무시
      }
    });

    // 알람 이벤트
    es.addEventListener("alarm", (event: MessageEvent) => {
      try {
        const data: SSEAlarmEvent = JSON.parse(event.data);
        setAlarms((prev) => [...prev.slice(-99), data]);
      } catch {
        // 파싱 실패 무시
      }
    });

    // heartbeat (연결 유지 확인)
    es.addEventListener("heartbeat", () => {
      setConnected(true);
    });
  }, [maxHistory]);

  useEffect(() => {
    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [connect]);

  return {
    points,
    pointHistory,
    devices,
    alarms,
    connected,
  };
}

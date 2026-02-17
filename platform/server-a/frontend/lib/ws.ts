"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { SSEPointEvent, SSEDeviceEvent, SSEAlarmEvent } from "./sse";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8010";

function deriveWsUrl(base: string): string {
  return base.replace(/^http/, "ws") + "/api/stream/ws";
}

/**
 * WebSocket 커스텀 훅 — 실시간 센서 데이터 수신
 * useSSE()와 동일 인터페이스, WebSocket 프로토콜 사용.
 * 연결 실패 시 3초 후 자동 재연결.
 */
export function useWebSocket(maxHistory: number = 60) {
  const [points, setPoints] = useState<Record<string, SSEPointEvent>>({});
  const [pointHistory, setPointHistory] = useState<
    Record<string, SSEPointEvent[]>
  >({});
  const [devices, setDevices] = useState<Record<string, SSEDeviceEvent>>({});
  const [connected, setConnected] = useState(false);
  const [alarms, setAlarms] = useState<SSEAlarmEvent[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmounted = useRef(false);

  const connect = useCallback(() => {
    if (unmounted.current) return;

    if (wsRef.current) {
      wsRef.current.close();
    }

    const url = deriveWsUrl(API_BASE);
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("[BEES WS] 연결 성공:", url);
      setConnected(true);
    };

    ws.onclose = () => {
      console.warn("[BEES WS] 연결 종료, 3초 후 재연결");
      setConnected(false);
      if (!unmounted.current) {
        reconnectTimer.current = setTimeout(() => {
          if (!unmounted.current) connect();
        }, 3000);
      }
    };

    ws.onerror = () => {
      setConnected(false);
    };

    ws.onmessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data);
        const { type, data } = msg;

        if (type === "point") {
          const pt = data as SSEPointEvent;
          setPoints((prev) => ({ ...prev, [pt.point_id]: pt }));
          setPointHistory((prev) => {
            const history = prev[pt.point_id] || [];
            const updated = [...history, pt].slice(-maxHistory);
            return { ...prev, [pt.point_id]: updated };
          });
        } else if (type === "device") {
          const dev = data as SSEDeviceEvent;
          setDevices((prev) => ({ ...prev, [dev.device_id]: dev }));
        } else if (type === "alarm") {
          const alarm = data as SSEAlarmEvent;
          setAlarms((prev) => [...prev.slice(-99), alarm]);
        }
      } catch {
        // 파싱 실패 무시
      }
    };
  }, [maxHistory]);

  useEffect(() => {
    unmounted.current = false;
    connect();

    return () => {
      unmounted.current = true;
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  return { points, pointHistory, devices, alarms, connected };
}

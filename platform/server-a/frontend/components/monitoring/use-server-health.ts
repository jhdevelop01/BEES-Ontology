"use client";

import { useState, useEffect, useCallback, useRef } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8010";

export interface ServerHealthStatus {
  id: string;
  name: string;
  status: "online" | "offline" | "error" | "unknown";
}

/** Raw backend response shape (object keyed by id) */
interface RawPlatformHealthResponse {
  servers: Record<string, { status: string; port: number; role: string; details: Record<string, unknown> }>;
  infrastructure: Record<string, { status: string; port: number }>;
  timestamp: string;
}

/**
 * 플랫폼 서버 헬스 체크 훅
 *
 * /api/platform/health를 15초 간격으로 폴링한다.
 * isCollapsed=true이면 폴링을 일시정지하여 불필요한 네트워크 요청을 줄인다.
 *
 * 백엔드는 servers/infrastructure를 object로 반환하므로,
 * 훅 내부에서 {id, name, status} 배열로 변환하여 컴포넌트에 전달한다.
 */
export function useServerHealth(isCollapsed: boolean = false) {
  const [servers, setServers] = useState<ServerHealthStatus[]>([]);
  const [infrastructure, setInfrastructure] = useState<ServerHealthStatus[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchHealth = useCallback(async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    try {
      const res = await fetch(`${API_BASE}/api/platform/health`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data: RawPlatformHealthResponse = await res.json();

      // Transform object → array
      const srvArr: ServerHealthStatus[] = Object.entries(
        data.servers || {}
      ).map(([key, val]) => ({
        id: key.replace(/_/g, "-"), // server_a → server-a (match architecture-data.ts ids)
        name: val.role,
        status: (val.status === "online" ? "online" : val.status === "error" ? "error" : "offline") as ServerHealthStatus["status"],
      }));

      const infraArr: ServerHealthStatus[] = Object.entries(
        data.infrastructure || {}
      ).map(([key, val]) => ({
        id: key, // neo4j, mqtt, influxdb, postgresql (already match architecture-data.ts ids)
        name: key,
        status: (val.status === "online" ? "online" : val.status === "offline" ? "offline" : "unknown") as ServerHealthStatus["status"],
      }));

      setServers(srvArr);
      setInfrastructure(infraArr);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setError("Timeout");
      } else {
        setError((err as Error).message);
      }
    } finally {
      setLoading(false);
      clearTimeout(timeout);
    }
  }, []);

  useEffect(() => {
    if (isCollapsed) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Initial fetch + 15s polling
    fetchHealth();
    intervalRef.current = setInterval(fetchHealth, 15_000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isCollapsed, fetchHealth]);

  return { servers, infrastructure, loading, error, lastUpdated };
}

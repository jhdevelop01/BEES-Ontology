"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ExternalLink, Activity } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { TopologyNode } from "@/lib/api";
import type { SSEPointEvent, SSEDeviceEvent } from "@/lib/sse";
import { getTypeIcon, getTypeLabel, toMonitoringId, isComponentNode } from "./utils";
import { StatusIndicator } from "./status-indicator";
import { FlowCard } from "./flow-card";

interface EquipmentDetailViewProps {
  node: TopologyNode;
  deviceStatusMap: Record<string, boolean>;
  points: Record<string, SSEPointEvent>;
  devices: Record<string, SSEDeviceEvent>;
}

/* ── Collect matched sensor data ── */
function getMatchedSensors(
  node: TopologyNode,
  points: Record<string, SSEPointEvent>
): Array<{
  id: string;
  name: string;
  value: number | null;
  unit: string;
  quality: string;
  ts: number;
}> {
  const results: Array<{
    id: string;
    name: string;
    value: number | null;
    unit: string;
    quality: string;
    ts: number;
  }> = [];

  // 1) Child sensor nodes
  const collectSensors = (n: TopologyNode) => {
    const tp = n.type.toLowerCase();
    if (tp.includes("sensor") || tp.includes("point")) {
      const point = points[n.id] || points[n.name];
      results.push({
        id: n.id,
        name: n.name,
        value: point?.value ?? null,
        unit: point?.unit || "",
        quality: point?.quality || "N/A",
        ts: point?.ts || 0,
      });
    }
    n.children?.forEach(collectSensors);
  };
  node.children?.forEach(collectSensors);

  // 2) SSE name-matching fallback
  if (results.length === 0) {
    const nodeName = node.name.toLowerCase();
    const nodeId = node.id.toLowerCase();
    for (const [pid, pdata] of Object.entries(points)) {
      const pidLower = pid.toLowerCase();
      if (pidLower.includes(nodeName) || pidLower.includes(nodeId)) {
        results.push({
          id: pid,
          name: pid.split(":").pop() || pid,
          value: pdata.value,
          unit: pdata.unit,
          quality: pdata.quality,
          ts: pdata.ts,
        });
      }
    }
  }

  return results;
}

export function EquipmentDetailView({
  node,
  deviceStatusMap,
  points,
  devices,
}: EquipmentDetailViewProps) {
  const t = useTranslations("topology");
  const Icon = getTypeIcon(node.type);

  const isSimulated = node.name in deviceStatusMap || node.id in deviceStatusMap;
  const isActive = isSimulated
    ? deviceStatusMap[node.name] || deviceStatusMap[node.id] || false
    : false;
  const deviceData = devices[node.id] || devices[node.name];
  const mode = deviceData?.mode || "N/A";
  const lastTs = deviceData?.ts || null;

  const sensors = useMemo(() => getMatchedSensors(node, points), [node, points]);

  // Collect sub-components
  const subComponents = useMemo(() => {
    const comps: TopologyNode[] = [];
    const walk = (n: TopologyNode) => {
      if (isComponentNode(n)) comps.push(n);
      n.children?.forEach(walk);
    };
    node.children?.forEach(walk);
    return comps;
  }, [node]);

  const overallStatus: "normal" | "warning" | "critical" = !isSimulated
    ? "normal"
    : isActive
    ? "normal"
    : "critical";

  return (
    <div className="space-y-6">
      {/* Hero section */}
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <Icon className="h-6 w-6 text-cyan-400" />
            <div>
              <h3 className="text-lg font-semibold text-white">{node.name}</h3>
              <p className="text-xs text-slate-400">{t(getTypeLabel(node.type))}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <StatusIndicator status={overallStatus} size="md" />
            {isSimulated && (
              <Badge variant={isActive ? "success" : "danger"}>
                {isActive ? "ON" : "OFF"}
              </Badge>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs text-slate-400">
          <span>
            {t("eqMode")}: <span className="text-white font-medium">{mode}</span>
          </span>
          {lastTs && (
            <span>
              {t("eqLastUpdate")}:{" "}
              <span className="text-white font-medium">
                {new Date(lastTs * 1000).toLocaleTimeString("ko-KR")}
              </span>
            </span>
          )}
        </div>

        {/* Monitoring link */}
        <Link
          href={`/monitoring/${encodeURIComponent(toMonitoringId(node.id))}`}
          className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 text-sm bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 rounded-lg transition-colors"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          {t("equipmentDetail")}
        </Link>
      </div>

      {/* Sub-components */}
      {subComponents.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-slate-200 mb-3">
            {t("childComponents", { count: subComponents.length })}
          </h4>
          <div className="flex flex-wrap gap-2">
            {subComponents.map((comp) => {
              const compActive =
                deviceStatusMap[comp.name] || deviceStatusMap[comp.id] || false;
              const compSim =
                comp.name in deviceStatusMap || comp.id in deviceStatusMap;
              return (
                <FlowCard
                  key={comp.id}
                  title={comp.name}
                  subtitle={comp.type}
                  status={!compSim ? "normal" : compActive ? "normal" : "critical"}
                  size="sm"
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Sensor table */}
      <div>
        <h4 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
          <Activity className="h-4 w-4" />
          {t("sensorCurrent")}
        </h4>
        {sensors.length === 0 ? (
          <p className="text-sm text-slate-500 py-4 text-center">
            {t("noRealtimeData")}
          </p>
        ) : (
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-2 px-3 text-slate-400 font-medium">
                      {t("thSensor")}
                    </th>
                    <th className="text-right py-2 px-3 text-slate-400 font-medium">
                      {t("thValue")}
                    </th>
                    <th className="text-left py-2 px-3 text-slate-400 font-medium">
                      {t("thUnit")}
                    </th>
                    <th className="text-left py-2 px-3 text-slate-400 font-medium">
                      {t("thStatus")}
                    </th>
                    <th className="text-right py-2 px-3 text-slate-400 font-medium">
                      {t("thTime")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sensors.map((mp) => (
                    <tr
                      key={mp.id}
                      className="border-b border-white/5 hover:bg-white/5"
                    >
                      <td className="py-2 px-3 font-medium text-slate-200">
                        {mp.name}
                      </td>
                      <td className="py-2 px-3 text-right font-semibold text-white font-mono">
                        {mp.value !== null ? mp.value.toFixed(2) : "--"}
                      </td>
                      <td className="py-2 px-3 text-slate-400">{mp.unit}</td>
                      <td className="py-2 px-3">
                        <Badge
                          variant={
                            mp.quality === "good"
                              ? "success"
                              : mp.quality !== "N/A"
                              ? "warning"
                              : "secondary"
                          }
                        >
                          {mp.quality}
                        </Badge>
                      </td>
                      <td className="py-2 px-3 text-right text-xs text-slate-500">
                        {mp.ts
                          ? new Date(mp.ts * 1000).toLocaleTimeString("ko-KR")
                          : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

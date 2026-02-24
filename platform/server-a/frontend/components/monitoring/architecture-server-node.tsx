"use client";

import React from "react";
import { useTranslations } from "next-intl";
import {
  Monitor,
  Server,
  ArrowLeftRight,
  Cpu,
  Database,
  Share2,
  Radio,
  BarChart3,
  HardDrive,
  type LucideIcon,
} from "lucide-react";
import type { ArchNode } from "./architecture-data";

/* ── i18n key lookup by node.id ── */
const I18N_LABEL_KEY: Record<string, string> = {
  "server-a": "archServerA",
  "server-b": "archServerB",
  "server-c": "archServerC",
  "server-d": "archServerD",
  "frontend": "archFrontend",
  "neo4j": "archNeo4j",
  "mqtt": "archMqtt",
  "influxdb": "archInfluxdb",
  "postgresql": "archPostgresql",
};

/* ── Icon lookup from string name ── */
const ICON_MAP: Record<string, LucideIcon> = {
  Monitor,
  Server,
  ArrowLeftRight,
  Cpu,
  Database,
  Share2,
  Radio,
  BarChart3,
  HardDrive,
};

export type HealthStatus = "online" | "offline" | "error" | "unknown";

interface Props {
  node: ArchNode;
  status: HealthStatus;
  onClick?: () => void;
}

const STATUS_DOT: Record<HealthStatus, string> = {
  online:
    "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)] animate-pulse",
  offline: "bg-slate-600 shadow-[0_0_4px_rgba(100,116,139,0.3)]",
  error: "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)] animate-pulse",
  unknown: "bg-slate-700",
};

export function ArchitectureServerNode({ node, status, onClick }: Props) {
  const t = useTranslations("monitoring");
  const i18nKey = I18N_LABEL_KEY[node.id];
  const displayLabel = i18nKey ? t(i18nKey) : node.label;
  const Icon = ICON_MAP[node.iconName] || Server;
  const isActive = status === "online";

  const statusLabel =
    status === "online"
      ? t("archOnline")
      : status === "error"
        ? t("archError")
        : t("archOffline");

  return (
    <button
      onClick={onClick}
      className="group relative flex flex-col items-center gap-1 cursor-default focus:outline-none"
      style={{ width: 110 }}
    >
      {/* ── Glassmorphism Card ── */}
      <div
        className="relative w-full rounded-lg p-2.5 transition-all duration-300 group-hover:[transform:perspective(400px)_rotateY(3deg)_scale(1.05)]"
        style={{
          background: "rgba(255,255,255,0.03)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1px solid transparent",
          borderImage: `linear-gradient(135deg, ${node.color}40, transparent 50%, ${node.color}20) 1`,
          boxShadow: isActive
            ? `0 2px 8px ${node.color}20, 0 8px 24px rgba(0,0,0,0.3), 0 0 40px ${node.color}10`
            : "0 4px 12px rgba(0,0,0,0.2)",
        }}
      >
        {/* ── Icon with rotating ring ── */}
        <div className={`relative mx-auto mb-1.5${isActive ? " arch-float" : ""}`} style={{ width: 44, height: 44 }}>
          {/* Outer rotating conic-gradient ring */}
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: `conic-gradient(from 0deg, transparent 0%, ${node.color}60 20%, transparent 40%, ${node.color}40 60%, transparent 80%, ${node.color}50 95%, transparent 100%)`,
              animation: isActive ? "spin 4s linear infinite" : "none",
              opacity: isActive ? 1 : 0.25,
              boxShadow: `0 4px 12px ${node.color}40, 0 8px 24px rgba(0,0,0,0.4)`,
            }}
          />
          {/* Dark spacer */}
          <div
            className="absolute rounded-full"
            style={{ inset: 2, background: "rgba(8,12,24,0.95)" }}
          />
          {/* Inner circle */}
          <div
            className="absolute rounded-full"
            style={{
              inset: 4,
              background: `radial-gradient(circle at 35% 30%, ${node.color}35, rgba(8,12,24,0.95) 70%), radial-gradient(circle at 60% 75%, ${node.color}15, transparent 50%)`,
              border: `1px solid ${node.color}25`,
              boxShadow: isActive
                ? `0 0 16px ${node.color}30, inset 0 1px 1px ${node.color}10`
                : "none",
            }}
          />
          {/* Specular highlight */}
          <div
            className="absolute rounded-full pointer-events-none"
            style={{
              inset: 4,
              background:
                "radial-gradient(circle at 35% 25%, rgba(255,255,255,0.6) 0%, transparent 40%)",
            }}
          />
          {/* Icon */}
          <Icon
            size={18}
            strokeWidth={1.5}
            className="absolute inset-0 m-auto"
            style={{
              color: node.color,
              filter: isActive
                ? `drop-shadow(0 0 6px ${node.color}80)`
                : `drop-shadow(0 0 2px ${node.color}30)`,
            }}
          />
        </div>

        {/* ── Name + Port ── */}
        <p
          className="text-[11px] font-medium text-white text-center leading-tight truncate w-full"
          style={isActive ? { textShadow: `0 0 8px ${node.color}50` } : undefined}
        >
          {displayLabel}
        </p>
        <p className="text-[9px] text-slate-500 text-center font-mono">
          :{node.port}
        </p>

        {/* ── Status ── */}
        <div className="flex items-center justify-center gap-1 mt-1">
          <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[status]}`} />
          <span className="text-[8px] text-slate-500">{statusLabel}</span>
        </div>
      </div>
    </button>
  );
}

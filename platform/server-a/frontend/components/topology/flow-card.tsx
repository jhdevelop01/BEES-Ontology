"use client";

import { Cpu, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusIndicator, OperationBar } from "./status-indicator";

interface FlowCardProps {
  title: string;
  subtitle?: string;
  status: "normal" | "warning" | "critical";
  activeRatio?: number;
  equipmentCount?: number;
  sensorCount?: number;
  isActive?: boolean;
  onClick?: () => void;
  selected?: boolean;
  size?: "sm" | "md";
}

export function FlowCard({
  title,
  subtitle,
  status,
  activeRatio,
  equipmentCount,
  sensorCount,
  onClick,
  selected = false,
  size = "sm",
}: FlowCardProps) {
  const sizeClasses = size === "sm" ? "w-36 p-2.5" : "w-48 p-3";

  return (
    <button
      onClick={onClick}
      className={cn(
        "bg-white/5 backdrop-blur-xl border border-white/10 rounded-lg text-left transition-all flex-shrink-0",
        "hover:shadow-glow hover:border-cyan-500/30",
        selected && "ring-2 ring-cyan-400",
        sizeClasses
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium text-white truncate mr-1.5">{title}</span>
        <StatusIndicator status={status} size={size === "sm" ? "sm" : "md"} />
      </div>

      {/* Subtitle */}
      {subtitle && (
        <p className="text-slate-400 text-xs truncate mb-1.5">{subtitle}</p>
      )}

      {/* OperationBar */}
      {activeRatio !== undefined && (
        <div className="mb-1.5">
          <OperationBar ratio={activeRatio} size={size === "sm" ? "sm" : "md"} />
        </div>
      )}

      {/* Footer badges */}
      {(equipmentCount !== undefined || sensorCount !== undefined) && (
        <div className="flex items-center gap-2 mt-1">
          {equipmentCount !== undefined && (
            <span className="flex items-center gap-0.5 text-[10px] text-slate-500">
              <Cpu className="h-2.5 w-2.5" />
              E:{equipmentCount}
            </span>
          )}
          {sensorCount !== undefined && (
            <span className="flex items-center gap-0.5 text-[10px] text-slate-500">
              <Activity className="h-2.5 w-2.5" />
              S:{sensorCount}
            </span>
          )}
        </div>
      )}
    </button>
  );
}

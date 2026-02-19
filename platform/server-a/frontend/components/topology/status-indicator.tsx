"use client";

import { cn } from "@/lib/utils";

/* ── StatusIndicator ── */

interface StatusIndicatorProps {
  status: "normal" | "warning" | "critical";
  size?: "sm" | "md";
}

const statusStyles = {
  normal: {
    dot: "bg-emerald-400",
    glow: "shadow-[0_0_6px_rgba(52,211,153,0.6)]",
    pulse: false,
  },
  warning: {
    dot: "bg-amber-400",
    glow: "shadow-[0_0_6px_rgba(251,191,36,0.6)]",
    pulse: false,
  },
  critical: {
    dot: "bg-rose-400",
    glow: "shadow-[0_0_6px_rgba(251,113,133,0.6)]",
    pulse: true,
  },
};

export function StatusIndicator({ status, size = "sm" }: StatusIndicatorProps) {
  const s = statusStyles[status];
  const dotSize = size === "sm" ? "w-2 h-2" : "w-2.5 h-2.5";

  return (
    <span
      className={cn(
        "inline-block rounded-full flex-shrink-0",
        dotSize,
        s.dot,
        s.glow,
        s.pulse && "animate-pulse"
      )}
    />
  );
}

/* ── OperationBar ── */

interface OperationBarProps {
  ratio: number; // 0~1
  size?: "sm" | "md";
}

function getFillColor(ratio: number): string {
  if (ratio > 0.7) return "bg-emerald-400";
  if (ratio > 0.3) return "bg-amber-400";
  return "bg-rose-400";
}

export function OperationBar({ ratio, size = "sm" }: OperationBarProps) {
  const height = size === "sm" ? "h-1" : "h-1.5";
  const pct = Math.max(0, Math.min(1, ratio)) * 100;

  return (
    <div className={cn("w-full rounded-full bg-white/10", height)}>
      <div
        className={cn("rounded-full transition-all duration-500", height, getFillColor(ratio))}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

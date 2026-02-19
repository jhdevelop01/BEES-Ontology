"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface GroupContainerProps {
  title: string;
  color: "cyan" | "purple" | "emerald" | "amber" | "slate" | "indigo";
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  count?: number;
}

const colorMap: Record<string, { border: string; bg: string }> = {
  cyan:    { border: "border-cyan-500/50",    bg: "bg-cyan-500/5" },
  purple:  { border: "border-purple-500/50",  bg: "bg-purple-500/5" },
  emerald: { border: "border-emerald-500/50", bg: "bg-emerald-500/5" },
  amber:   { border: "border-amber-500/50",   bg: "bg-amber-500/5" },
  slate:   { border: "border-slate-500/50",   bg: "bg-slate-500/5" },
  indigo:  { border: "border-indigo-500/50",  bg: "bg-indigo-500/5" },
};

export function GroupContainer({
  title,
  color,
  icon: Icon,
  children,
  count,
}: GroupContainerProps) {
  const c = colorMap[color] ?? colorMap.slate;

  return (
    <div className={cn("border-l-2 rounded-lg p-4", c.border, c.bg)}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        {Icon && <Icon className="h-4 w-4 text-slate-400" />}
        <span className="font-semibold text-sm text-white">{title}</span>
        {count !== undefined && (
          <Badge variant="secondary" className="text-[10px] ml-auto">
            {count}
          </Badge>
        )}
      </div>

      {/* Content */}
      {children}
    </div>
  );
}

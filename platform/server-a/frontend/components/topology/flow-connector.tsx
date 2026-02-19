"use client";

import { cn } from "@/lib/utils";

type FlowDirection = "horizontal" | "vertical" | "arrow-down" | "arrow-right";

interface FlowConnectorProps {
  direction: FlowDirection;
  className?: string;
}

const directionClass: Record<FlowDirection, string> = {
  horizontal: "flow-line-h",
  vertical: "flow-line-v",
  "arrow-down": "flow-arrow-down",
  "arrow-right": "flow-arrow-right",
};

export function FlowConnector({ direction, className }: FlowConnectorProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-center flex-shrink-0",
        directionClass[direction],
        className
      )}
    />
  );
}

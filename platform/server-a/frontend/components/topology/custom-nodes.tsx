/**
 * Topology Flow Diagram — Custom React Flow Node Components v4
 * Large stage cards with numbered circles, equipment detail, sensor values
 * Matches process-flow reference: stage header → equipment inner card → sensors
 */

"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import type { EquipNodeData } from "./flow-layout";

/* ── Equipment Stage Card ── */

const EquipmentCardNode = memo(function EquipmentCardNode({
  data,
}: NodeProps<EquipNodeData>) {
  const isActive = data.isActive;

  /* Operation bar gradient */
  const opGrad =
    data.operationPct > 70
      ? "linear-gradient(90deg, rgb(34,211,238), rgb(52,211,153))"
      : data.operationPct > 30
      ? "linear-gradient(90deg, rgb(251,191,36), rgb(245,158,11))"
      : "linear-gradient(90deg, rgb(251,113,133), rgb(239,68,68))";

  /* Chain color with lower opacity for background */
  const chainColorBg = data.chainColor.replace("rgb(", "rgba(").replace(")", ",0.08)");
  const chainColorBorder = data.chainColor.replace("rgb(", "rgba(").replace(")", ",0.25)");
  const chainColorGlow = data.chainColor.replace("rgb(", "rgba(").replace(")", ",0.15)");

  return (
    <div
      className="rounded-2xl overflow-hidden cursor-pointer transition-all hover:scale-[1.01]"
      style={{
        width: 440,
        background: `linear-gradient(135deg, rgba(15,23,42,0.97), rgba(30,41,59,0.95))`,
        border: `1.5px solid ${chainColorBorder}`,
        boxShadow: `0 8px 32px rgba(0,0,0,0.5), 0 0 60px ${chainColorGlow}`,
      }}
    >
      {/* Connection handles */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !border-2 !border-slate-700 !-left-2"
        style={{ background: data.chainColor }}
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !border-2 !border-slate-700 !-right-2"
        style={{ background: data.chainColor }}
      />

      {/* ── Stage Header ── */}
      <div
        className="flex items-center gap-4 px-5 py-4"
        style={{ background: chainColorBg }}
      >
        {/* Numbered circle */}
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-black flex-shrink-0"
          style={{
            background: `linear-gradient(135deg, ${data.chainColor}, ${data.chainColor.replace("rgb(", "rgba(").replace(")", ",0.6)")})`,
            boxShadow: `0 0 20px ${chainColorGlow}, inset 0 1px 0 rgba(255,255,255,0.2)`,
            color: "white",
            textShadow: "0 1px 2px rgba(0,0,0,0.3)",
          }}
        >
          {data.stageIndex}
        </div>

        {/* Stage name + description */}
        <div className="flex-1 min-w-0">
          <h3 className="text-[17px] font-bold text-white tracking-tight leading-tight">
            {data.stageLabel}
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed line-clamp-2">
            {data.stageDesc}
          </p>
        </div>

        {/* Badges: operation % + sensor count */}
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          {data.isSimulated && (
            <span
              className="text-[11px] font-mono font-bold px-2.5 py-1 rounded-md"
              style={{
                background:
                  data.operationPct > 70
                    ? "rgba(52,211,153,0.15)"
                    : data.operationPct > 30
                    ? "rgba(251,191,36,0.15)"
                    : "rgba(251,113,133,0.15)",
                color:
                  data.operationPct > 70
                    ? "rgb(52,211,153)"
                    : data.operationPct > 30
                    ? "rgb(251,191,36)"
                    : "rgb(251,113,133)",
              }}
            >
              {data.operationPct}%
            </span>
          )}
          {data.sensorCount > 0 && (
            <span className="text-[10px] font-mono text-slate-500 bg-white/5 px-2 py-0.5 rounded">
              S:{data.sensorCount}
            </span>
          )}
        </div>
      </div>

      {/* ── Inner Equipment Detail Card ── */}
      <div className="mx-4 my-3 rounded-xl bg-slate-800/80 border border-white/[0.06] overflow-hidden">
        {/* Equipment ID + Status */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="w-2 h-2 rounded-sm flex-shrink-0"
              style={{ background: data.chainColor }}
            />
            <span className="text-[13px] font-semibold text-slate-200 truncate">
              {data.displayName}
            </span>
          </div>

          {data.isSimulated && (
            <span
              className={`text-[10px] font-mono font-bold flex items-center gap-1.5 flex-shrink-0 px-2.5 py-1 rounded-md ${
                isActive
                  ? "text-emerald-400 bg-emerald-500/10 border border-emerald-500/20"
                  : "text-rose-400 bg-rose-500/10 border border-rose-500/20"
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isActive
                    ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"
                    : "bg-rose-400 shadow-[0_0_6px_rgba(251,113,133,0.6)]"
                }`}
              />
              {isActive ? "RUN" : "STOP"}
            </span>
          )}
        </div>

        {/* Operation Progress Bar */}
        {data.isSimulated && (
          <div className="px-4 py-3">
            <div className="flex justify-between items-center text-[10px] mb-2">
              <span className="text-slate-500 uppercase tracking-widest font-semibold">
                Operation
              </span>
              <span className="text-white font-mono font-bold text-[14px]">
                {data.operationPct}%
              </span>
            </div>
            <div className="w-full h-[10px] bg-white/[0.06] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${data.operationPct}%`,
                  background: opGrad,
                  boxShadow:
                    data.operationPct > 0
                      ? `0 0 12px ${
                          data.operationPct > 70
                            ? "rgba(52,211,153,0.4)"
                            : data.operationPct > 30
                            ? "rgba(251,191,36,0.4)"
                            : "rgba(251,113,133,0.4)"
                        }`
                      : "none",
                }}
              />
            </div>
          </div>
        )}

        {/* Sensor Values */}
        {data.sensorValues.length > 0 && (
          <div className="px-4 pb-3 space-y-1.5">
            <div className="text-[9px] text-slate-600 uppercase tracking-widest font-semibold mb-1">
              Sensors
            </div>
            {data.sensorValues.map((sv) => (
              <div
                key={sv.label}
                className="flex justify-between items-center text-[11px]"
              >
                <span className="text-slate-500 truncate mr-3">{sv.label}</span>
                <span className="text-slate-200 font-mono whitespace-nowrap font-medium">
                  {sv.value !== null ? sv.value.toFixed(1) : "--"}
                  <span className="text-slate-600 ml-1 text-[10px]">
                    {sv.unit}
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Empty state when no sensors and not simulated */}
        {!data.isSimulated && data.sensorValues.length === 0 && (
          <div className="px-4 py-4 text-center">
            <span className="text-[11px] text-slate-600 italic">
              시뮬레이션 대기 중
            </span>
          </div>
        )}
      </div>

      {/* ── Bottom bar: sensor count summary ── */}
      <div className="flex items-center justify-between px-5 pb-3 pt-0">
        <span className="text-[9px] text-slate-600 font-mono uppercase tracking-wider">
          {data.name}
        </span>
        {data.sensorCount > 0 && (
          <span className="text-[9px] text-slate-500 font-mono">
            +{data.sensorCount} sensors
          </span>
        )}
      </div>
    </div>
  );
});

/* ── Export Node Types Map ── */

export const nodeTypes = {
  equipmentCard: EquipmentCardNode,
};

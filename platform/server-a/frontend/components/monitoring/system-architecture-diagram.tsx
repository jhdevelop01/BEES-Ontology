"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, ChevronUp, Network } from "lucide-react";
import { ARCH_NODES, ARCH_CONNECTIONS, NODE_MAP } from "./architecture-data";
import { ArchitectureServerNode, type HealthStatus } from "./architecture-server-node";
import { ArchitectureFlowLine } from "./architecture-flow-line";
import { useServerHealth } from "./use-server-health";

/**
 * System Architecture Diagram
 *
 * Visualizes the 9-service digital twin platform as an interactive
 * node-and-edge diagram with real-time health status.
 *
 * - Desktop (lg+): full 3D perspective view
 * - Mobile (sm): collapsed banner with summary
 */
export function SystemArchitectureDiagram() {
  const t = useTranslations("monitoring");
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { servers, infrastructure, loading, lastUpdated } =
    useServerHealth(isCollapsed);

  // Container ref for SVG coordinate mapping
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgSize, setSvgSize] = useState({ w: 1000, h: 340 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) {
        setSvgSize({ w: width, h: height });
      }
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Build health status lookup: node.id → HealthStatus
  const healthMap = useMemo(() => {
    const map: Record<string, HealthStatus> = {};
    for (const s of [...servers, ...infrastructure]) {
      map[s.id] = s.status as HealthStatus;
    }
    // Frontend is online if this code is running and API responded
    if (!loading && servers.length > 0) {
      map["frontend"] = "online";
    }
    return map;
  }, [servers, infrastructure, loading]);

  // Floating particle positions — computed once to avoid re-randomizing on rerender
  const particles = useMemo(
    () =>
      Array.from({ length: 8 }, (_, i) => ({
        cx: 10 + (i * 12) + (i % 3) * 5,
        cy: 15 + ((i * 37) % 70),
        r: 1 + (i % 3) * 0.4,
      })),
    []
  );

  // Summary counts
  const allStatuses = [...servers, ...infrastructure];
  const onlineCount = allStatuses.filter((s) => s.status === "online").length;
  const totalCount = ARCH_NODES.length;

  // Convert percentage position to pixel position for SVG
  const toPixel = (pos: { x: number; y: number }) => ({
    x: (pos.x / 100) * svgSize.w,
    y: (pos.y / 100) * svgSize.h,
  });

  return (
    <div
      className="rounded-xl overflow-hidden transition-all duration-300"
      style={{
        background: "rgba(255,255,255,0.02)",
        backdropFilter: "blur(16px)",
        border: "1px solid rgba(34,211,238,0.08)",
      }}
    >
      {/* ── Header ── */}
      <button
        onClick={() => setIsCollapsed((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2">
          <Network className="h-4 w-4 text-cyan-400" />
          <span className="text-sm font-medium text-white">
            {t("archTitle")}
          </span>
          {/* Summary badge — always visible */}
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${
              loading
                ? "bg-white/5 text-slate-500"
                : onlineCount === totalCount
                  ? "bg-emerald-500/15 text-emerald-400"
                  : "bg-amber-500/15 text-amber-400"
            }`}
          >
            {loading
              ? "..."
              : t("archServerStatus", { online: onlineCount, total: totalCount })}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && !isCollapsed && (
            <span className="text-[10px] text-slate-600 font-mono hidden md:inline">
              {t("archLastUpdated", {
                time: lastUpdated.toLocaleTimeString(),
              })}
            </span>
          )}
          {isCollapsed ? (
            <ChevronDown className="h-4 w-4 text-slate-500" />
          ) : (
            <ChevronUp className="h-4 w-4 text-slate-500" />
          )}
        </div>
      </button>

      {/* ── Diagram Body ── */}
      {!isCollapsed && (
        <div
          ref={containerRef}
          className="relative w-full"
          style={{ height: 340 }}
        >
          {/* Background: perspective grid with 3D tilt */}
          <div className="absolute inset-0 overflow-hidden" style={{ perspective: '1200px' }}>
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: [
                  "linear-gradient(rgba(34,211,238,0.05) 1px, transparent 1px)",
                  "linear-gradient(90deg, rgba(34,211,238,0.05) 1px, transparent 1px)",
                ].join(", "),
                backgroundSize: "40px 40px",
                transform: "rotateX(15deg)",
                transformOrigin: "center 60%",
                maskImage:
                  "radial-gradient(ellipse 70% 60% at 50% 50%, black 40%, transparent 100%)",
                WebkitMaskImage:
                  "radial-gradient(ellipse 70% 60% at 50% 50%, black 40%, transparent 100%)",
              }}
            />
          </div>

          {/* Scanline sweep effect */}
          <div className="arch-scanline absolute inset-0 pointer-events-none" />

          {/* SVG overlay — flow lines */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            viewBox={`0 0 ${svgSize.w} ${svgSize.h}`}
            preserveAspectRatio="none"
          >
            {ARCH_CONNECTIONS.map((conn) => {
              const fromNode = NODE_MAP.get(conn.from);
              const toNode = NODE_MAP.get(conn.to);
              if (!fromNode || !toNode) return null;

              const from = toPixel(fromNode.position);
              const to = toPixel(toNode.position);

              const fromStatus = healthMap[conn.from] || "unknown";
              const toStatus = healthMap[conn.to] || "unknown";
              const isActive =
                fromStatus === "online" && toStatus === "online";

              return (
                <ArchitectureFlowLine
                  key={conn.id}
                  id={conn.id}
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  protocol={conn.protocol}
                  color={conn.color}
                  isActive={isActive}
                  speed={conn.speed}
                />
              );
            })}

            {/* Floating ambient particles */}
            {particles.map((p, i) => (
              <circle
                key={`particle-${i}`}
                cx={`${p.cx}%`}
                cy={`${p.cy}%`}
                r={p.r}
                fill="rgba(34,211,238,0.15)"
                className={`float-particle-${i % 4}`}
              />
            ))}
          </svg>

          {/* Nodes — absolute positioned */}
          {ARCH_NODES.map((node) => (
            <div
              key={node.id}
              className="absolute"
              style={{
                left: `${node.position.x}%`,
                top: `${node.position.y}%`,
                transform: "translate(-50%, -50%)",
                zIndex: 10,
              }}
            >
              <ArchitectureServerNode
                node={node}
                status={healthMap[node.id] || "unknown"}
              />
            </div>
          ))}

          {/* Vignette overlay — darkens edges for depth */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse 80% 70% at 50% 50%, transparent 40%, rgba(0,0,0,0.4) 100%)",
              zIndex: 20,
            }}
          />
        </div>
      )}
    </div>
  );
}

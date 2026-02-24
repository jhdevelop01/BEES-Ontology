"use client";

import React from "react";

interface Props {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  protocol: string;
  color: string;
  isActive: boolean;
  speed: number;
}

/**
 * SVG flow line — data flow between two architecture nodes.
 *
 * Renders as a cubic bezier curve with:
 * - Animated dashes (when active)
 * - Protocol label at midpoint
 * - Arrow marker at target end
 * - Gaussian blur glow
 */
export function ArchitectureFlowLine({
  id,
  x1,
  y1,
  x2,
  y2,
  protocol,
  color,
  isActive,
  speed,
}: Props) {
  const dx = x2 - x1;
  const dy = y2 - y1;

  // Cubic bezier control points — creates smooth S-curve
  const cx1 = x1 + dx * 0.4;
  const cy1 = y1;
  const cx2 = x2 - dx * 0.4;
  const cy2 = y2;

  const path = `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`;

  // Midpoint for protocol label
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;

  const filterId = `glow-${id}`;
  const particleGlowId = `particle-glow-${id}`;
  const markerId = `arrow-${id}`;
  const pathId = `path-${id}`;

  const activeColor = isActive ? color : "#475569";
  const activeOpacity = isActive ? 0.7 : 0.25;

  return (
    <g>
      {/* Definitions — glow filter + arrow marker */}
      <defs>
        <filter id={filterId} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id={particleGlowId} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <marker
          id={markerId}
          markerWidth="6"
          markerHeight="4"
          refX="5"
          refY="2"
          orient="auto"
        >
          <polygon
            points="0 0, 6 2, 0 4"
            fill={activeColor}
            opacity={isActive ? 0.8 : 0.3}
          />
        </marker>
      </defs>

      {/* Glow layer (wider, blurred) */}
      {isActive && (
        <path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth={5}
          opacity={0.2}
          filter={`url(#${filterId})`}
        />
      )}

      {/* Main path */}
      <path
        id={pathId}
        d={path}
        fill="none"
        stroke={activeColor}
        strokeWidth={1.5}
        strokeDasharray={isActive ? "8 4" : "4 4"}
        opacity={activeOpacity}
        markerEnd={`url(#${markerId})`}
      >
        {isActive && (
          <animate
            attributeName="stroke-dashoffset"
            from="0"
            to="-12"
            dur={`${speed}s`}
            repeatCount="indefinite"
          />
        )}
      </path>

      {/* Particle trails — 3 circles following the path */}
      {isActive &&
        [0, 1, 2].map((i) => (
          <circle
            key={i}
            r={2.5}
            fill={color}
            opacity={0.9}
            filter={`url(#${particleGlowId})`}
          >
            <animateMotion
              dur={`${speed * 1.5}s`}
              repeatCount="indefinite"
              begin={`${((speed * 1.5) / 3) * i}s`}
              path={path}
            />
          </circle>
        ))}

      {/* Connection point pulse at source node */}
      {isActive && (
        <circle
          cx={x1}
          cy={y1}
          r={3}
          fill="none"
          stroke={color}
          strokeWidth={1}
          opacity={0}
        >
          <animate
            attributeName="r"
            values="3;8"
            dur="2s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="0.6;0"
            dur="2s"
            repeatCount="indefinite"
          />
        </circle>
      )}

      {/* Protocol label */}
      <g transform={`translate(${mx}, ${my})`}>
        <rect
          x={-protocol.length * 3.2}
          y={-7}
          width={protocol.length * 6.4}
          height={14}
          rx={3}
          fill="rgba(10,14,26,0.85)"
          stroke={activeColor}
          strokeWidth={0.5}
          opacity={isActive ? 0.9 : 0.4}
        />
        <text
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={8}
          fontFamily="monospace"
          fill={isActive ? color : "#64748b"}
          opacity={isActive ? 1 : 0.5}
        >
          {protocol}
        </text>
      </g>
    </g>
  );
}

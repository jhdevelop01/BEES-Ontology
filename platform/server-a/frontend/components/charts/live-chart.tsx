"use client";

import React from "react";
import { useTranslations } from "next-intl";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

/* SSE 기반 실시간 라인 차트 */

export interface ChartDataPoint {
  time: string;
  value: number;
  label?: string;
}

interface LiveChartProps {
  /** 차트 데이터 배열 */
  data: ChartDataPoint[];
  /** 차트 제목 */
  title?: string;
  /** Y축 단위 */
  unit?: string;
  /** 라인 색상 */
  color?: string;
  /** 차트 높이 (px) */
  height?: number;
  /** Y축 최소값 */
  yMin?: number;
  /** Y축 최대값 */
  yMax?: number;
}

export function LiveChart({
  data,
  title,
  unit = "",
  color = "#22d3ee",
  height = 200,
  yMin,
  yMax,
}: LiveChartProps) {
  const tc = useTranslations("common");
  return (
    <div>
      {title && (
        <p className="text-sm font-medium text-slate-200 mb-2">{title}</p>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis
            dataKey="time"
            tick={{ fontSize: 10, fill: '#94a3b8' }}
            tickLine={false}
            stroke="rgba(148,163,184,0.3)"
          />
          <YAxis
            domain={[yMin ?? "auto", yMax ?? "auto"]}
            tick={{ fontSize: 10, fill: '#94a3b8' }}
            tickLine={false}
            stroke="rgba(148,163,184,0.3)"
            unit={unit ? ` ${unit}` : ""}
          />
          <Tooltip
            contentStyle={{
              background: 'rgba(15,23,42,0.9)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              color: '#e2e8f0',
              fontSize: '12px',
            }}
            formatter={(value: number) => [
              `${value.toFixed(1)}${unit ? ` ${unit}` : ""}`,
              tc("value"),
            ]}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/* 다중 라인 차트 (여러 센서 오버레이) */

export interface MultiLineData {
  time: string;
  [key: string]: string | number;
}

interface MultiLineChartProps {
  data: MultiLineData[];
  lines: {
    key: string;
    label: string;
    color: string;
    unit?: string;
  }[];
  height?: number;
  title?: string;
}

export function MultiLineChart({
  data,
  lines,
  height = 300,
  title,
}: MultiLineChartProps) {
  return (
    <div>
      {title && (
        <p className="text-sm font-medium text-slate-200 mb-2">{title}</p>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis
            dataKey="time"
            tick={{ fontSize: 10, fill: '#94a3b8' }}
            tickLine={false}
            stroke="rgba(148,163,184,0.3)"
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#94a3b8' }}
            tickLine={false}
            stroke="rgba(148,163,184,0.3)"
          />
          <Tooltip
            contentStyle={{
              background: 'rgba(15,23,42,0.9)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              color: '#e2e8f0',
              fontSize: '12px',
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: "12px", color: "#94a3b8" }}
          />
          {lines.map((line) => (
            <Line
              key={line.key}
              type="monotone"
              dataKey={line.key}
              name={line.label}
              stroke={line.color}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

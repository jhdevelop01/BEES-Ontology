"use client";

import React from "react";
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
  color = "#3b82f6",
  height = 200,
  yMin,
  yMax,
}: LiveChartProps) {
  return (
    <div>
      {title && (
        <p className="text-sm font-medium text-gray-700 mb-2">{title}</p>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="time"
            tick={{ fontSize: 10, fill: "#9ca3af" }}
            tickLine={false}
            axisLine={{ stroke: "#e5e7eb" }}
          />
          <YAxis
            domain={[yMin ?? "auto", yMax ?? "auto"]}
            tick={{ fontSize: 10, fill: "#9ca3af" }}
            tickLine={false}
            axisLine={{ stroke: "#e5e7eb" }}
            unit={unit ? ` ${unit}` : ""}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "white",
              border: "1px solid #e5e7eb",
              borderRadius: "8px",
              fontSize: "12px",
            }}
            formatter={(value: number) => [
              `${value.toFixed(1)}${unit ? ` ${unit}` : ""}`,
              "값",
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
        <p className="text-sm font-medium text-gray-700 mb-2">{title}</p>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="time"
            tick={{ fontSize: 10, fill: "#9ca3af" }}
            tickLine={false}
            axisLine={{ stroke: "#e5e7eb" }}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#9ca3af" }}
            tickLine={false}
            axisLine={{ stroke: "#e5e7eb" }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "white",
              border: "1px solid #e5e7eb",
              borderRadius: "8px",
              fontSize: "12px",
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: "12px" }}
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

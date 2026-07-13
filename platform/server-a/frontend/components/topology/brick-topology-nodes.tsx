/**
 * Brick Schema 개념 토폴로지 — Custom React Flow Nodes
 *
 * 카테고리(space/equipment/point)별 커스텀 노드 컴포넌트.
 * 색상은 brick-topology-data.ts 의 CATEGORY_META 를 단일 진실원으로 사용.
 * 라이브 데이터 없음 — 정적 개념도.
 */

"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import {
  Building2,
  Layers,
  Users,
  Briefcase,
  Cog,
  Fan,
  SlidersHorizontal,
  Snowflake,
  Flame,
  Waves,
  Gauge,
  Thermometer,
  Droplet,
  Wind,
  Wrench,
  Zap,
  // ── 라이브 온톨로지(iconForNode) 매핑 확장분 ──
  MapPin,
  Server,
  Boxes,
  Square,
  Box,
  Circle,
  Cpu,
  GitMerge,
  Grid3x3,
  MoveVertical,
  ToggleLeft,
  TriangleAlert,
  UserCheck,
  // ── 드릴다운 확장 인디케이터 ──
  ChevronRight,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";
import {
  CATEGORY_META,
  type BrickCategory,
  type BrickTreeNodeData,
  type BrickFloorHeaderData,
} from "./brick-topology-data";

/* ── 아이콘 매핑 (데이터의 icon 문자열 → lucide 컴포넌트) ──
 * data.ts 의 iconForNode() 가 반환할 수 있는 모든 이름을 포함해야 미매핑 폴백을 피한다. */
const ICON_MAP: Record<string, LucideIcon> = {
  Building2,
  Layers,
  Users,
  Briefcase,
  Cog,
  Fan,
  SlidersHorizontal,
  Snowflake,
  Flame,
  Waves,
  Gauge,
  Thermometer,
  Droplet,
  Wind,
  Wrench,
  Zap,
  MapPin,
  Server,
  Boxes,
  Square,
  Box,
  Circle,
  Cpu,
  GitMerge,
  Grid3x3,
  MoveVertical,
  ToggleLeft,
  TriangleAlert,
  UserCheck,
};

/* ── 카테고리별 기본(폴백) 아이콘 — 미매핑 아이콘 문자열이 와도 크래시 없이 표시 ── */
const CATEGORY_FALLBACK_ICON: Record<BrickCategory, LucideIcon> = {
  space: Square,
  equipment: Box,
  point: Circle,
};

/** 아이콘 문자열 → 컴포넌트. 미매핑이면 카테고리 기본 아이콘, 그것도 없으면 Circle. */
function resolveIcon(icon: string | undefined, category: BrickCategory): LucideIcon {
  if (icon && ICON_MAP[icon]) return ICON_MAP[icon];
  return CATEGORY_FALLBACK_ICON[category] ?? Circle;
}

/* ── 숨김 Handle (상/하/좌/우 — feeds 가로, controls/hasPart 세로 대응) ── */
const HANDLE_STYLE: React.CSSProperties = {
  opacity: 0,
  width: 6,
  height: 6,
  background: "transparent",
  border: "none",
};

function EdgeHandles() {
  // source/target 를 각 위치마다 모두 배치 → 데이터가 지정한 방향 자유롭게 연결
  return (
    <>
      <Handle type="target" position={Position.Top} id="t" style={HANDLE_STYLE} />
      <Handle type="source" position={Position.Top} id="ts" style={HANDLE_STYLE} />
      <Handle type="target" position={Position.Bottom} id="b" style={HANDLE_STYLE} />
      <Handle type="source" position={Position.Bottom} id="bs" style={HANDLE_STYLE} />
      <Handle type="target" position={Position.Left} id="l" style={HANDLE_STYLE} />
      <Handle type="source" position={Position.Left} id="ls" style={HANDLE_STYLE} />
      <Handle type="target" position={Position.Right} id="r" style={HANDLE_STYLE} />
      <Handle type="source" position={Position.Right} id="rs" style={HANDLE_STYLE} />
    </>
  );
}

/* ── 공통 카드 렌더러 ── */
function BrickCard({ data }: NodeProps<BrickTreeNodeData>) {
  const meta = CATEGORY_META[data.category];
  const Icon = resolveIcon(data.icon, data.category);

  // 드릴다운 상태 (정적 다이어그램 노드엔 없을 수 있어 안전하게 boolean화)
  const expandable = !!data.expandable;
  const expanded = !!data.expanded;
  const childCount = data.childCount ?? 0;
  const collapsedHint = expandable && !expanded; // "클릭하면 열림" 상태

  return (
    <div
      className={`brick-node-card group relative flex items-center gap-2.5 rounded-lg px-3 py-2 select-none transition-all duration-200 hover:scale-[1.02] ${
        expandable ? "cursor-pointer" : "cursor-default"
      }`}
      title={
        collapsedHint
          ? `${data.labelKo} — 클릭하면 하위 ${childCount}개 펼침`
          : expanded
          ? `${data.labelKo} — 클릭하면 접힘`
          : data.labelKo
      }
      style={{
        minWidth: 148,
        maxWidth: 240, // 라이브 라벨이 길 때 노드 폭 폭주 방지
        // ── cs-nodes 다크 글래스 카드 ──
        background: "rgba(255,255,255,0.04)",
        backdropFilter: "blur(12px)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderLeft: `4px solid ${meta.accent}`,
        color: "#E2E8F0",
        // 접힌(펼칠 수 있는) 노드는 accent 글로우로 "열 수 있음" 강조
        boxShadow: collapsedHint
          ? `0 0 0 1px ${meta.accent}55, 0 0 16px ${meta.accent}30`
          : "0 4px 12px rgba(0,0,0,0.35)",
      }}
    >
      <EdgeHandles />
      <div
        className="flex-shrink-0 flex items-center justify-center rounded-md"
        style={{
          width: 30,
          height: 30,
          background: `radial-gradient(circle at 35% 30%, ${meta.accent}22, rgba(8,12,24,0.85) 75%)`,
          border: `1px solid ${meta.accent}30`,
          color: meta.accent,
        }}
      >
        <Icon
          size={18}
          strokeWidth={2}
          style={{ filter: `drop-shadow(0 0 5px ${meta.accent}80)` }}
        />
      </div>
      <div className="flex min-w-0 flex-col leading-tight">
        <span className="truncate text-[13px] font-bold text-slate-100">
          {data.labelKo}
        </span>
        <span className="truncate text-[10px] font-mono text-slate-500">
          {data.brickClass}
        </span>
      </div>

      {/* ── 확장 인디케이터 (expandable 노드만) ── */}
      {expandable && (
        <div className="ml-auto flex flex-shrink-0 items-center gap-1 pl-1">
          {childCount > 0 && (
            <span
              className="rounded-full px-1.5 py-px text-[10px] font-semibold leading-none"
              style={{
                background: `${meta.accent}22`,
                color: meta.accent,
                border: `1px solid ${meta.accent}55`,
              }}
            >
              {childCount}
            </span>
          )}
          {expanded ? (
            <ChevronDown size={16} strokeWidth={2.5} style={{ color: meta.accent }} />
          ) : (
            <ChevronRight size={16} strokeWidth={2.5} style={{ color: meta.accent }} />
          )}
        </div>
      )}
    </div>
  );
}

/* ── 층 헤더 노드 (cs FloorBandNode 헤더 스타일) ──
 * 수직 층 밴드 좌측에 큰 mono 층 라벨 + 개수. node.type = "floorHeader". */
function FloorHeaderNode({ data }: NodeProps<BrickFloorHeaderData>) {
  const accent = data.accent || "#38BDF8";
  return (
    <div
      className="relative flex flex-col justify-center rounded-xl px-5 py-4 select-none overflow-hidden"
      style={{
        minWidth: 168,
        background: "rgba(15,23,42,0.60)",
        backdropFilter: "blur(24px)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderLeft: `5px solid ${accent}`,
        boxShadow: "0 6px 20px rgba(0,0,0,0.4)",
      }}
    >
      <EdgeHandles />
      <div
        className="text-[32px] font-black font-mono tracking-tight leading-none"
        style={{ color: accent, textShadow: `0 0 18px ${accent}55` }}
      >
        {data.floorLabel}
      </div>
      <div className="mt-2 text-[13px] font-mono text-slate-500">
        <span className="text-slate-300">{data.count}</span> nodes
      </div>
    </div>
  );
}

/* 카테고리별 노드 — 동일 렌더러(색은 data.category 로 결정) */
const SpaceNode = memo(function SpaceNode(props: NodeProps<BrickTreeNodeData>) {
  return <BrickCard {...props} />;
});
const EquipmentNode = memo(function EquipmentNode(props: NodeProps<BrickTreeNodeData>) {
  return <BrickCard {...props} />;
});
const PointNode = memo(function PointNode(props: NodeProps<BrickTreeNodeData>) {
  return <BrickCard {...props} />;
});
const FloorHeaderNodeMemo = memo(FloorHeaderNode);

/* ── Export Node Types ── */
export const brickNodeTypes = {
  space: SpaceNode,
  equipment: EquipmentNode,
  point: PointNode,
  floorHeader: FloorHeaderNodeMemo,
};

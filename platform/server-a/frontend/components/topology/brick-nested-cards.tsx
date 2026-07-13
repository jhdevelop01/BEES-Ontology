/**
 * Brick Schema 중첩 포함(nested containment) 카드 UI
 *
 * 온톨로지 계층을 "상위 카드가 하위 카드를 물리적으로 감싸는" 중첩 카드로 렌더한다:
 *   건물 ⊃ 층 ⊃ 공간 ⊃ 설비 ⊃ 센서.
 *
 * 데이터 계약:
 *   - 노드 형태: BrickTreeCardNode (brick-topology-data.ts)
 *   - 데이터 훅: useBrickOntologyTree() → { root, loading, error } (brick-ontology-tree.ts)
 *   - 색/아이콘: CATEGORY_META, LEGEND_CATEGORY_ORDER (brick-topology-data.ts)
 *
 * 스타일: cs-nodes / brick-topology-nodes 의 디지털 다크 글래스 카드 톤을 따른다.
 */

"use client";

import { memo, useCallback, useMemo, useState } from "react";
import {
  // ── 카드/카테고리 기본 아이콘 ──
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
  // ── 확장/제어 아이콘 ──
  ChevronRight,
  ChevronDown,
  Loader2,
  RefreshCw,
  Maximize2,
  Minimize2,
  type LucideIcon,
} from "lucide-react";
import {
  CATEGORY_META,
  LEGEND_CATEGORY_ORDER,
  type BrickCategory,
  type BrickTreeCardNode,
} from "./brick-topology-data";
import { useBrickOntologyTree } from "./brick-ontology-tree";

/* ────────────────────────────────────────────────────────────
 * 아이콘 매핑 — brick-topology-nodes.tsx 와 동일 세트 (미매핑 폴백 방지)
 * ──────────────────────────────────────────────────────────── */
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

const CATEGORY_FALLBACK_ICON: Record<BrickCategory, LucideIcon> = {
  space: Square,
  equipment: Box,
  point: Circle,
};

function resolveIcon(icon: string | undefined, category: BrickCategory): LucideIcon {
  if (icon && ICON_MAP[icon]) return ICON_MAP[icon];
  return CATEGORY_FALLBACK_ICON[category] ?? Circle;
}

/* ────────────────────────────────────────────────────────────
 * 트리 순회 유틸
 * ──────────────────────────────────────────────────────────── */

/** children 이 있는(펼칠 수 있는) 모든 노드 id 를 수집 — "모두 펼치기"용 */
function collectExpandableIds(node: BrickTreeCardNode, acc: Set<string>): Set<string> {
  if (node.children && node.children.length > 0) {
    acc.add(node.id);
    for (const child of node.children) collectExpandableIds(child, acc);
  }
  return acc;
}

/** 초기 펼침 상태: 건물(level 0) + 층(level 1) 까지만 펼침 */
function collectInitialExpanded(node: BrickTreeCardNode, acc: Set<string>): Set<string> {
  if (node.level <= 1 && node.children && node.children.length > 0) {
    acc.add(node.id);
    for (const child of node.children) collectInitialExpanded(child, acc);
  }
  return acc;
}

/* depth(중첩 깊이) 별 좌측 들여쓰기(px) — 물리적 포함을 강조 */
const INDENT_PER_DEPTH = 14;

/* ────────────────────────────────────────────────────────────
 * 재귀 카드 <NestedCard>
 * ──────────────────────────────────────────────────────────── */
interface NestedCardProps {
  node: BrickTreeCardNode;
  depth: number;
  expanded: Set<string>;
  onToggle: (id: string) => void;
}

const NestedCard = memo(function NestedCard({
  node,
  depth,
  expanded,
  onToggle,
}: NestedCardProps) {
  const meta = CATEGORY_META[node.category];
  const Icon = resolveIcon(node.icon, node.category);

  const hasChildren = !!node.children && node.children.length > 0;
  const isOpen = hasChildren && expanded.has(node.id);

  const handleHeaderClick = useCallback(() => {
    if (hasChildren) onToggle(node.id);
  }, [hasChildren, node.id, onToggle]);

  return (
    <div
      className="brick-nested-card relative rounded-xl overflow-hidden transition-all duration-200"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderLeft: `4px solid ${meta.accent}`,
        boxShadow: isOpen
          ? `0 0 0 1px ${meta.accent}33, 0 6px 18px rgba(0,0,0,0.35)`
          : "0 3px 10px rgba(0,0,0,0.30)",
      }}
    >
      {/* ── 헤더 (클릭 → 접기/펴기) ── */}
      <button
        type="button"
        onClick={handleHeaderClick}
        disabled={!hasChildren}
        className={`group flex w-full items-center gap-2.5 px-3 py-2.5 text-left select-none transition-colors ${
          hasChildren ? "cursor-pointer hover:bg-white/[0.03]" : "cursor-default"
        }`}
        title={
          hasChildren
            ? isOpen
              ? `${node.labelKo} — 접기`
              : `${node.labelKo} — 하위 펼치기`
            : node.labelKo
        }
      >
        {/* 아이콘 (카테고리 accent 글로우) */}
        <span
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
            size={17}
            strokeWidth={2}
            style={{ filter: `drop-shadow(0 0 5px ${meta.accent}80)` }}
          />
        </span>

        {/* 라벨 + brickClass */}
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-[13px] font-bold text-slate-100">
              {node.labelKo}
            </span>
            {node.isCommon && (
              <span
                className="flex-shrink-0 rounded px-1 py-px text-[9px] font-semibold leading-none text-slate-300"
                style={{
                  background: "rgba(148,163,184,0.15)",
                  border: "1px solid rgba(148,163,184,0.30)",
                }}
              >
                공용
              </span>
            )}
          </span>
          <span className="truncate text-[10px] font-mono text-slate-500">
            {node.brickClass}
          </span>
        </span>

        {/* 우측: count 뱃지 + 셰브론 */}
        <span className="ml-auto flex flex-shrink-0 items-center gap-1.5 pl-1">
          {node.count > 0 && (
            <span
              className="rounded-full px-1.5 py-px text-[10px] font-semibold leading-none"
              style={{
                background: `${meta.accent}22`,
                color: meta.accent,
                border: `1px solid ${meta.accent}55`,
              }}
            >
              {node.count}
            </span>
          )}
          {hasChildren &&
            (isOpen ? (
              <ChevronDown size={16} strokeWidth={2.5} style={{ color: meta.accent }} />
            ) : (
              <ChevronRight size={16} strokeWidth={2.5} style={{ color: meta.accent }} />
            ))}
        </span>
      </button>

      {/* ── 중첩 children (펼침 시 카드 내부에 재귀 렌더) ── */}
      {isOpen && (
        <div
          className="flex flex-col gap-2 pb-3 pr-3 pt-0.5"
          style={{
            paddingLeft: INDENT_PER_DEPTH,
            marginLeft: 12,
            borderLeft: `2px solid ${meta.accent}33`,
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.02), rgba(0,0,0,0.10))",
          }}
        >
          {node.children.map((child) => (
            <NestedCard
              key={child.id}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
});

/* ────────────────────────────────────────────────────────────
 * 카테고리 범례
 * ──────────────────────────────────────────────────────────── */
function CategoryLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {LEGEND_CATEGORY_ORDER.map((key) => {
        const m = CATEGORY_META[key];
        return (
          <span key={key} className="flex items-center gap-1.5">
            <span
              className="inline-block h-3 w-3 rounded-sm"
              style={{
                background: `${m.accent}33`,
                border: `1px solid ${m.accent}`,
              }}
            />
            <span className="text-[11px] text-slate-400">{m.labelKo}</span>
          </span>
        );
      })}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
 * 컨테이너 <BrickNestedTopology>
 * ──────────────────────────────────────────────────────────── */
export function BrickNestedTopology() {
  const { root, loading, error } = useBrickOntologyTree();

  // 펼침 상태 = 펼쳐진 노드 id 집합. root 가 바뀌면 초기 상태 재계산.
  const initialExpanded = useMemo(
    () => (root ? collectInitialExpanded(root, new Set<string>()) : new Set<string>()),
    [root]
  );
  const [expanded, setExpanded] = useState<Set<string>>(initialExpanded);
  // root 로드/변경 시 초기 펼침 상태 동기화 (id 시그니처 비교로 무한 루프 방지)
  const initialKey = useMemo(
    () => Array.from(initialExpanded).sort().join("|"),
    [initialExpanded]
  );
  const [syncedKey, setSyncedKey] = useState<string | null>(null);
  if (initialKey !== syncedKey && root) {
    setExpanded(new Set(initialExpanded));
    setSyncedKey(initialKey);
  }

  const toggle = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    if (!root) return;
    setExpanded(collectExpandableIds(root, new Set<string>()));
  }, [root]);

  const collapseAll = useCallback(() => {
    setExpanded(new Set<string>());
  }, []);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-xl bg-gradient-to-b from-slate-950 to-[#0a1020]">
      {/* ── 툴바 ── */}
      <div className="flex flex-wrap items-center gap-3 border-b border-white/5 px-4 py-3">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={expandAll}
            className="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[12px] font-medium text-slate-300 transition-colors hover:bg-white/[0.08]"
          >
            <Maximize2 size={13} strokeWidth={2} />
            모두 펼치기
          </button>
          <button
            type="button"
            onClick={collapseAll}
            className="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[12px] font-medium text-slate-300 transition-colors hover:bg-white/[0.08]"
          >
            <Minimize2 size={13} strokeWidth={2} />
            모두 접기
          </button>
        </div>
        <div className="ml-auto">
          <CategoryLegend />
        </div>
      </div>

      {/* ── 본문 (세로 스크롤) ── */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {loading && (
          <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-3 text-slate-400">
            <Loader2 size={28} className="animate-spin" style={{ color: "#38BDF8" }} />
            <span className="text-[13px]">온톨로지 계층 불러오는 중…</span>
          </div>
        )}

        {!loading && error && (
          <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-3 text-center">
            <TriangleAlert size={28} style={{ color: "#F87171" }} />
            <span className="max-w-md text-[13px] text-slate-400">
              온톨로지 계층을 불러오지 못했습니다.
              <br />
              <span className="text-[11px] text-slate-500">{String(error)}</span>
            </span>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-1 flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[12px] font-medium text-slate-300 transition-colors hover:bg-white/[0.08]"
            >
              <RefreshCw size={13} strokeWidth={2} />
              다시 시도
            </button>
          </div>
        )}

        {!loading && !error && !root && (
          <div className="flex h-full min-h-[240px] items-center justify-center text-[13px] text-slate-500">
            표시할 온톨로지 계층이 없습니다.
          </div>
        )}

        {!loading && !error && root && (
          <div className="mx-auto max-w-3xl">
            <NestedCard node={root} depth={0} expanded={expanded} onToggle={toggle} />
          </div>
        )}
      </div>
    </div>
  );
}

export default BrickNestedTopology;

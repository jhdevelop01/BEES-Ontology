"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";
import { Header } from "@/components/layout/header";
import { useSSE } from "@/lib/sse";
import {
  getTopologyTree,
  type TopologyNode,
  type TopologyResponse,
} from "@/lib/api";
import {
  _isEquipmentByLabels,
  isComponentNode,
  getTypeIcon,
  getTypeLabel,
  EQUIPMENT_KEYWORDS,
  COMPONENT_LABELS,
} from "@/components/topology/utils";
import { BuildingOverview } from "@/components/topology/building-overview";
import { FloorDetailView } from "@/components/topology/floor-detail-view";
import { EquipmentDetailView } from "@/components/topology/equipment-detail-view";
import { SystemOverview } from "@/components/topology/system-overview";
import {
  ChevronRight,
  ChevronDown,
  Building2,
  Loader2,
  AlertCircle,
} from "lucide-react";

/* ── 트리 아이템 컴포넌트 ── */

interface TreeItemProps {
  node: TopologyNode;
  level: number;
  selectedId: string | null;
  expandedIds: Set<string>;
  onSelect: (node: TopologyNode) => void;
  onToggle: (id: string) => void;
  deviceStatusMap: Record<string, boolean>;
}

function TreeItem({
  node,
  level,
  selectedId,
  expandedIds,
  onSelect,
  onToggle,
  deviceStatusMap,
}: TreeItemProps) {
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expandedIds.has(node.id);
  const isSelected = selectedId === node.id;
  const Icon = getTypeIcon(node.type);

  const t = useTranslations("topology");
  // SSE에 존재하는 시뮬레이션 장비인지 확인
  const isSimulated = node.name in deviceStatusMap || node.id in deviceStatusMap;
  const isActive = isSimulated
    ? (deviceStatusMap[node.name] || deviceStatusMap[node.id] || false)
    : false;
  const isComponent = isComponentNode(node);
  const isEquipment = !isComponent && _isEquipmentByLabels(node);

  return (
    <div>
      <button
        className={`w-full flex items-center gap-1.5 py-1.5 px-2 text-sm rounded-md transition-colors ${
          isSelected
            ? "bg-cyan-500/10 text-cyan-400"
            : "text-slate-300 hover:bg-white/5"
        }`}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={() => {
          onSelect(node);
          if (hasChildren) onToggle(node.id);
        }}
      >
        {/* 확장/축소 아이콘 */}
        <span className="w-4 h-4 flex items-center justify-center flex-shrink-0">
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-slate-500" />
            )
          ) : (
            <span className="w-3.5" />
          )}
        </span>

        {/* 타입 아이콘 */}
        <Icon
          className={`h-4 w-4 flex-shrink-0 ${
            isSelected ? "text-cyan-400" : "text-slate-500"
          }`}
        />

        {/* 이름 */}
        <span className={`truncate flex-1 text-left ${isComponent ? "text-slate-600" : ""}`}>{node.name}</span>

        {/* 부품 태그 */}
        {isComponent && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-slate-500 flex-shrink-0">
            {t("componentTag")}
          </span>
        )}

        {/* 장비 활성 표시 — SSE 시뮬레이션 장비만 */}
        {isEquipment && isSimulated && (
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isActive ? "bg-emerald-500" : "bg-rose-400"}`} />
        )}
      </button>

      {/* 자식 노드 */}
      {hasChildren && isExpanded && (
        <div>
          {node.children!.map((child) => (
            <TreeItem
              key={child.id}
              node={child}
              level={level + 1}
              selectedId={selectedId}
              expandedIds={expandedIds}
              onSelect={onSelect}
              onToggle={onToggle}
              deviceStatusMap={deviceStatusMap}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── 메인 페이지 ── */

export default function TopologyPage() {
  const t = useTranslations("topology");
  const tc = useTranslations("common");
  const { points, devices, connected } = useSSE();
  const [treeData, setTreeData] = useState<TopologyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<TopologyNode | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  /* ── 디바이스 상태 맵 생성 ── */
  const deviceStatusMap: Record<string, boolean> = {};
  for (const [key, dev] of Object.entries(devices)) {
    deviceStatusMap[key] = dev.is_active;
    // device_id에서 bldg: 접두사 제거한 버전도 매핑
    const shortKey = key.replace("bldg:", "");
    deviceStatusMap[shortKey] = dev.is_active;
  }

  /* ── 트리 데이터 로딩 ── */
  useEffect(() => {
    const fetchTree = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getTopologyTree();
        setTreeData(data);

        // 최상위 노드 자동 확장
        if (data.tree.length > 0) {
          const initialExpanded = new Set<string>();
          data.tree.forEach((root) => {
            initialExpanded.add(root.id);
            // 건물 바로 아래 레벨(층)도 확장
            root.children?.forEach((child) => {
              initialExpanded.add(child.id);
            });
          });
          setExpandedIds(initialExpanded);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : t("topologyError"));
      } finally {
        setLoading(false);
      }
    };
    fetchTree();
  }, []);

  /* ── 트리 토글 ── */
  const handleToggle = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  /* ── 뷰 모드 결정 ── */
  const viewMode = useMemo(() => {
    if (!selectedNode) return "empty";
    const type = selectedNode.type.toLowerCase();
    if (type.includes("building")) return "building-overview";
    if (type.includes("floor") || type.includes("story")) return "floor-detail";
    if (type.includes("system")) return "system-overview";
    if (_isEquipmentByLabels(selectedNode)) return "equipment-detail";
    // zone/room도 하위 장비가 있으면 floor-detail처럼 보여줌
    return "floor-detail";
  }, [selectedNode]);

  /* ── 노드 선택 + 트리 확장 핸들러 ── */
  const handleSelectAndExpand = useCallback((node: TopologyNode) => {
    setSelectedNode(node);
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.add(node.id);
      return next;
    });
  }, []);

  /* ── 렌더 ── */
  return (
    <div className="min-h-screen">
      <Header
        title={t("title")}
        description={t("description")}
        connected={connected}
      />

      <div className="flex flex-col md:flex-row" style={{ minHeight: "calc(100vh - 64px)" }}>
        {/* 왼쪽: 트리뷰 */}
        <div className="w-full md:w-80 border-b md:border-b-0 md:border-r border-white/10 bg-white/[0.02] flex-shrink-0 overflow-y-auto max-h-[40vh] md:max-h-none md:h-auto">
          <div className="p-4 border-b border-white/10">
            <h3 className="text-sm font-semibold text-slate-200">{t("buildingStructure")}</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {treeData ? `${treeData.source}` : tc("loading")}
            </p>
          </div>

          <div className="py-2">
            {loading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-cyan-400" />
              </div>
            )}

            {error && (
              <div className="px-4 py-8 text-center">
                <AlertCircle className="h-6 w-6 text-rose-400 mx-auto mb-2" />
                <p className="text-sm text-rose-400">{error}</p>
              </div>
            )}

            {treeData &&
              treeData.tree.map((root) => (
                <TreeItem
                  key={root.id}
                  node={root}
                  level={0}
                  selectedId={selectedNode?.id || null}
                  expandedIds={expandedIds}
                  onSelect={setSelectedNode}
                  onToggle={handleToggle}
                  deviceStatusMap={deviceStatusMap}
                />
              ))}
          </div>
        </div>

        {/* 오른쪽: 상세 영역 */}
        <div className="flex-1 overflow-y-auto p-6">
          {viewMode === "empty" && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Building2 className="h-12 w-12 text-slate-700 mx-auto mb-4" />
                <p className="text-slate-500 text-sm">
                  {t("selectNode")}
                </p>
                <p className="text-slate-600 text-xs mt-1">
                  {t("selectNodeHint")}
                </p>
              </div>
            </div>
          )}

          {viewMode === "building-overview" && (
            <BuildingOverview
              node={selectedNode!}
              deviceStatusMap={deviceStatusMap}
              points={points}
              onSelectFloor={handleSelectAndExpand}
            />
          )}

          {viewMode === "floor-detail" && (
            <FloorDetailView
              node={selectedNode!}
              deviceStatusMap={deviceStatusMap}
              points={points}
              devices={devices}
              onSelectEquipment={handleSelectAndExpand}
            />
          )}

          {viewMode === "equipment-detail" && (
            <EquipmentDetailView
              node={selectedNode!}
              deviceStatusMap={deviceStatusMap}
              points={points}
              devices={devices}
            />
          )}

          {viewMode === "system-overview" && (
            <SystemOverview
              node={selectedNode!}
              deviceStatusMap={deviceStatusMap}
              points={points}
              onSelectNode={handleSelectAndExpand}
            />
          )}
        </div>
      </div>
    </div>
  );
}

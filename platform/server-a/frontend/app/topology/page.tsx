"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSSE } from "@/lib/sse";
import {
  getTopologyTree,
  type TopologyNode,
  type TopologyResponse,
} from "@/lib/api";
import {
  ChevronRight,
  ChevronDown,
  Building2,
  Layers,
  MapPin,
  Cpu,
  LayoutGrid,
  List,
  Loader2,
  AlertCircle,
  Activity,
  ExternalLink,
} from "lucide-react";

/* ── 타입 아이콘 매핑 ── */

function getTypeIcon(type: string) {
  const t = type.toLowerCase();
  if (t.includes("building")) return Building2;
  if (t.includes("floor") || t.includes("story")) return Layers;
  if (t.includes("zone") || t.includes("room") || t.includes("space"))
    return MapPin;
  return Cpu;
}

function getTypeLabel(type: string): string {
  const t = type.toLowerCase();
  if (t.includes("building")) return "건물";
  if (t.includes("floor") || t.includes("story")) return "층";
  if (t.includes("zone") || t.includes("room") || t.includes("space"))
    return "존";
  if (t.includes("system")) return "시스템";
  if (t.includes("sensor")) return "센서";
  return "장비";
}

/* ── 토폴로지 노드 ID → 모니터링 페이지용 ID 변환 ── */

function toMonitoringId(nodeId: string): string {
  // URI 형태인 경우 이름만 추출
  if (nodeId.includes("#")) {
    return "bldg:" + nodeId.split("#").pop();
  }
  if (nodeId.startsWith("bldg:")) return nodeId;
  return "bldg:" + nodeId;
}

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

  // 장비 활성 상태 확인 (name 또는 id 기반)
  const isActive =
    deviceStatusMap[node.name] || deviceStatusMap[node.id] || false;
  const isEquipment =
    node.type.toLowerCase().includes("equipment") ||
    node.type.toLowerCase().includes("ahu") ||
    node.type.toLowerCase().includes("pump") ||
    node.type.toLowerCase().includes("chiller") ||
    node.type.toLowerCase().includes("fan") ||
    node.type.toLowerCase().includes("vav");

  return (
    <div>
      <button
        className={`w-full flex items-center gap-1.5 py-1.5 px-2 text-sm rounded-md transition-colors ${
          isSelected
            ? "bg-blue-50 text-blue-700"
            : "text-gray-700 hover:bg-gray-50"
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
              <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
            )
          ) : (
            <span className="w-3.5" />
          )}
        </span>

        {/* 타입 아이콘 */}
        <Icon
          className={`h-4 w-4 flex-shrink-0 ${
            isSelected ? "text-blue-600" : "text-gray-400"
          }`}
        />

        {/* 이름 */}
        <span className="truncate flex-1 text-left">{node.name}</span>

        {/* 장비 활성 표시 */}
        {isEquipment && isActive && (
          <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
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

/* ── 장비 카드 컴포넌트 (실시간 SSE 데이터 반영) ── */

interface EquipmentCardProps {
  node: TopologyNode;
  isActive: boolean;
  sensorValues?: Array<{ name: string; value: number | null; unit: string }>;
  lastUpdate?: number | null;
}

function EquipmentCard({ node, isActive, sensorValues, lastUpdate }: EquipmentCardProps) {
  const Icon = getTypeIcon(node.type);
  const [pulse, setPulse] = useState(false);
  const prevActiveRef = useRef(isActive);

  // 상태 변경 시 pulse 애니메이션
  useEffect(() => {
    if (prevActiveRef.current !== isActive) {
      setPulse(true);
      const timer = setTimeout(() => setPulse(false), 1000);
      prevActiveRef.current = isActive;
      return () => clearTimeout(timer);
    }
  }, [isActive]);

  return (
    <Card className={`relative overflow-hidden transition-shadow ${pulse ? "ring-2 ring-blue-400 ring-opacity-50" : ""}`}>
      <div
        className={`absolute top-0 left-0 right-0 h-1 ${
          isActive ? "bg-green-500" : "bg-gray-200"
        }`}
      />
      <CardContent className="pt-4 pb-3 px-4">
        <div className="flex items-center justify-between mb-2">
          <Icon className="h-5 w-5 text-gray-400" />
          <div className="flex items-center gap-2">
            {/* LED 인디케이터 */}
            <span className={`w-2.5 h-2.5 rounded-full ${isActive ? "bg-green-500 animate-pulse" : "bg-gray-300"}`} />
            <Badge variant={isActive ? "success" : "secondary"}>
              {isActive ? "ON" : "OFF"}
            </Badge>
          </div>
        </div>
        <p className="text-sm font-medium text-gray-900 truncate">
          {node.name}
        </p>
        <p className="text-xs text-gray-500 mt-0.5">{getTypeLabel(node.type)}</p>

        {/* 실시간 센서 값 (최대 2개) */}
        {sensorValues && sensorValues.length > 0 && (
          <div className="mt-2 pt-2 border-t border-gray-100 space-y-1">
            {sensorValues.slice(0, 2).map((sv) => (
              <div key={sv.name} className="flex items-center justify-between text-xs">
                <span className="text-gray-400 truncate mr-2">{sv.name}</span>
                <span className="font-semibold text-gray-700 whitespace-nowrap">
                  {sv.value !== null ? sv.value.toFixed(1) : "--"}{" "}
                  <span className="text-gray-400 font-normal">{sv.unit}</span>
                </span>
              </div>
            ))}
          </div>
        )}

        {/* 마지막 업데이트 시간 */}
        {lastUpdate && (
          <p className="text-[10px] text-gray-300 mt-1.5">
            {new Date(lastUpdate * 1000).toLocaleTimeString("ko-KR")}
          </p>
        )}

        {/* 장비 상세 링크 */}
        <Link
          href={`/monitoring/${encodeURIComponent(toMonitoringId(node.id))}`}
          className="mt-2 flex items-center justify-center gap-1 text-xs text-blue-500 hover:text-blue-700"
          onClick={(e) => e.stopPropagation()}
        >
          상세 보기 →
        </Link>
      </CardContent>
    </Card>
  );
}

/* ── 메인 페이지 ── */

export default function TopologyPage() {
  const { points, devices, connected } = useSSE();
  const [treeData, setTreeData] = useState<TopologyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<TopologyNode | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

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
        setError(err instanceof Error ? err.message : "토폴로지 로딩 실패");
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

  /* ── 선택된 노드의 자식 장비 수집 ── */
  const getChildEquipment = (node: TopologyNode): TopologyNode[] => {
    const results: TopologyNode[] = [];
    const collect = (n: TopologyNode) => {
      const t = n.type.toLowerCase();
      if (
        t.includes("equipment") ||
        t.includes("ahu") ||
        t.includes("pump") ||
        t.includes("chiller") ||
        t.includes("fan") ||
        t.includes("vav") ||
        t.includes("fcu") ||
        t.includes("boiler")
      ) {
        results.push(n);
      }
      n.children?.forEach(collect);
    };
    node.children?.forEach(collect);
    return results;
  };

  /* ── 선택된 노드의 자식 센서 수집 ── */
  const getChildSensors = (node: TopologyNode): TopologyNode[] => {
    const results: TopologyNode[] = [];
    const collect = (n: TopologyNode) => {
      const t = n.type.toLowerCase();
      if (t.includes("sensor") || t.includes("point")) {
        results.push(n);
      }
      n.children?.forEach(collect);
    };
    node.children?.forEach(collect);
    return results;
  };

  /* ── 장비에 매칭되는 센서 값 추출 ── */
  const getSensorValuesForEquipment = useCallback(
    (eq: TopologyNode): Array<{ name: string; value: number | null; unit: string }> => {
      const results: Array<{ name: string; value: number | null; unit: string }> = [];
      const nodeName = eq.name.toLowerCase();
      const nodeId = eq.id.toLowerCase();
      for (const [pid, pdata] of Object.entries(points)) {
        const pidLower = pid.toLowerCase();
        if (pidLower.includes(nodeName) || pidLower.includes(nodeId)) {
          const shortName = pid.split(":").pop()?.replace(/_/g, " ") || pid;
          results.push({
            name: shortName,
            value: pdata.value,
            unit: pdata.unit,
          });
        }
      }
      return results;
    },
    [points]
  );

  /* ── 장비의 마지막 업데이트 시간 ── */
  const getLastUpdateForEquipment = useCallback(
    (eq: TopologyNode): number | null => {
      const dev = devices[eq.id] || devices[eq.name];
      return dev?.ts || null;
    },
    [devices]
  );

  /* ── 선택된 노드가 장비인지 ── */
  const isEquipmentNode = (node: TopologyNode): boolean => {
    const t = node.type.toLowerCase();
    return (
      t.includes("equipment") ||
      t.includes("ahu") ||
      t.includes("pump") ||
      t.includes("chiller") ||
      t.includes("fan") ||
      t.includes("vav") ||
      t.includes("fcu") ||
      t.includes("boiler")
    );
  };

  /* ── 렌더 ── */
  return (
    <div className="min-h-screen">
      <Header
        title="토폴로지"
        description="건물 계층 구조 및 장비 현황"
        connected={connected}
      />

      <div className="flex flex-col md:flex-row" style={{ minHeight: "calc(100vh - 64px)" }}>
        {/* 왼쪽: 트리뷰 */}
        <div className="w-full md:w-80 border-b md:border-b-0 md:border-r border-gray-200 bg-white flex-shrink-0 overflow-y-auto max-h-[40vh] md:max-h-none md:h-auto">
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700">건물 구조</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {treeData ? `${treeData.source}` : "로딩 중..."}
            </p>
          </div>

          <div className="py-2">
            {loading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
              </div>
            )}

            {error && (
              <div className="px-4 py-8 text-center">
                <AlertCircle className="h-6 w-6 text-red-400 mx-auto mb-2" />
                <p className="text-sm text-red-500">{error}</p>
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
          {!selectedNode ? (
            /* 빈 상태 */
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Building2 className="h-12 w-12 text-gray-200 mx-auto mb-4" />
                <p className="text-gray-400 text-sm">
                  노드를 선택하세요
                </p>
                <p className="text-gray-300 text-xs mt-1">
                  왼쪽 트리에서 건물, 층, 존, 장비를 클릭하여 상세 정보를
                  확인하세요
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* 선택된 노드 헤더 */}
              <div className="flex items-center gap-3">
                {React.createElement(getTypeIcon(selectedNode.type), {
                  className: "h-6 w-6 text-blue-600",
                })}
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    {selectedNode.name}
                  </h2>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="outline">
                      {getTypeLabel(selectedNode.type)}
                    </Badge>
                    {selectedNode.labels?.map((l) => (
                      <Badge key={l} variant="secondary" className="text-[10px]">
                        {l}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              {/* 장비 노드 선택: 상세 모니터링 링크 */}
              {isEquipmentNode(selectedNode) && (
                <Link
                  href={`/monitoring/${encodeURIComponent(toMonitoringId(selectedNode.id))}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  장비 상세 모니터링
                </Link>
              )}

              {/* 장비 노드 선택: 센서 데이터 표시 */}
              {isEquipmentNode(selectedNode) && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Activity className="h-4 w-4" />
                      센서 현재값
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {(() => {
                      const sensors = getChildSensors(selectedNode);
                      // 직접 하위 센서가 없으면 SSE points에서 매칭 시도
                      const matchedPoints: Array<{
                        id: string;
                        name: string;
                        value: number | null;
                        unit: string;
                        quality: string;
                        ts: number;
                      }> = [];

                      // 1) 자식 센서 노드 기반 매칭
                      for (const s of sensors) {
                        const point = points[s.id] || points[s.name];
                        matchedPoints.push({
                          id: s.id,
                          name: s.name,
                          value: point?.value ?? null,
                          unit: point?.unit || "",
                          quality: point?.quality || "N/A",
                          ts: point?.ts || 0,
                        });
                      }

                      // 2) SSE points에서 장비 이름 포함하는 포인트 매칭
                      if (matchedPoints.length === 0) {
                        const nodeName = selectedNode.name.toLowerCase();
                        const nodeId = selectedNode.id.toLowerCase();
                        for (const [pid, pdata] of Object.entries(points)) {
                          const pidLower = pid.toLowerCase();
                          if (
                            pidLower.includes(nodeName) ||
                            pidLower.includes(nodeId)
                          ) {
                            matchedPoints.push({
                              id: pid,
                              name: pid.split(":").pop() || pid,
                              value: pdata.value,
                              unit: pdata.unit,
                              quality: pdata.quality,
                              ts: pdata.ts,
                            });
                          }
                        }
                      }

                      if (matchedPoints.length === 0) {
                        return (
                          <p className="text-sm text-gray-400 py-4 text-center">
                            실시간 데이터 없음
                          </p>
                        );
                      }

                      return (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-gray-200">
                                <th className="text-left py-2 px-3 text-gray-500 font-medium">
                                  센서
                                </th>
                                <th className="text-right py-2 px-3 text-gray-500 font-medium">
                                  값
                                </th>
                                <th className="text-left py-2 px-3 text-gray-500 font-medium">
                                  단위
                                </th>
                                <th className="text-left py-2 px-3 text-gray-500 font-medium">
                                  상태
                                </th>
                                <th className="text-right py-2 px-3 text-gray-500 font-medium">
                                  시간
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {matchedPoints.map((mp) => (
                                <tr
                                  key={mp.id}
                                  className="border-b border-gray-50 hover:bg-gray-50"
                                >
                                  <td className="py-2 px-3 font-medium">
                                    {mp.name}
                                  </td>
                                  <td className="py-2 px-3 text-right font-semibold">
                                    {mp.value !== null
                                      ? mp.value.toFixed(2)
                                      : "--"}
                                  </td>
                                  <td className="py-2 px-3 text-gray-500">
                                    {mp.unit}
                                  </td>
                                  <td className="py-2 px-3">
                                    <Badge
                                      variant={
                                        mp.quality === "good"
                                          ? "success"
                                          : mp.quality !== "N/A"
                                          ? "warning"
                                          : "secondary"
                                      }
                                    >
                                      {mp.quality}
                                    </Badge>
                                  </td>
                                  <td className="py-2 px-3 text-right text-xs text-gray-400">
                                    {mp.ts
                                      ? new Date(
                                          mp.ts * 1000
                                        ).toLocaleTimeString("ko-KR")
                                      : "-"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>
              )}

              {/* 층/존 선택: 하위 장비 목록 */}
              {!isEquipmentNode(selectedNode) &&
                selectedNode.children &&
                selectedNode.children.length > 0 && (
                  <>
                    {/* 뷰 모드 토글 */}
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-gray-700">
                        하위 장비 ({getChildEquipment(selectedNode).length})
                      </h3>
                      <div className="flex items-center gap-1 border border-gray-200 rounded-lg p-0.5">
                        <Button
                          variant={viewMode === "grid" ? "secondary" : "ghost"}
                          size="sm"
                          className="h-7 px-2"
                          onClick={() => setViewMode("grid")}
                        >
                          <LayoutGrid className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant={viewMode === "list" ? "secondary" : "ghost"}
                          size="sm"
                          className="h-7 px-2"
                          onClick={() => setViewMode("list")}
                        >
                          <List className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    {viewMode === "grid" ? (
                      /* 그리드 뷰 */
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {getChildEquipment(selectedNode).map((eq) => {
                          const isActive =
                            deviceStatusMap[eq.name] ||
                            deviceStatusMap[eq.id] ||
                            false;
                          return (
                            <div
                              key={eq.id}
                              className="cursor-pointer"
                              onClick={() => {
                                setSelectedNode(eq);
                                setExpandedIds((prev) => {
                                  const next = new Set(prev);
                                  next.add(eq.id);
                                  return next;
                                });
                              }}
                            >
                              <EquipmentCard
                                node={eq}
                                isActive={isActive}
                                sensorValues={getSensorValuesForEquipment(eq)}
                                lastUpdate={getLastUpdateForEquipment(eq)}
                              />
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      /* 리스트 뷰 */
                      <Card>
                        <CardContent className="p-0">
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-gray-200">
                                  <th className="text-left py-2.5 px-4 text-gray-500 font-medium">
                                    이름
                                  </th>
                                  <th className="text-left py-2.5 px-4 text-gray-500 font-medium">
                                    타입
                                  </th>
                                  <th className="text-center py-2.5 px-4 text-gray-500 font-medium">
                                    상태
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {getChildEquipment(selectedNode).map((eq) => {
                                  const isActive =
                                    deviceStatusMap[eq.name] ||
                                    deviceStatusMap[eq.id] ||
                                    false;
                                  return (
                                    <tr
                                      key={eq.id}
                                      className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
                                      onClick={() => {
                                        setSelectedNode(eq);
                                        setExpandedIds((prev) => {
                                          const next = new Set(prev);
                                          next.add(eq.id);
                                          return next;
                                        });
                                      }}
                                    >
                                      <td className="py-2.5 px-4 font-medium text-gray-900">
                                        {eq.name}
                                      </td>
                                      <td className="py-2.5 px-4">
                                        <Badge variant="outline">
                                          {getTypeLabel(eq.type)}
                                        </Badge>
                                      </td>
                                      <td className="py-2.5 px-4 text-center">
                                        <Badge
                                          variant={
                                            isActive ? "success" : "secondary"
                                          }
                                        >
                                          {isActive ? "ON" : "OFF"}
                                        </Badge>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                          {getChildEquipment(selectedNode).length === 0 && (
                            <div className="py-8 text-center text-sm text-gray-400">
                              하위 장비가 없습니다
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}
                  </>
                )}

              {/* 자식 없는 비장비 노드 */}
              {!isEquipmentNode(selectedNode) &&
                (!selectedNode.children ||
                  selectedNode.children.length === 0) && (
                  <div className="text-center py-12">
                    <MapPin className="h-8 w-8 text-gray-200 mx-auto mb-3" />
                    <p className="text-sm text-gray-400">
                      하위 노드가 없습니다
                    </p>
                  </div>
                )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

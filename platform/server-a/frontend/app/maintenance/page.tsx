"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import {
  getWorkOrders,
  createWorkOrder,
  updateWorkOrder,
  getMaintenanceCalendar,
  getUsers,
  type WorkOrder,
  type CalendarEvent,
  type UserInfo,
} from "@/lib/api";
import {
  Wrench,
  Plus,
  Calendar,
  ClipboardList,
  Loader2,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

/* ── 상수 ── */

const STATUS_TABS = [
  { label: "전체", value: "" },
  { label: "요청", value: "requested" },
  { label: "진행", value: "in_progress" },
  { label: "완료", value: "completed" },
  { label: "취소", value: "cancelled" },
] as const;

const PRIORITY_OPTIONS = [
  { label: "긴급", value: "critical" },
  { label: "높음", value: "high" },
  { label: "보통", value: "medium" },
  { label: "낮음", value: "low" },
] as const;

const PRIORITY_BADGE: Record<string, "danger" | "warning" | "default" | "secondary"> = {
  critical: "danger",
  high: "warning",
  medium: "default",
  low: "secondary",
};

const PRIORITY_LABEL: Record<string, string> = {
  critical: "긴급",
  high: "높음",
  medium: "보통",
  low: "낮음",
};

const STATUS_BADGE: Record<string, "secondary" | "default" | "warning" | "success"> = {
  requested: "secondary",
  in_progress: "warning",
  completed: "success",
  cancelled: "secondary",
};

const STATUS_LABEL: Record<string, string> = {
  requested: "요청",
  in_progress: "진행",
  completed: "완료",
  cancelled: "취소",
};

/* ── 메인 페이지 ── */

export default function MaintenancePage() {
  const { addToast } = useToast();

  // 탭 / 뷰 모드
  const [activeTab, setActiveTab] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");

  // 작업 주문 목록
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  // 모달
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<WorkOrder | null>(null);

  // 캘린더
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);

  // 사용자 목록 (담당자 선택용)
  const [users, setUsers] = useState<UserInfo[]>([]);

  // 작업 주문 목록 조회
  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getWorkOrders({
        status: activeTab || undefined,
        page,
        limit: 20,
      });
      setWorkOrders(res.items);
      setTotal(res.total);
    } catch {
      setWorkOrders([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab, page]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // 사용자 목록 로드
  useEffect(() => {
    getUsers().then(setUsers).catch(() => {});
  }, []);

  // 캘린더 데이터 로드
  useEffect(() => {
    if (viewMode !== "calendar") return;
    setCalendarLoading(true);
    getMaintenanceCalendar(calendarMonth)
      .then((res) => setCalendarEvents(res.events))
      .catch(() => setCalendarEvents([]))
      .finally(() => setCalendarLoading(false));
  }, [viewMode, calendarMonth]);

  // 행 클릭 → 상세 모달
  const handleRowClick = (order: WorkOrder) => {
    setSelectedOrder(order);
    setShowDetailModal(true);
  };

  return (
    <div className="min-h-screen">
      <Header title="유지보수" description="작업 주문 및 정비 일정 관리" />

      <div className="p-3 md:p-6 space-y-6">
        {/* 상단 컨트롤 */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={viewMode === "list" ? "default" : "outline"}
              onClick={() => setViewMode("list")}
            >
              <ClipboardList className="h-4 w-4 mr-1" />
              목록
            </Button>
            <Button
              size="sm"
              variant={viewMode === "calendar" ? "default" : "outline"}
              onClick={() => setViewMode("calendar")}
            >
              <Calendar className="h-4 w-4 mr-1" />
              캘린더
            </Button>
          </div>
          <Button size="sm" onClick={() => setShowCreateModal(true)}>
            <Plus className="h-4 w-4 mr-1" />
            작업 주문 생성
          </Button>
        </div>

        {viewMode === "list" ? (
          <>
            {/* 상태 탭 */}
            <div className="flex flex-wrap gap-2">
              {STATUS_TABS.map((tab) => (
                <Button
                  key={tab.value}
                  size="sm"
                  variant={activeTab === tab.value ? "default" : "outline"}
                  onClick={() => { setActiveTab(tab.value); setPage(1); }}
                >
                  {tab.label}
                </Button>
              ))}
            </div>

            {/* 작업 주문 테이블 */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Wrench className="h-4 w-4" />
                  작업 주문 ({total}건)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-12 text-gray-400 text-sm">
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    로딩 중...
                  </div>
                ) : workOrders.length === 0 ? (
                  <div className="text-center py-12 text-gray-400 text-sm">
                    <Wrench className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p>작업 주문이 없습니다.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-2 px-3 text-gray-500 font-medium">ID</th>
                          <th className="text-left py-2 px-3 text-gray-500 font-medium">장비</th>
                          <th className="text-left py-2 px-3 text-gray-500 font-medium">제목</th>
                          <th className="text-left py-2 px-3 text-gray-500 font-medium">우선순위</th>
                          <th className="text-left py-2 px-3 text-gray-500 font-medium">상태</th>
                          <th className="text-left py-2 px-3 text-gray-500 font-medium">담당자</th>
                          <th className="text-right py-2 px-3 text-gray-500 font-medium">생성일</th>
                        </tr>
                      </thead>
                      <tbody>
                        {workOrders.map((wo) => (
                          <tr
                            key={wo.id}
                            className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
                            onClick={() => handleRowClick(wo)}
                          >
                            <td className="py-2 px-3 font-mono text-xs">#{wo.id}</td>
                            <td className="py-2 px-3 text-xs">
                              {wo.equipment_ontology_id || `장비#${wo.equipment_id}`}
                            </td>
                            <td className="py-2 px-3 font-medium">{wo.title}</td>
                            <td className="py-2 px-3">
                              <Badge variant={PRIORITY_BADGE[wo.priority] || "secondary"}>
                                {PRIORITY_LABEL[wo.priority] || wo.priority}
                              </Badge>
                            </td>
                            <td className="py-2 px-3">
                              <Badge variant={STATUS_BADGE[wo.status] || "secondary"}>
                                {STATUS_LABEL[wo.status] || wo.status}
                              </Badge>
                            </td>
                            <td className="py-2 px-3 text-xs text-gray-500">
                              {wo.assigned_to_name || (wo.assigned_to ? `User#${wo.assigned_to}` : "-")}
                            </td>
                            <td className="py-2 px-3 text-right text-xs text-gray-400">
                              {new Date(wo.created_at).toLocaleDateString("ko-KR")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* 페이지네이션 */}
                {total > 20 && (
                  <div className="flex items-center justify-center gap-2 mt-4">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      이전
                    </Button>
                    <span className="text-sm text-gray-500">
                      {page} / {Math.ceil(total / 20)}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={page >= Math.ceil(total / 20)}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      다음
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        ) : (
          /* ── 캘린더 뷰 ── */
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  유지보수 캘린더
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      const [y, m] = calendarMonth.split("-").map(Number);
                      const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
                      setCalendarMonth(prev);
                    }}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm font-medium min-w-[100px] text-center">
                    {calendarMonth}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      const [y, m] = calendarMonth.split("-").map(Number);
                      const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
                      setCalendarMonth(next);
                    }}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {calendarLoading ? (
                <div className="flex items-center justify-center py-12 text-gray-400 text-sm">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  로딩 중...
                </div>
              ) : (
                <CalendarGrid month={calendarMonth} events={calendarEvents} />
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* 생성 모달 */}
      {showCreateModal && (
        <CreateWorkOrderModal
          users={users}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            fetchOrders();
            addToast({ title: "작업 주문 생성 완료", variant: "success" });
          }}
        />
      )}

      {/* 상세 모달 */}
      {showDetailModal && selectedOrder && (
        <WorkOrderDetailModal
          order={selectedOrder}
          users={users}
          onClose={() => setShowDetailModal(false)}
          onUpdated={() => {
            setShowDetailModal(false);
            fetchOrders();
            addToast({ title: "작업 주문 수정 완료", variant: "success" });
          }}
        />
      )}
    </div>
  );
}

/* ── 캘린더 그리드 ── */

function CalendarGrid({ month, events }: { month: string; events: CalendarEvent[] }) {
  const [year, mon] = month.split("-").map(Number);
  const firstDay = new Date(year, mon - 1, 1).getDay();
  const daysInMonth = new Date(year, mon, 0).getDate();

  // 날짜별 이벤트 매핑
  const eventsByDay: Record<number, CalendarEvent[]> = {};
  for (const ev of events) {
    const d = new Date(ev.date).getDate();
    if (!eventsByDay[d]) eventsByDay[d] = [];
    eventsByDay[d].push(ev);
  }

  const cells = [];
  // 빈 셀
  for (let i = 0; i < firstDay; i++) {
    cells.push(<div key={`empty-${i}`} className="h-20 border border-gray-50" />);
  }
  // 날짜 셀
  for (let day = 1; day <= daysInMonth; day++) {
    const dayEvents = eventsByDay[day] || [];
    cells.push(
      <div key={day} className="h-20 border border-gray-100 p-1 overflow-hidden">
        <div className="text-xs font-medium text-gray-600">{day}</div>
        <div className="mt-0.5 space-y-0.5">
          {dayEvents.slice(0, 3).map((ev, i) => (
            <div
              key={i}
              className={`text-[10px] truncate px-1 rounded ${
                ev.type === "scheduled"
                  ? "bg-blue-100 text-blue-700"
                  : ev.type === "completed"
                  ? "bg-green-100 text-green-700"
                  : "bg-yellow-100 text-yellow-700"
              }`}
            >
              {ev.title}
            </div>
          ))}
          {dayEvents.length > 3 && (
            <div className="text-[10px] text-gray-400">+{dayEvents.length - 3}</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* 범례 */}
      <div className="flex gap-4 mb-3 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
          예정
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
          완료
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
          진행 중
        </div>
      </div>

      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 text-center text-xs font-medium text-gray-500 mb-1">
        {["일", "월", "화", "수", "목", "금", "토"].map((d) => (
          <div key={d} className="py-1">{d}</div>
        ))}
      </div>
      {/* 그리드 */}
      <div className="grid grid-cols-7">{cells}</div>
    </div>
  );
}

/* ── 작업 주문 생성 모달 ── */

function CreateWorkOrderModal({
  users,
  onClose,
  onCreated,
}: {
  users: UserInfo[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [equipmentId, setEquipmentId] = useState("1");
  const [priority, setPriority] = useState("medium");
  const [assignedTo, setAssignedTo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setSubmitting(true);
    setError("");
    try {
      await createWorkOrder({
        equipment_id: parseInt(equipmentId) || 1,
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        assigned_to: assignedTo ? parseInt(assignedTo) : undefined,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "생성 실패");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold">작업 주문 생성</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">장비 ID</label>
            <input
              type="number"
              value={equipmentId}
              onChange={(e) => setEquipmentId(e.target.value)}
              min="1"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">제목 *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="작업 제목 입력"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">설명</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="상세 설명 (선택)"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">우선순위</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {PRIORITY_OPTIONS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">담당자</label>
              <select
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">미배정</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              취소
            </Button>
            <Button type="submit" size="sm" disabled={submitting || !title.trim()}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
              생성
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── 작업 주문 상세 모달 ── */

function WorkOrderDetailModal({
  order,
  users,
  onClose,
  onUpdated,
}: {
  order: WorkOrder;
  users: UserInfo[];
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [status, setStatus] = useState(order.status);
  const [actualHours, setActualHours] = useState(String(order.actual_hours ?? ""));
  const [cost, setCost] = useState(String(order.cost ?? ""));
  const [notes, setNotes] = useState(order.notes || "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    setSubmitting(true);
    setError("");
    try {
      await updateWorkOrder(order.id, {
        status: status !== order.status ? status : undefined,
        actual_hours: actualHours ? parseFloat(actualHours) : undefined,
        cost: cost ? parseFloat(cost) : undefined,
        notes: notes.trim() || undefined,
      });
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "수정 실패");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold">작업 주문 #{order.id}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* 기본 정보 */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-gray-500">제목:</span>
              <p className="font-medium">{order.title}</p>
            </div>
            <div>
              <span className="text-gray-500">장비:</span>
              <p className="font-medium">{order.equipment_ontology_id || `장비#${order.equipment_id}`}</p>
            </div>
            <div>
              <span className="text-gray-500">우선순위:</span>
              <Badge variant={PRIORITY_BADGE[order.priority] || "secondary"} className="ml-1">
                {PRIORITY_LABEL[order.priority] || order.priority}
              </Badge>
            </div>
            <div>
              <span className="text-gray-500">요청자:</span>
              <p className="font-medium">{order.requested_by_name || "-"}</p>
            </div>
            <div>
              <span className="text-gray-500">생성일:</span>
              <p className="text-xs">{new Date(order.created_at).toLocaleString("ko-KR")}</p>
            </div>
            {order.completed_at && (
              <div>
                <span className="text-gray-500">완료일:</span>
                <p className="text-xs">{new Date(order.completed_at).toLocaleString("ko-KR")}</p>
              </div>
            )}
          </div>

          {order.description && (
            <div>
              <span className="text-sm text-gray-500">설명:</span>
              <p className="text-sm mt-1 bg-gray-50 rounded-lg px-3 py-2">{order.description}</p>
            </div>
          )}

          <hr className="border-gray-100" />

          {/* 수정 영역 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">상태</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="requested">요청</option>
              <option value="in_progress">진행</option>
              <option value="completed">완료</option>
              <option value="cancelled">취소</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">실제 소요시간 (h)</label>
              <input
                type="number"
                step="0.5"
                value={actualHours}
                onChange={(e) => setActualHours(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">비용 (원)</label>
              <input
                type="number"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">비고</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="메모 입력"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              닫기
            </Button>
            <Button size="sm" onClick={handleSave} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              저장
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

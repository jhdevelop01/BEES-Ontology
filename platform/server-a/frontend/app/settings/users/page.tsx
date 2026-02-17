"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import {
  getCurrentUser,
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  getUserAccessLog,
  type UserInfo,
  type UserAccessLogItem,
} from "@/lib/api";
import { Users, Plus, Loader2, X, Shield, ChevronDown, ChevronUp } from "lucide-react";

/* ── 상수 ── */

const ROLE_BADGE: Record<string, "danger" | "default" | "warning" | "secondary"> = {
  admin: "danger",
  manager: "default",
  operator: "warning",
  viewer: "secondary",
};

const ROLE_LABEL: Record<string, string> = {
  admin: "관리자",
  manager: "매니저",
  operator: "운영자",
  viewer: "뷰어",
};

/* ── 메인 페이지 ── */

export default function UserManagementPage() {
  const router = useRouter();
  const { addToast } = useToast();

  // 권한 체크
  const currentUser = getCurrentUser();
  const isAdmin = currentUser?.role === "admin";

  // 사용자 목록
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [loading, setLoading] = useState(true);

  // 모달
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserInfo | null>(null);

  // 접근 로그 확장
  const [expandedUserId, setExpandedUserId] = useState<number | null>(null);
  const [accessLogs, setAccessLogs] = useState<UserAccessLogItem[]>([]);
  const [logLoading, setLogLoading] = useState(false);

  // 사용자 목록 조회
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getUsers();
      setUsers(data);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) {
      router.push("/");
      return;
    }
    fetchUsers();
  }, [isAdmin, router, fetchUsers]);

  // 접근 로그 로드
  const toggleAccessLog = async (userId: number) => {
    if (expandedUserId === userId) {
      setExpandedUserId(null);
      return;
    }
    setExpandedUserId(userId);
    setLogLoading(true);
    try {
      const res = await getUserAccessLog(userId, 20);
      setAccessLogs(res.items);
    } catch {
      setAccessLogs([]);
    } finally {
      setLogLoading(false);
    }
  };

  // 사용자 비활성화
  const handleDelete = async (user: UserInfo) => {
    if (!confirm(`${user.name}(${user.email})을 비활성화하시겠습니까?`)) return;

    try {
      await deleteUser(user.id);
      addToast({ title: "사용자 비활성화 완료", variant: "success" });
      fetchUsers();
    } catch (err) {
      addToast({
        title: "비활성화 실패",
        description: err instanceof Error ? err.message : "오류 발생",
        variant: "error",
      });
    }
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        관리자 권한이 필요합니다.
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header title="사용자 관리" description="사용자 계정 관리 (관리자 전용)" />

      <div className="p-3 md:p-6 space-y-6">
        {/* 상단 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-red-500" />
            <span className="text-sm text-gray-500">관리자 전용 페이지</span>
          </div>
          <Button size="sm" onClick={() => setShowCreateModal(true)}>
            <Plus className="h-4 w-4 mr-1" />
            사용자 추가
          </Button>
        </div>

        {/* 사용자 테이블 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              사용자 목록 ({users.length}명)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12 text-gray-400 text-sm">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                로딩 중...
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p>등록된 사용자가 없습니다.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-3 text-gray-500 font-medium">이름</th>
                      <th className="text-left py-2 px-3 text-gray-500 font-medium">이메일</th>
                      <th className="text-left py-2 px-3 text-gray-500 font-medium">역할</th>
                      <th className="text-left py-2 px-3 text-gray-500 font-medium">상태</th>
                      <th className="text-right py-2 px-3 text-gray-500 font-medium">마지막 로그인</th>
                      <th className="text-right py-2 px-3 text-gray-500 font-medium">액션</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <React.Fragment key={user.id}>
                        <tr className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="py-2 px-3 font-medium">{user.name}</td>
                          <td className="py-2 px-3 text-xs text-gray-500">{user.email}</td>
                          <td className="py-2 px-3">
                            <Badge variant={ROLE_BADGE[user.role] || "secondary"}>
                              {ROLE_LABEL[user.role] || user.role}
                            </Badge>
                          </td>
                          <td className="py-2 px-3">
                            <Badge variant={user.is_active ? "success" : "secondary"}>
                              {user.is_active ? "활성" : "비활성"}
                            </Badge>
                          </td>
                          <td className="py-2 px-3 text-right text-xs text-gray-400">
                            {user.last_login
                              ? new Date(user.last_login).toLocaleString("ko-KR")
                              : "-"}
                          </td>
                          <td className="py-2 px-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => toggleAccessLog(user.id)}
                              >
                                {expandedUserId === user.id ? (
                                  <ChevronUp className="h-3.5 w-3.5" />
                                ) : (
                                  <ChevronDown className="h-3.5 w-3.5" />
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setEditingUser(user)}
                              >
                                수정
                              </Button>
                              {user.is_active && user.id !== currentUser?.id && (
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleDelete(user)}
                                >
                                  비활성화
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                        {/* 접근 로그 확장 */}
                        {expandedUserId === user.id && (
                          <tr>
                            <td colSpan={6} className="bg-gray-50 px-6 py-3">
                              {logLoading ? (
                                <div className="flex items-center text-gray-400 text-xs">
                                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                                  로딩 중...
                                </div>
                              ) : accessLogs.length === 0 ? (
                                <p className="text-xs text-gray-400">접근 로그 없음</p>
                              ) : (
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="border-b border-gray-200">
                                      <th className="text-left py-1 px-2 text-gray-400">시각</th>
                                      <th className="text-left py-1 px-2 text-gray-400">액션</th>
                                      <th className="text-left py-1 px-2 text-gray-400">IP</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {accessLogs.map((log) => (
                                      <tr key={log.id} className="border-b border-gray-100">
                                        <td className="py-1 px-2 text-gray-500">
                                          {new Date(log.created_at).toLocaleString("ko-KR")}
                                        </td>
                                        <td className="py-1 px-2">{log.action}</td>
                                        <td className="py-1 px-2 text-gray-400 font-mono">{log.ip_address || "-"}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 생성 모달 */}
      {showCreateModal && (
        <CreateUserModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            fetchUsers();
            addToast({ title: "사용자 생성 완료", variant: "success" });
          }}
        />
      )}

      {/* 수정 모달 */}
      {editingUser && (
        <EditUserModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onUpdated={() => {
            setEditingUser(null);
            fetchUsers();
            addToast({ title: "사용자 수정 완료", variant: "success" });
          }}
        />
      )}
    </div>
  );
}

/* ── 사용자 생성 모달 ── */

function CreateUserModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("viewer");
  const [department, setDepartment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      await createUser({
        email,
        password,
        name,
        role,
        department: department || undefined,
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
        className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold">사용자 추가</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">이름 *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">이메일 *</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호 * (6자 이상)</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">역할</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="viewer">뷰어</option>
                <option value="operator">운영자</option>
                <option value="manager">매니저</option>
                <option value="admin">관리자</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">부서</label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="선택"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>취소</Button>
            <Button type="submit" size="sm" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
              추가
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── 사용자 수정 모달 ── */

function EditUserModal({
  user,
  onClose,
  onUpdated,
}: {
  user: UserInfo;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [role, setRole] = useState(user.role);
  const [isActive, setIsActive] = useState(user.is_active);
  const [name, setName] = useState(user.name);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    setSubmitting(true);
    setError("");

    try {
      await updateUser(user.id, {
        name: name !== user.name ? name : undefined,
        role: role !== user.role ? role : undefined,
        is_active: isActive !== user.is_active ? isActive : undefined,
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
        className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-sm mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold">사용자 수정</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="text-sm text-gray-500">{user.email}</div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">이름</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">역할</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="viewer">뷰어</option>
              <option value="operator">운영자</option>
              <option value="manager">매니저</option>
              <option value="admin">관리자</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="active"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded"
            />
            <label htmlFor="active" className="text-sm text-gray-700">활성 상태</label>
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={onClose}>취소</Button>
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

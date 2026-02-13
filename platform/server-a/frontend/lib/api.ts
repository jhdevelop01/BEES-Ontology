/**
 * Server A Backend API 호출 래퍼
 * 모든 API 요청을 중앙에서 관리한다.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8010";

/**
 * localStorage에서 JWT 토큰 가져오기
 */
function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("bees_token");
}

/**
 * 기본 fetch 래퍼 — JSON 응답 반환
 */
async function fetchJSON<T = unknown>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const url = `${API_BASE}${path}`;
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string>),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  // 401 → 로그인 페이지로 리다이렉트
  if (res.status === 401 && typeof window !== "undefined") {
    localStorage.removeItem("bees_token");
    localStorage.removeItem("bees_user");
    if (!window.location.pathname.startsWith("/login")) {
      window.location.href = "/login";
    }
    throw new Error("인증이 필요합니다. 로그인 페이지로 이동합니다.");
  }

  if (!res.ok) {
    const errorText = await res.text().catch(() => "Unknown error");
    throw new Error(`API 오류 (${res.status}): ${errorText}`);
  }

  return res.json();
}

// ─── 인증 ───

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: {
    id: number;
    email: string;
    name: string;
    role: string;
    department: string | null;
  };
}

export async function login(req: LoginRequest): Promise<LoginResponse> {
  const data = await fetchJSON<LoginResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(req),
  });
  // 토큰 저장
  localStorage.setItem("bees_token", data.access_token);
  localStorage.setItem("bees_user", JSON.stringify(data.user));
  return data;
}

export function logout(): void {
  localStorage.removeItem("bees_token");
  localStorage.removeItem("bees_user");
  window.location.href = "/login";
}

export function getCurrentUser(): LoginResponse["user"] | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("bees_user");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function isLoggedIn(): boolean {
  return !!getToken();
}

// ─── 대시보드 ───

export interface DashboardSummary {
  kpi: {
    active_devices: number;
    total_devices: number;
    avg_temperature: number;
    alarm_count: number;
    simulation_status: string;
  };
  devices: DeviceStatus[];
  recent_points: PointData[];
  timestamp: number;
}

export interface DeviceStatus {
  device_id: string;
  name?: string;
  is_active: boolean;
  mode: string;
  type?: string;
  location?: string;
  ts: number | null;
}

export interface PointData {
  point_id: string;
  value: number | null;
  ts: number;
  unit: string;
  quality: string;
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  return fetchJSON<DashboardSummary>("/api/dashboard/summary");
}

// ─── 제어 ───

export interface ControlCommand {
  deviceId: string;
  command: string;
  params?: Record<string, unknown>;
  userId?: number;
}

export interface ControlResponse {
  success: boolean;
  message: string;
  deviceId: string;
  command: string;
}

export async function sendControlCommand(
  cmd: ControlCommand
): Promise<ControlResponse> {
  return fetchJSON<ControlResponse>("/api/control", {
    method: "POST",
    body: JSON.stringify(cmd),
  });
}

// ─── 장비 상태 ───

export interface DeviceStatusResponse {
  devices: DeviceStatus[];
  total: number;
  active: number;
}

export async function getDeviceStatus(): Promise<DeviceStatusResponse> {
  return fetchJSON<DeviceStatusResponse>("/api/devices/status");
}

// ─── 토폴로지 ───

export interface TopologyNode {
  id: string;
  name: string;
  type: string;
  labels?: string[];
  description?: string;
  children?: TopologyNode[];
}

export interface TopologyResponse {
  tree: TopologyNode[];
  source: string;
}

export async function getTopologyTree(): Promise<TopologyResponse> {
  return fetchJSON<TopologyResponse>("/api/topology/tree");
}

// ─── 온톨로지 검색 ───

export interface SearchResult {
  uri: string;
  labels: string[];
  name: string;
}

export interface SearchResponse {
  query: string;
  count: number;
  results: SearchResult[];
}

export async function searchOntology(
  query: string,
  limit: number = 20
): Promise<SearchResponse> {
  return fetchJSON<SearchResponse>(
    `/api/ontology/search?q=${encodeURIComponent(query)}&limit=${limit}`
  );
}

// ─── 시계열 이력 ───

export interface HistoryResponse {
  point_id: string;
  data: PointData[];
  source?: string;
  message?: string;
}

export async function getPointHistory(
  pointId: string,
  start: string = "-1h",
  stop: string = "now()",
  aggregation: string = "mean",
  window: string = "1m"
): Promise<HistoryResponse> {
  const sp = new URLSearchParams({ start, stop, aggregation, window });
  return fetchJSON<HistoryResponse>(
    `/api/history/${encodeURIComponent(pointId)}?${sp.toString()}`
  );
}

// ─── 스트림 스냅샷 ───

export interface SnapshotResponse {
  points: Record<string, PointData>;
  devices: Record<string, DeviceStatus>;
  point_count: number;
  device_count: number;
  timestamp: number;
}

export async function getStreamSnapshot(): Promise<SnapshotResponse> {
  return fetchJSON<SnapshotResponse>("/api/stream/snapshot");
}

// ─── 헬스체크 ───

export async function healthCheck(): Promise<{ status: string }> {
  return fetchJSON<{ status: string }>("/health");
}

// ─── 온톨로지 그래프 ───

export interface GraphNode {
  data: {
    id: string;
    label: string;
    type: string;
    labels: string[];
    uri: string;
  };
}

export interface GraphEdge {
  data: {
    id: string;
    source: string;
    target: string;
    label: string;
    type: string;
  };
}

export interface GraphResponse {
  nodes: GraphNode[];
  edges: GraphEdge[];
  stats: {
    node_count: number;
    edge_count: number;
  };
}

export async function getOntologyGraph(params?: {
  nodeType?: string;
  floor?: string;
  limit?: number;
}): Promise<GraphResponse> {
  const sp = new URLSearchParams();
  if (params?.nodeType) sp.set("node_type", params.nodeType);
  if (params?.floor) sp.set("floor", params.floor);
  if (params?.limit) sp.set("limit", String(params.limit));
  const qs = sp.toString();
  return fetchJSON<GraphResponse>(
    `/api/ontology/graph${qs ? `?${qs}` : ""}`
  );
}

// ─── 노드 상세 ───

export interface NodeConnection {
  rel: string;
  direction: "incoming" | "outgoing";
  target_uri: string;
  target_labels: string[];
}

export interface NodeDetail {
  uri: string;
  name: string;
  labels: string[];
  type: string;
  properties: Record<string, unknown>;
  connections: NodeConnection[];
}

export async function getNodeDetail(nodeId: string): Promise<NodeDetail> {
  return fetchJSON<NodeDetail>(
    `/api/ontology/node/${encodeURIComponent(nodeId)}`
  );
}

// ─── LLM 채팅 ───

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ToolCallInfo {
  name: string;
  arguments: Record<string, unknown>;
  result_count: number;
}

export interface ChatResponse {
  response: string;
  cypher_queries: string[];
  sources: string[];
  tool_calls: ToolCallInfo[];
}

export interface ChatStatusResponse {
  available: boolean;
  model: string | null;
}

export async function sendChatMessage(
  message: string,
  history: ChatMessage[] = []
): Promise<ChatResponse> {
  return fetchJSON<ChatResponse>("/api/chat", {
    method: "POST",
    body: JSON.stringify({ message, history }),
  });
}

export async function getChatStatus(): Promise<ChatStatusResponse> {
  return fetchJSON<ChatStatusResponse>("/api/chat/status");
}

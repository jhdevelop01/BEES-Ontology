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

// ─── 장비 상세 ───

export interface EquipmentConnection {
  direction: "incoming" | "outgoing";
  rel: string;
  target_id: string;
  target_name: string;
  target_labels: string[];
}

export interface EquipmentDetail {
  id: string;
  name: string;
  brick_class: string[];
  location: string | null;
  is_active: boolean | null;
  sensors: PointData[];
  connections: EquipmentConnection[];
  metadata: Record<string, unknown>;
  properties: Record<string, unknown>;
}

export interface SensorStat {
  id: string;
  labels: string[];
  avg: number;
  min: number;
  max: number;
  data_points: number;
}

export interface PerformanceResponse {
  equipment_id: string;
  period: string;
  sensors: SensorStat[];
  uptime_pct: number | null;
}

export interface AlarmItem {
  id: number;
  equipment_id: string;
  alarm_type: string;
  severity: string;
  message: string;
  threshold_value: number | null;
  actual_value: number | null;
  onset_at: string;
  cleared_at: string | null;
  acknowledged_at: string | null;
}

export interface AlarmHistoryResponse {
  total: number;
  items: AlarmItem[];
}

export async function getEquipmentDetail(
  equipmentId: string
): Promise<EquipmentDetail> {
  return fetchJSON<EquipmentDetail>(
    `/api/equipment/${encodeURIComponent(equipmentId)}`
  );
}

export async function getEquipmentPerformance(
  equipmentId: string,
  period: string = "7d"
): Promise<PerformanceResponse> {
  return fetchJSON<PerformanceResponse>(
    `/api/equipment/${encodeURIComponent(equipmentId)}/performance?period=${period}`
  );
}

export async function getEquipmentAlarms(
  equipmentId: string,
  days: number = 30
): Promise<AlarmHistoryResponse> {
  return fetchJSON<AlarmHistoryResponse>(
    `/api/equipment/${encodeURIComponent(equipmentId)}/alarms?days=${days}`
  );
}

// ─── 감사 로그 ───

export interface AuditLogItem {
  id: number;
  user_id: number | null;
  action: string;
  target_equipment: string | null;
  old_value: string | null;
  new_value: string | null;
  source: string | null;
  ip_address: string | null;
  created_at: string;
}

export interface AuditLogResponse {
  total: number;
  items: AuditLogItem[];
}

export async function getAuditLog(params?: {
  action?: string;
  equipment?: string;
  limit?: number;
  offset?: number;
}): Promise<AuditLogResponse> {
  const sp = new URLSearchParams();
  if (params?.action) sp.set("action", params.action);
  if (params?.equipment) sp.set("equipment", params.equipment);
  if (params?.limit) sp.set("limit", String(params.limit));
  if (params?.offset) sp.set("offset", String(params.offset));
  const qs = sp.toString();
  return fetchJSON<AuditLogResponse>(
    `/api/audit-log${qs ? `?${qs}` : ""}`
  );
}

// ─── 알람 관리 ───

export interface ActiveAlarm {
  severity: string;
  equipment: string;
  type: string;
  value: number;
  threshold: number;
  ts: number;
}

export interface ActiveAlarmResponse {
  total: number;
  alarms: ActiveAlarm[];
}

export async function getActiveAlarms(params?: {
  severity?: string;
  equipment?: string;
}): Promise<ActiveAlarmResponse> {
  const sp = new URLSearchParams();
  if (params?.severity) sp.set("severity", params.severity);
  if (params?.equipment) sp.set("equipment", params.equipment);
  const qs = sp.toString();
  return fetchJSON<ActiveAlarmResponse>(
    `/api/alarms${qs ? `?${qs}` : ""}`
  );
}

export async function getAlarmHistory(params?: {
  equipment?: string;
  severity?: string;
  limit?: number;
  offset?: number;
}): Promise<AlarmHistoryResponse> {
  const sp = new URLSearchParams();
  if (params?.equipment) sp.set("equipment", params.equipment);
  if (params?.severity) sp.set("severity", params.severity);
  if (params?.limit) sp.set("limit", String(params.limit));
  if (params?.offset) sp.set("offset", String(params.offset));
  const qs = sp.toString();
  return fetchJSON<AlarmHistoryResponse>(
    `/api/alarms/history${qs ? `?${qs}` : ""}`
  );
}

export async function acknowledgeAlarm(
  alarmId: number,
  acknowledgedBy: number = 1
): Promise<{ success: boolean; message: string }> {
  return fetchJSON(`/api/alarms/${alarmId}/acknowledge?acknowledged_by=${acknowledgedBy}`, {
    method: "POST",
  });
}

export interface AlarmStats {
  stats: Record<string, number>;
  suppressed_count: number;
}

export interface SuppressedAlarm {
  alarm_id: number;
  equipment: string;
  severity: string;
  reason: string;
  suppressed_at: number;
  expires_at: number;
  remaining_seconds: number;
}

export interface SuppressedListResponse {
  total: number;
  items: SuppressedAlarm[];
}

export async function getAlarmStats(): Promise<AlarmStats> {
  return fetchJSON<AlarmStats>("/api/alarms/stats");
}

export async function suppressAlarm(
  alarmId: number,
  durationHours: number = 1,
  reason: string = ""
): Promise<{ success: boolean; message: string }> {
  return fetchJSON(`/api/alarms/${alarmId}/suppress`, {
    method: "POST",
    body: JSON.stringify({ duration_hours: durationHours, reason }),
  });
}

export async function getSuppressedAlarms(): Promise<SuppressedListResponse> {
  return fetchJSON<SuppressedListResponse>("/api/alarms/suppressed");
}

export async function unsuppressAlarm(
  alarmId: number
): Promise<{ success: boolean; message: string }> {
  return fetchJSON(`/api/alarms/suppress/${alarmId}`, {
    method: "DELETE",
  });
}

// ─── 에너지 분석 ───

export interface EnergyRealtime {
  total_kw: number;
  breakdown: Record<string, number>;
  point_count: number;
  timestamp: number;
}

export interface EnergyProfileData {
  period: string;
  window: string;
  data: Array<{
    ts: number;
    value: number;
    system?: string;
  }>;
  power_point_count: number;
}

export interface EnergyBreakdownItem {
  system?: string;
  floor?: string;
  kw: number;
}

export interface EnergyBreakdown {
  by_system: EnergyBreakdownItem[];
  by_floor: EnergyBreakdownItem[];
  timestamp: number;
}

export interface EnergyComparison {
  period: string;
  current: { total_kwh: number };
  previous: { total_kwh: number };
  change_pct: number;
}

export interface EnergyEUI {
  eui: number;
  benchmark: number;
  rating: string;
  annual_kwh: number;
  area_m2: number;
}

export async function getEnergyRealtime(): Promise<EnergyRealtime> {
  return fetchJSON<EnergyRealtime>("/api/energy/realtime");
}

export async function getEnergyProfile(
  period: string = "24h"
): Promise<EnergyProfileData> {
  return fetchJSON<EnergyProfileData>(
    `/api/energy/profile?period=${period}`
  );
}

export async function getEnergyBreakdown(): Promise<EnergyBreakdown> {
  return fetchJSON<EnergyBreakdown>("/api/energy/breakdown");
}

export async function getEnergyComparison(
  period: string = "week"
): Promise<EnergyComparison> {
  return fetchJSON<EnergyComparison>(
    `/api/energy/comparison?period=${period}`
  );
}

export async function getEnergyEUI(): Promise<EnergyEUI> {
  return fetchJSON<EnergyEUI>("/api/energy/eui");
}

// ─── 유지보수 ───

export interface WorkOrder {
  id: number;
  equipment_id: number;
  equipment_ontology_id?: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  assigned_to: number | null;
  assigned_to_name?: string;
  requested_by: number | null;
  requested_by_name?: string;
  actual_hours: number | null;
  parts_used: Record<string, unknown> | null;
  cost: number | null;
  notes: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface WorkOrderListResponse {
  items: WorkOrder[];
  total: number;
  page: number;
  pages: number;
}

export interface WorkOrderCreateRequest {
  equipment_id: number;
  title: string;
  description?: string;
  priority?: string;
  assigned_to?: number;
}

export interface WorkOrderUpdateRequest {
  status?: string;
  actual_hours?: number;
  parts_used?: Record<string, unknown>;
  cost?: number;
  notes?: string;
  assigned_to?: number;
  priority?: string;
}

export interface CalendarEvent {
  date: string;
  type: string;
  equipment: string;
  title: string;
  work_order_id?: number;
}

export interface CalendarResponse {
  month: string;
  total: number;
  events: CalendarEvent[];
}

export async function getWorkOrders(params?: {
  status?: string;
  priority?: string;
  page?: number;
  limit?: number;
}): Promise<WorkOrderListResponse> {
  const sp = new URLSearchParams();
  if (params?.status) sp.set("status", params.status);
  if (params?.priority) sp.set("priority", params.priority);
  if (params?.page) sp.set("page", String(params.page));
  if (params?.limit) sp.set("limit", String(params.limit));
  const qs = sp.toString();
  return fetchJSON<WorkOrderListResponse>(
    `/api/maintenance/work-orders${qs ? `?${qs}` : ""}`
  );
}

export async function createWorkOrder(
  req: WorkOrderCreateRequest
): Promise<WorkOrder> {
  return fetchJSON<WorkOrder>("/api/maintenance/work-orders", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

export async function getWorkOrder(id: number): Promise<WorkOrder> {
  return fetchJSON<WorkOrder>(`/api/maintenance/work-orders/${id}`);
}

export async function updateWorkOrder(
  id: number,
  req: WorkOrderUpdateRequest
): Promise<WorkOrder> {
  return fetchJSON<WorkOrder>(`/api/maintenance/work-orders/${id}`, {
    method: "PUT",
    body: JSON.stringify(req),
  });
}

export async function getMaintenanceCalendar(
  month: string
): Promise<CalendarResponse> {
  return fetchJSON<CalendarResponse>(
    `/api/maintenance/calendar?month=${encodeURIComponent(month)}`
  );
}

// ─── 보고서 ───

export interface ReportPreset {
  id: string;
  name: string;
  description: string;
  icon: string;
}

export interface ReportGenerateRequest {
  preset_id?: string;
  custom?: Record<string, unknown>;
  period: { start: string; end: string };
  format: string;
}

export interface ReportGenerateResponse {
  report_id: string;
  status: string;
  download_url: string | null;
  generated_at: string;
  data?: unknown;
}

export interface ReportHistoryItem {
  report_id: string;
  preset_id: string | null;
  format: string;
  status: string;
  generated_at: string;
  period_start: string;
  period_end: string;
}

export interface ReportHistoryResponse {
  items: ReportHistoryItem[];
  total: number;
  page: number;
  pages: number;
}

export async function getReportPresets(): Promise<ReportPreset[]> {
  return fetchJSON<ReportPreset[]>("/api/reports/presets");
}

export async function generateReport(
  req: ReportGenerateRequest
): Promise<ReportGenerateResponse> {
  return fetchJSON<ReportGenerateResponse>("/api/reports/generate", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

export async function getReportHistory(params?: {
  page?: number;
  limit?: number;
}): Promise<ReportHistoryResponse> {
  const sp = new URLSearchParams();
  if (params?.page) sp.set("page", String(params.page));
  if (params?.limit) sp.set("limit", String(params.limit));
  const qs = sp.toString();
  return fetchJSON<ReportHistoryResponse>(
    `/api/reports/history${qs ? `?${qs}` : ""}`
  );
}

export function getReportDownloadUrl(reportId: string): string {
  return `${API_BASE}/api/reports/${encodeURIComponent(reportId)}/download`;
}

// ─── 사용자 관리 ───

export interface UserInfo {
  id: number;
  email: string;
  name: string;
  role: string;
  department: string | null;
  is_active: boolean;
  created_at: string;
  last_login: string | null;
}

export interface UserCreateRequest {
  email: string;
  password: string;
  name: string;
  role?: string;
  department?: string;
}

export interface UserUpdateRequest {
  name?: string;
  role?: string;
  department?: string;
  is_active?: boolean;
}

export interface UserAccessLogItem {
  id: number;
  action: string;
  target_equipment: string | null;
  source: string | null;
  ip_address: string | null;
  created_at: string;
}

export async function getUsers(): Promise<UserInfo[]> {
  return fetchJSON<UserInfo[]>("/api/users");
}

export async function createUser(req: UserCreateRequest): Promise<UserInfo> {
  return fetchJSON<UserInfo>("/api/users", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

export async function getUser(id: number): Promise<UserInfo> {
  return fetchJSON<UserInfo>(`/api/users/${id}`);
}

export async function updateUser(
  id: number,
  req: UserUpdateRequest
): Promise<UserInfo> {
  return fetchJSON<UserInfo>(`/api/users/${id}`, {
    method: "PUT",
    body: JSON.stringify(req),
  });
}

export async function deleteUser(
  id: number
): Promise<{ message: string }> {
  return fetchJSON<{ message: string }>(`/api/users/${id}`, {
    method: "DELETE",
  });
}

export async function getUserAccessLog(
  id: number,
  limit: number = 50
): Promise<{ user_id: number; total: number; items: UserAccessLogItem[] }> {
  return fetchJSON(`/api/users/${id}/access-log?limit=${limit}`);
}

// ─── 시스템 설정 ───

export interface SystemSettings {
  building_name: string;
  timezone: string;
  units: Record<string, string>;
  dashboard_refresh: number;
  energy_rate: number;
  floor_area: number;
  alarm_config: Record<string, number>;
}

export interface SettingsUpdateRequest {
  building_name?: string;
  timezone?: string;
  units?: Record<string, string>;
  dashboard_refresh?: number;
  energy_rate?: number;
  floor_area?: number;
  alarm_config?: Record<string, number>;
}

export async function getSettings(): Promise<SystemSettings> {
  return fetchJSON<SystemSettings>("/api/settings");
}

export async function updateSettings(
  req: SettingsUpdateRequest
): Promise<SystemSettings> {
  return fetchJSON<SystemSettings>("/api/settings", {
    method: "PUT",
    body: JSON.stringify(req),
  });
}

// ─── 시나리오 관리 (Server C) ───

const EMULATOR_BASE =
  process.env.NEXT_PUBLIC_EMULATOR_URL || "http://localhost:8012";

async function fetchEmulator<T = unknown>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const url = `${EMULATOR_BASE}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string>),
  };
  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    const errorText = await res.text().catch(() => "Unknown error");
    throw new Error(`Emulator API 오류 (${res.status}): ${errorText}`);
  }
  return res.json();
}

export interface ScenarioInfo {
  name: string;
  display_name: string;
  description: string;
  occupancy?: number;
  outdoor_temp_min?: number;
  outdoor_temp_max?: number;
  hvac_mode?: string;
  solar_factor?: number;
  is_active?: boolean;
}

export interface FaultTypeInfo {
  id: string;
  name: string;
  description: string;
  required_params?: string[];
}

export interface ActiveFault {
  fault_id: string;
  fault_type: string;
  target_id: string;
  params: Record<string, unknown>;
  injected_at: string;
}

export async function getScenarios(): Promise<ScenarioInfo[]> {
  return fetchEmulator<ScenarioInfo[]>("/scenarios");
}

export async function getActiveScenario(): Promise<ScenarioInfo> {
  return fetchEmulator<ScenarioInfo>("/scenarios/active");
}

export async function loadScenario(
  name: string
): Promise<{ success: boolean; message?: string }> {
  return fetchEmulator("/scenarios/load", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export async function getFaultTypes(): Promise<FaultTypeInfo[]> {
  return fetchEmulator<FaultTypeInfo[]>("/faults/types");
}

export async function getActiveFaults(): Promise<ActiveFault[]> {
  return fetchEmulator<ActiveFault[]>("/faults/active");
}

export async function injectFault(params: {
  fault_type: string;
  target_id: string;
  params?: Record<string, unknown>;
}): Promise<{ success: boolean; fault_id?: string; error?: string }> {
  return fetchEmulator("/faults/inject", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function clearFault(
  faultId: string
): Promise<{ success: boolean; message?: string }> {
  return fetchEmulator(`/faults/${encodeURIComponent(faultId)}/clear`, {
    method: "POST",
  });
}

export async function getEmulatorDevices(): Promise<
  Array<{ device_id: string; name?: string; is_active: boolean }>
> {
  return fetchEmulator("/devices");
}

export async function getSimulationStatus(): Promise<Record<string, unknown>> {
  return fetchEmulator("/simulation/status");
}

export async function getCurrentWeather(): Promise<Record<string, unknown>> {
  return fetchEmulator("/weather/current");
}

// ─── 데이터 품질 (Server D) ───

const HISTORIAN_BASE =
  process.env.NEXT_PUBLIC_HISTORIAN_URL || "http://localhost:8013";

async function fetchHistorian<T = unknown>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const url = `${HISTORIAN_BASE}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string>),
  };
  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    const errorText = await res.text().catch(() => "Unknown error");
    throw new Error(`Historian API 오류 (${res.status}): ${errorText}`);
  }
  return res.json();
}

export interface HistorianHealth {
  status: string;
  service: string;
  version: string;
  influxdb: string;
  postgres: string;
  mqtt: string;
  uptime_seconds: number;
}

export interface MQTTWorkerStats {
  mqtt_connected: boolean;
  messages_received: number;
  points_written: number;
  alarms_saved: number;
  errors: number;
  buffer_size: number;
  quality_stats: {
    good: number;
    uncertain: number;
    bad: number;
  };
}

export interface PointSummaryItem {
  point_id: string;
  last_value: number | null;
  last_time: string | null;
  unit: string;
  record_count: number;
}

export interface PointSummaryResponse {
  total_points: number;
  points: PointSummaryItem[];
}

export async function getHistorianHealth(): Promise<HistorianHealth> {
  return fetchHistorian<HistorianHealth>("/health");
}

export async function getHistorianInfo(): Promise<{
  mqtt_worker: MQTTWorkerStats;
}> {
  return fetchHistorian("/");
}

export async function getPointsSummary(): Promise<PointSummaryResponse> {
  return fetchHistorian<PointSummaryResponse>("/data/points/summary");
}

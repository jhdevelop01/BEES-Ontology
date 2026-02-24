/**
 * System Architecture Diagram — Node & Connection Data
 * 9 platform nodes (4 servers + 4 infrastructure + 1 frontend)
 * 9 connections showing data flow between services
 * Layout: 5-column LTR data flow (Emulator → Brokers → Servers → DBs → UI)
 */

export type NodeType = "server" | "infra" | "frontend";

export interface ArchNode {
  id: string;
  label: string;
  type: NodeType;
  port: number;
  role: string;
  iconName: string;
  /** Position as percentage of container (0–100) */
  position: { x: number; y: number };
  color: string;
}

export interface ArchConnection {
  id: string;
  from: string;
  to: string;
  protocol: string;
  color: string;
  /** Animation speed in seconds (lower = faster) */
  speed: number;
}

/* ── 9 Nodes — 5-column LTR data flow ── */

export const ARCH_NODES: ArchNode[] = [
  // Col 1 — Source
  {
    id: "server-c",
    label: "Emulator",
    type: "server",
    port: 8012,
    role: "Virtual Building Simulator",
    iconName: "Cpu",
    position: { x: 8, y: 50 },
    color: "#10b981",
  },
  // Col 2 — Messaging & Control
  {
    id: "mqtt",
    label: "MQTT",
    type: "infra",
    port: 1885,
    role: "Mosquitto Broker",
    iconName: "Radio",
    position: { x: 28, y: 28 },
    color: "#22d3ee",
  },
  {
    id: "server-b",
    label: "BAS Adapter",
    type: "server",
    port: 8011,
    role: "Control Protocol Gateway",
    iconName: "ArrowLeftRight",
    position: { x: 28, y: 72 },
    color: "#8b5cf6",
  },
  // Col 3 — Core Servers
  {
    id: "server-d",
    label: "Historian",
    type: "server",
    port: 8013,
    role: "Data Collector",
    iconName: "Database",
    position: { x: 50, y: 28 },
    color: "#f97316",
  },
  {
    id: "server-a",
    label: "API Server",
    type: "server",
    port: 8010,
    role: "REST API / SSE",
    iconName: "Server",
    position: { x: 50, y: 72 },
    color: "#3b82f6",
  },
  // Col 4a — Databases
  {
    id: "influxdb",
    label: "InfluxDB",
    type: "infra",
    port: 8088,
    role: "Time Series DB",
    iconName: "BarChart3",
    position: { x: 74, y: 18 },
    color: "#06b6d4",
  },
  {
    id: "neo4j",
    label: "Neo4j",
    type: "infra",
    port: 7689,
    role: "Graph Database",
    iconName: "Share2",
    position: { x: 74, y: 60 },
    color: "#eab308",
  },
  // Col 4b — Storage & UI
  {
    id: "postgresql",
    label: "PostgreSQL",
    type: "infra",
    port: 5434,
    role: "RDBMS",
    iconName: "HardDrive",
    position: { x: 92, y: 40 },
    color: "#6366f1",
  },
  {
    id: "frontend",
    label: "Dashboard",
    type: "frontend",
    port: 3000,
    role: "Next.js UI",
    iconName: "Monitor",
    position: { x: 92, y: 82 },
    color: "#a855f7",
  },
];

/* ── 9 Connections — data flow order (LTR) ── */

export const ARCH_CONNECTIONS: ArchConnection[] = [
  {
    id: "emulator-mqtt",
    from: "server-c",
    to: "mqtt",
    protocol: "MQTT Pub",
    color: "#22d3ee",
    speed: 0.8,
  },
  {
    id: "mqtt-historian",
    from: "mqtt",
    to: "server-d",
    protocol: "MQTT Sub",
    color: "#22d3ee",
    speed: 0.8,
  },
  {
    id: "mqtt-api",
    from: "mqtt",
    to: "server-a",
    protocol: "MQTT Sub",
    color: "#22d3ee",
    speed: 0.8,
  },
  {
    id: "historian-influxdb",
    from: "server-d",
    to: "influxdb",
    protocol: "HTTP",
    color: "#f97316",
    speed: 1.5,
  },
  {
    id: "historian-postgresql",
    from: "server-d",
    to: "postgresql",
    protocol: "SQL",
    color: "#22c55e",
    speed: 1.5,
  },
  {
    id: "api-neo4j",
    from: "server-a",
    to: "neo4j",
    protocol: "Bolt",
    color: "#eab308",
    speed: 1.2,
  },
  {
    id: "api-frontend",
    from: "server-a",
    to: "frontend",
    protocol: "REST/SSE",
    color: "#a855f7",
    speed: 2.0,
  },
  {
    id: "api-bas",
    from: "server-a",
    to: "server-b",
    protocol: "REST",
    color: "#3b82f6",
    speed: 2.0,
  },
  {
    id: "bas-emulator",
    from: "server-b",
    to: "server-c",
    protocol: "REST",
    color: "#3b82f6",
    speed: 2.0,
  },
];

/** Quick lookup: node ID → ArchNode */
export const NODE_MAP = new Map(ARCH_NODES.map((n) => [n.id, n]));

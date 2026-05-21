import type Database from 'better-sqlite3';

export interface ServerConfig {
  name: string;
  version: string;
  port: number;
  dbPath?: string;
}

export interface ToolLogEntry {
  id: number;
  timestamp: string;
  tool_name: string;
  input_params: string;
  response_summary: string;
  latency_ms: number;
  session_id: string | null;
}

export interface SessionInfo {
  sessionId: string;
  createdAt: number;
  lastActivityAt: number;
}

export interface TableSchema {
  columns: ColumnDef[];
}

export interface ColumnDef {
  name: string;
  type: 'TEXT' | 'INTEGER' | 'REAL' | 'BLOB';
  primaryKey?: boolean;
  notNull?: boolean;
  defaultValue?: string | number | null;
}

export interface ToolResult<T = unknown> {
  structuredContent?: T;
  content: Array<{ type: 'text'; text: string }>;
  _meta?: Record<string, unknown>;
}

export type DatabaseInstance = Database.Database;

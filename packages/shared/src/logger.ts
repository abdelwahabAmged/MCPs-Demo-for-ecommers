import type Database from 'better-sqlite3';
import type { Request, Response } from 'express';
import type { ToolLogEntry } from './types.js';

export function initLoggerTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tool_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      tool_name TEXT NOT NULL,
      input_params TEXT,
      response_summary TEXT,
      latency_ms INTEGER,
      session_id TEXT
    )
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_tool_logs_timestamp ON tool_logs(timestamp);
    CREATE INDEX IF NOT EXISTS idx_tool_logs_tool_name ON tool_logs(tool_name);
  `);
}

export function logToolCall(
  db: Database.Database,
  toolName: string,
  inputParams: unknown,
  responseSummary: string,
  latencyMs: number,
  sessionId?: string | null,
): void {
  db.prepare(`
    INSERT INTO tool_logs (tool_name, input_params, response_summary, latency_ms, session_id)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    toolName,
    JSON.stringify(inputParams),
    responseSummary.substring(0, 500),
    Math.round(latencyMs),
    sessionId ?? null,
  );
}

export function getRecentLogs(db: Database.Database, limit = 50): ToolLogEntry[] {
  return db.prepare(
    'SELECT * FROM tool_logs ORDER BY id DESC LIMIT ?'
  ).all(limit) as ToolLogEntry[];
}

export function getLogCount(db: Database.Database, sinceHours = 24): number {
  const row = db.prepare(
    `SELECT COUNT(*) as count FROM tool_logs WHERE timestamp >= datetime('now', ?)`,
  ).get(`-${sinceHours} hours`) as { count: number };
  return row.count;
}

export function createLogApiHandler(db: Database.Database) {
  return (req: Request, res: Response): void => {
    const limit = Math.min(parseInt(req.query['limit'] as string) || 50, 500);
    const logs = getRecentLogs(db, limit);
    res.json({ logs, total: getLogCount(db) });
  };
}

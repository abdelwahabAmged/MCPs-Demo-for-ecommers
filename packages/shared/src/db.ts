import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { SessionInfo } from './types.js';

export function createDatabase(dbPath: string): Database.Database {
  const dir = dirname(dbPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  db.pragma('synchronous = NORMAL');
  db.pragma('cache_size = -20000');
  db.pragma('temp_store = MEMORY');
  return db;
}

export class SessionDataManager {
  private db: Database.Database;
  private sessions: Map<string, SessionInfo> = new Map();
  private mutableTables: string[];
  private cleanupInterval: ReturnType<typeof setInterval>;

  constructor(db: Database.Database, mutableTables: string[] = []) {
    this.db = db;
    this.mutableTables = mutableTables;

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS _sessions (
        session_id TEXT PRIMARY KEY,
        created_at INTEGER NOT NULL,
        last_activity_at INTEGER NOT NULL
      )
    `);

    this.cleanupInterval = setInterval(() => this.cleanupExpiredSessions(), 5 * 60 * 1000);
  }

  createSession(sessionId: string): void {
    const now = Date.now();

    this.db.exec('BEGIN IMMEDIATE');
    try {
      for (const table of this.mutableTables) {
        const sessionTable = this.sessionTableName(sessionId, table);
        this.db.exec(`CREATE TABLE IF NOT EXISTS "${sessionTable}" AS SELECT * FROM "${table}"`);
      }

      this.db.prepare(
        'INSERT OR REPLACE INTO _sessions (session_id, created_at, last_activity_at) VALUES (?, ?, ?)'
      ).run(sessionId, now, now);

      this.db.exec('COMMIT');
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }

    this.sessions.set(sessionId, {
      sessionId,
      createdAt: now,
      lastActivityAt: now,
    });
  }

  hasSession(sessionId: string): boolean {
    if (this.sessions.has(sessionId)) return true;
    const row = this.db.prepare('SELECT session_id FROM _sessions WHERE session_id = ?').get(sessionId) as { session_id: string } | undefined;
    return !!row;
  }

  touchSession(sessionId: string): void {
    const now = Date.now();
    const info = this.sessions.get(sessionId);
    if (info) {
      info.lastActivityAt = now;
    }
    this.db.prepare('UPDATE _sessions SET last_activity_at = ? WHERE session_id = ?').run(now, sessionId);
  }

  getSessionTable(sessionId: string, baseTable: string): string {
    return this.sessionTableName(sessionId, baseTable);
  }

  getActiveSessionCount(): number {
    const row = this.db.prepare('SELECT COUNT(*) as count FROM _sessions').get() as { count: number };
    return row.count;
  }

  cleanupExpiredSessions(): void {
    const expiryThreshold = Date.now() - 30 * 60 * 1000; // 30 minutes
    const expired = this.db.prepare(
      'SELECT session_id FROM _sessions WHERE last_activity_at < ?'
    ).all(expiryThreshold) as Array<{ session_id: string }>;

    for (const { session_id } of expired) {
      this.destroySession(session_id);
    }
  }

  destroySession(sessionId: string): void {
    for (const table of this.mutableTables) {
      const sessionTable = this.sessionTableName(sessionId, table);
      this.db.exec(`DROP TABLE IF EXISTS "${sessionTable}"`);
    }
    this.db.prepare('DELETE FROM _sessions WHERE session_id = ?').run(sessionId);
    this.sessions.delete(sessionId);
  }

  dispose(): void {
    clearInterval(this.cleanupInterval);
  }

  private sessionTableName(sessionId: string, baseTable: string): string {
    const safeId = sessionId.replace(/[^a-zA-Z0-9_-]/g, '_');
    return `session_${safeId}_${baseTable}`;
  }
}

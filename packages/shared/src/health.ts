import type { Request, Response } from 'express';
import type Database from 'better-sqlite3';
import { getLogCount, getRecentLogs } from './logger.js';

const startTime = Date.now();

export function createHealthHandler(db: Database.Database, serverName: string, getSessionCount?: () => number) {
  return (_req: Request, res: Response): void => {
    const uptimeMs = Date.now() - startTime;
    const uptimeStr = formatUptime(uptimeMs);
    const toolCallCount = getLogCount(db, 24);
    const recentLogs = getRecentLogs(db, 10);
    const memUsage = process.memoryUsage();
    const sessionCount = getSessionCount?.() ?? 0;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${serverName} — Health</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #e2e8f0; padding: 2rem; }
    .container { max-width: 900px; margin: 0 auto; }
    h1 { font-size: 1.5rem; margin-bottom: 1.5rem; color: #38bdf8; }
    .status-badge { display: inline-block; padding: 0.25rem 0.75rem; border-radius: 9999px; background: #065f46; color: #6ee7b7; font-size: 0.875rem; font-weight: 600; margin-left: 0.5rem; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
    .card { background: #1e293b; border-radius: 0.75rem; padding: 1.25rem; border: 1px solid #334155; }
    .card-label { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; margin-bottom: 0.25rem; }
    .card-value { font-size: 1.5rem; font-weight: 700; color: #f1f5f9; }
    table { width: 100%; border-collapse: collapse; background: #1e293b; border-radius: 0.75rem; overflow: hidden; border: 1px solid #334155; }
    th { text-align: left; padding: 0.75rem 1rem; background: #0f172a; color: #94a3b8; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; }
    td { padding: 0.75rem 1rem; border-top: 1px solid #334155; font-size: 0.875rem; }
    .mono { font-family: 'Fira Code', 'Cascadia Code', monospace; font-size: 0.8rem; }
  </style>
</head>
<body>
  <div class="container">
    <h1>${serverName} <span class="status-badge">Healthy</span></h1>
    <div class="grid">
      <div class="card">
        <div class="card-label">Uptime</div>
        <div class="card-value">${uptimeStr}</div>
      </div>
      <div class="card">
        <div class="card-label">Tool Calls (24h)</div>
        <div class="card-value">${toolCallCount}</div>
      </div>
      <div class="card">
        <div class="card-label">Active Sessions</div>
        <div class="card-value">${sessionCount}</div>
      </div>
      <div class="card">
        <div class="card-label">Memory (RSS)</div>
        <div class="card-value">${(memUsage.rss / 1024 / 1024).toFixed(1)} MB</div>
      </div>
    </div>
    <h2 style="font-size: 1.1rem; margin-bottom: 0.75rem; color: #cbd5e1;">Recent Tool Calls</h2>
    <table>
      <thead><tr><th>Time</th><th>Tool</th><th>Latency</th><th>Session</th></tr></thead>
      <tbody>
        ${recentLogs.length === 0 ? '<tr><td colspan="4" style="text-align:center;color:#64748b;">No tool calls yet</td></tr>' : ''}
        ${recentLogs.map(log => `
        <tr>
          <td class="mono">${log.timestamp}</td>
          <td>${log.tool_name}</td>
          <td>${log.latency_ms}ms</td>
          <td class="mono">${log.session_id ? log.session_id.substring(0, 8) + '...' : '—'}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  };
}

function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

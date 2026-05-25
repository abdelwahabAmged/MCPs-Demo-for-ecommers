import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import express from "express";
import cors from "cors";
import type { Request, Response } from "express";
import { createRateLimiter } from "./rate-limit.js";
import { createHealthHandler } from "./health.js";
import { initLoggerTable, createLogApiHandler } from "./logger.js";
import { createDatabase } from "./db.js";
import { createWellKnownRouter, createOAuthRouter } from "./oauth/index.js";
import type Database from "better-sqlite3";
import { join } from "node:path";

export interface CreateServerAppOptions {
  port?: number;
  serverName: string;
  serverVersion?: string;
  dbPath?: string;
  getSessionCount?: () => number;
}

export interface ServerApp {
  app: express.Express;
  db: Database.Database;
  start: () => void;
}

export function createServerApp(
  registerTools: (
    server: McpServer,
    db: Database.Database,
    getSessionId: () => string | undefined,
  ) => void,
  options: CreateServerAppOptions,
): ServerApp {
  const port = options.port || 3000;
  const dbPath =
    options.dbPath ||
    join(
      process.cwd(),
      "data",
      `${options.serverName.toLowerCase().replace(/\s+/g, "-")}.db`,
    );
  const db = createDatabase(dbPath);
  initLoggerTable(db);
  const app = express();
  app.use(
    cors({
      exposedHeaders: [
        "WWW-Authenticate",
        "Mcp-Session-Id",
        "Last-Event-Id",
        "Mcp-Protocol-Version",
      ],
      origin: "*",
    }),
  );
  app.use(express.json());
  app.use((_req: Request, res: Response, next) => {
    res.setHeader("ngrok-skip-browser-warning", "true");
    next();
  });

  app.get(
    "/health",
    createHealthHandler(db, options.serverName, options.getSessionCount),
  );
  app.get("/api/logs", createLogApiHandler(db));

  const transports: Record<string, StreamableHTTPServerTransport> = {};

  const createMcpServer = (
    transport: StreamableHTTPServerTransport,
  ): McpServer => {
    const server = new McpServer({
      name: options.serverName,
      version: options.serverVersion || "1.0.0",
    });

    console.log("transport", transport.sessionId);
    registerTools(server, db, () => transport.sessionId);

    return server;
  };

  const handleMcpPost = async (req: Request, res: Response) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    console.log("sessionId", sessionId);
    console.log("transports 93", transports);

    console.log("transports 93", transports.sessionId);

    try {
      let transport: StreamableHTTPServerTransport;

      if (sessionId && transports[sessionId]) {
        transport = transports[sessionId]!;
      } else if (isInitializeRequest(req.body)) {
        // New session — accept with or without a stale session ID
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (newSessionId: string) => {
            transports[newSessionId] = transport;
          },
        });

        transport.onclose = () => {
          const sid = transport.sessionId;
          if (sid && transports[sid]) {
            delete transports[sid];
          }
        };

        const server = createMcpServer(transport);
        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
        return;
      } else if (sessionId && !transports[sessionId]) {
        console.log("sessionId not found", sessionId);
        console.log("transports 122", transports.sessionId);
        // Per MCP spec: expired/unknown session → 404 tells client to re-initialize
        res.status(404).json({
          jsonrpc: "2.0",
          error: {
            code: -32000,
            message: "Session not found. Please re-initialize.",
          },
          id: req.body?.id ?? null,
        });
        return;
      } else {
        res.status(400).json({
          jsonrpc: "2.0",
          error: {
            code: -32000,
            message:
              "Bad Request: Missing session ID. Send an initialize request first.",
          },
          id: req.body?.id ?? null,
        });
        return;
      }

      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error("Error handling MCP POST:", error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: req.body?.id ?? null,
        });
      }
    }
  };

  const handleMcpGet = async (req: Request, res: Response) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (!sessionId || !transports[sessionId]) {
      res.status(400).send("Invalid or missing session ID");
      return;
    }
    await transports[sessionId]!.handleRequest(req, res);
  };

  const handleMcpDelete = async (req: Request, res: Response) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (!sessionId || !transports[sessionId]) {
      res.status(400).send("Invalid or missing session ID");
      return;
    }
    try {
      await transports[sessionId]!.handleRequest(req, res);
    } catch (error) {
      console.error("Error handling session termination:", error);
      if (!res.headersSent) {
        res.status(500).send("Error processing session termination");
      }
    }
  };

  const rateLimiter = createRateLimiter();

  // Mount MCP handlers on both /mcp and / (ChatGPT sends to root path)
  app.post("/mcp", rateLimiter, handleMcpPost);
  app.get("/mcp", handleMcpGet);
  app.delete("/mcp", handleMcpDelete);

  app.post("/", rateLimiter, handleMcpPost);
  app.get("/", handleMcpGet);
  app.delete("/", handleMcpDelete);

  const start = () => {
    app.listen(port, () => {
      console.log(
        `[${options.serverName}] MCP server listening on port ${port}`,
      );
      console.log(`  MCP endpoint: http://localhost:${port}/mcp`);
      console.log(`  Health:       http://localhost:${port}/health`);
      console.log(`  Logs API:     http://localhost:${port}/api/logs`);
    });

    process.on("SIGINT", async () => {
      console.log(`\n[${options.serverName}] Shutting down...`);
      for (const sid in transports) {
        try {
          await transports[sid]!.close();
          delete transports[sid];
        } catch (err) {
          console.error(`Error closing transport ${sid}:`, err);
        }
      }
      db.close();
      process.exit(0);
    });
  };

  return { app, db, start };
}

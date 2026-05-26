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
import {
  createBetterAuth,
  createAuthHandler,
  createMcpTokenVerifier,
  runAuthMigrations,
} from "./auth.js";
import type {
  AuthConfig,
  AuthUser,
  BetterAuthInstance,
  McpSession,
} from "./auth.js";
import type Database from "better-sqlite3";
import { join } from "node:path";

export interface CreateServerAppOptions {
  port?: number;
  serverName: string;
  serverVersion?: string;
  dbPath?: string;
  getSessionCount?: () => number;
  auth?: AuthConfig;
}

export interface ServerApp {
  app: express.Express;
  db: Database.Database;
  start: () => void;
  auth?: BetterAuthInstance;
}

export function createServerApp(
  registerTools: (
    server: McpServer,
    db: Database.Database,
    getSessionId: () => string | undefined,
    getUser: () => AuthUser | undefined,
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
      credentials: true,
    }),
  );

  let auth: BetterAuthInstance | undefined;
  let mcpVerifier: ReturnType<typeof createMcpTokenVerifier> | undefined;

  if (options.auth) {
    const baseURL = options.auth.baseURL || `http://localhost:${port}`;

    auth = createBetterAuth(db, { ...options.auth, baseURL });

    // Better Auth handler must be mounted BEFORE express.json()
    app.all("/api/auth/{*splat}", createAuthHandler(auth));

    mcpVerifier = createMcpTokenVerifier(baseURL);
  }

  app.use(express.json());
  app.use((_req: Request, res: Response, next) => {
    res.setHeader("ngrok-skip-browser-warning", "true");
    next();
  });

  const mcpWellKnownRouter = createWellKnownRouter({
    authEnabled: !!options.auth,
  });
  app.use("/.well-known", mcpWellKnownRouter);

  if (!options.auth) {
    const mcpOAuthRouter = createOAuthRouter();
    app.use("/api/mcp/oauth", mcpOAuthRouter);
  }

  app.get(
    "/health",
    createHealthHandler(db, options.serverName, options.getSessionCount),
  );
  app.get("/api/logs", createLogApiHandler(db));

  const transports: Record<string, StreamableHTTPServerTransport> = {};
  const sessionUsers = new Map<string, AuthUser>();

  const createMcpServer = (
    transport: StreamableHTTPServerTransport,
  ): McpServer => {
    const server = new McpServer({
      name: options.serverName,
      version: options.serverVersion || "1.0.0",
    });

    registerTools(
      server,
      db,
      () => transport.sessionId,
      () => {
        const sid = transport.sessionId;
        return sid ? sessionUsers.get(sid) : undefined;
      },
    );

    return server;
  };

  const resolveUserFromSession = (req: Request, sessionId: string) => {
    if (sessionUsers.has(sessionId)) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mcpSession = (req as any).mcpSession as McpSession | undefined;
    if (mcpSession?.userId) {
      const user = resolveUserFromDb(db, mcpSession.userId);
      if (user) {
        sessionUsers.set(sessionId, user);
        console.log(`[MCP] Authenticated user: ${user.name} (${user.email})`);
      }
    }
  };

  const handleMcpPost = async (req: Request, res: Response) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    try {
      let transport: StreamableHTTPServerTransport;

      if (sessionId && transports[sessionId]) {
        transport = transports[sessionId]!;
      } else if (isInitializeRequest(req.body)) {
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          enableJsonResponse: true,
          onsessioninitialized: (newSessionId: string) => {
            transports[newSessionId] = transport;
            resolveUserFromSession(req, newSessionId);
          },
        });

        transport.onclose = () => {
          const sid = transport.sessionId;
          if (sid && transports[sid]) {
            delete transports[sid];
            sessionUsers.delete(sid);
          }
        };

        const server = createMcpServer(transport);
        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
        return;
      } else if (sessionId && !transports[sessionId]) {
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

      // Resolve user from verified MCP session (set by middleware)
      if (transport.sessionId) {
        resolveUserFromSession(req, transport.sessionId);
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

  const handleMcpGet = async (
    req: Request,
    res: Response,
    next: () => void,
  ) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (!sessionId || !transports[sessionId]) {
      next();
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
  if (mcpVerifier) {
    // When auth is enabled, enforce OAuth Bearer token on MCP routes.
    // The middleware returns 401 + WWW-Authenticate for unauthenticated
    // requests, triggering the MCP OAuth flow in the client.
    const mcpAuthMiddleware = mcpVerifier.middleware();

    app.post("/mcp", rateLimiter, mcpAuthMiddleware, handleMcpPost);
    app.get("/mcp", mcpAuthMiddleware, handleMcpGet);
    app.delete("/mcp", mcpAuthMiddleware, handleMcpDelete);

    app.post("/", rateLimiter, mcpAuthMiddleware, handleMcpPost);
    app.get("/", handleMcpGet);
    app.delete("/", mcpAuthMiddleware, handleMcpDelete);
  } else {
    app.post("/mcp", rateLimiter, handleMcpPost);
    app.get("/mcp", handleMcpGet);
    app.delete("/mcp", handleMcpDelete);

    app.post("/", rateLimiter, handleMcpPost);
    app.get("/", handleMcpGet);
    app.delete("/", handleMcpDelete);
  }

  const start = () => {
    const listen = () => {
      app.listen(port, () => {
        console.log(
          `[${options.serverName}] MCP server listening on port ${port}`,
        );
        console.log(`  MCP endpoint: http://localhost:${port}/mcp`);
        console.log(`  Health:       http://localhost:${port}/health`);
        console.log(`  Logs API:     http://localhost:${port}/api/logs`);
        if (auth) {
          console.log(`  Auth:         http://localhost:${port}/api/auth`);
          console.log(`  Login:        http://localhost:${port}/login`);
        }
      });
    };

    if (options.auth) {
      const baseURL = options.auth.baseURL || `http://localhost:${port}`;
      runAuthMigrations({ ...options.auth, baseURL, db })
        .then(listen)
        .catch((err) => {
          console.error("[Auth] Migration failed:", err);
          listen();
        });
    } else {
      listen();
    }

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

  return { app, db, start, auth };
}

function resolveUserFromDb(
  db: Database.Database,
  userId: string,
): AuthUser | null {
  try {
    const row = db
      .prepare("SELECT id, name, email, image FROM user WHERE id = ?")
      .get(userId) as
      | { id: string; name: string; email: string; image: string | null }
      | undefined;
    if (!row) return null;
    return { id: row.id, name: row.name, email: row.email, image: row.image };
  } catch {
    return null;
  }
}

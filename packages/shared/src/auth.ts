import { betterAuth } from "better-auth";
import { mcp } from "better-auth/plugins";
import { toNodeHandler, fromNodeHeaders } from "better-auth/node";
import { getMigrations } from "better-auth/db/migration";
import { createMcpAuthClient } from "better-auth/plugins/mcp/client";
import type { McpSession } from "better-auth/plugins/mcp/client";
import type Database from "better-sqlite3";

export interface AuthConfig {
  secret?: string;
  socialProviders?: {
    google?: { clientId: string; clientSecret: string };
    github?: { clientId: string; clientSecret: string };
  };
  baseURL: string;
  loginPage?: string;
  trustedOrigins?: string[];
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  image?: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type BetterAuthInstance = any;

export function createBetterAuth(
  db: Database.Database,
  config: AuthConfig,
): BetterAuthInstance {
  return betterAuth({
    secret: config.secret || process.env["BETTER_AUTH_SECRET"],
    database: db,
    baseURL: config.baseURL,
    basePath: "/api/auth",
    socialProviders: config.socialProviders,
    trustedOrigins: config.trustedOrigins || ["*"],
    plugins: [
      mcp({
        loginPage: config.loginPage || `${config.baseURL}/login`,
      }),
    ],
  });
}

export function createAuthHandler(auth: BetterAuthInstance) {
  return toNodeHandler(auth);
}

export async function runAuthMigrations(
  config: AuthConfig & { db: Database.Database },
) {
  const authConfig = {
    secret: config.secret || process.env["BETTER_AUTH_SECRET"],
    database: config.db,
    baseURL: config.baseURL,
    basePath: "/api/auth",
    socialProviders: config.socialProviders,
    trustedOrigins: config.trustedOrigins || ["*"],
    plugins: [
      mcp({
        loginPage: config.loginPage || `${config.baseURL}/login`,
      }),
    ],
  };

  const { toBeCreated, toBeAdded, runMigrations } =
    await getMigrations(authConfig);

  if (toBeCreated.length > 0 || toBeAdded.length > 0) {
    console.log(
      `[Auth] Running migrations: ${toBeCreated.length} tables to create, ${toBeAdded.length} tables to alter`,
    );
    await runMigrations();
    console.log("[Auth] Migrations complete");
  }
}

export function createMcpTokenVerifier(baseURL: string) {
  return createMcpAuthClient({
    authURL: `${baseURL}/api/auth`,
  });
}

export async function getSessionUser(
  auth: BetterAuthInstance,
  headers: Record<string, string | string[] | undefined>,
): Promise<AuthUser | null> {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(headers),
    });
    if (!session?.user) return null;
    return {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      image: session.user.image,
    };
  } catch {
    return null;
  }
}

export { toNodeHandler, fromNodeHeaders, createMcpAuthClient };
export type { McpSession };

import express from "express";
import type { Request, Response } from "express";

function getBaseUrl(req: Request): string {
  const proto = req.headers["x-forwarded-proto"] || req.protocol || "http";
  const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost";
  return `${proto}://${host}`;
}

export interface WellKnownOptions {
  authEnabled?: boolean;
}

export function createWellKnownRouter(options?: WellKnownOptions): express.Router {
  const router = express.Router();
  const authEnabled = options?.authEnabled ?? false;

  router.get("/oauth-protected-resource", (req: Request, res: Response) => {
    const base = getBaseUrl(req);
    res.json({
      resource: base,
      ...(authEnabled && { authorization_servers: [base] }),
      bearer_methods_supported: ["header"],
      resource_documentation: `${base}/health`,
    });
  });

  router.get("/oauth-authorization-server", (req: Request, res: Response) => {
    const base = getBaseUrl(req);

    if (authEnabled) {
      res.json({
        issuer: base,
        authorization_endpoint: `${base}/api/auth/mcp/authorize`,
        token_endpoint: `${base}/api/auth/mcp/token`,
        registration_endpoint: `${base}/api/auth/mcp/register`,
        response_types_supported: ["code"],
        grant_types_supported: ["authorization_code", "refresh_token"],
        code_challenge_methods_supported: ["S256"],
        scopes_supported: ["openid", "profile", "email", "offline_access"],
        token_endpoint_auth_methods_supported: ["none"],
      });
    } else {
      res.json({
        issuer: base,
        authorization_endpoint: `${base}/authorize`,
        token_endpoint: `${base}/token`,
        response_types_supported: ["code"],
        grant_types_supported: ["authorization_code"],
        code_challenge_methods_supported: ["S256"],
        registration_endpoint: `${base}/api/mcp/oauth/register`,
      });
    }
  });

  return router;
}

import express from "express";
import type { Request, Response } from "express";

function getBaseUrl(req: Request): string {
  const proto = req.headers["x-forwarded-proto"] || req.protocol || "http";
  const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost";
  return `${proto}://${host}`;
}

export function createWellKnownRouter(): express.Router {
  const router = express.Router();

  router.get("/oauth-protected-resource", (req: Request, res: Response) => {
    const base = getBaseUrl(req);
    res.json({
      resource: base,
      bearer_methods_supported: ["header"],
      resource_documentation: `${base}/health`,
    });
  });

  router.get("/oauth-authorization-server", (req: Request, res: Response) => {
    const base = getBaseUrl(req);
    res.json({
      issuer: base,
      authorization_endpoint: `${base}/authorize`,
      token_endpoint: `${base}/token`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code"],
      code_challenge_methods_supported: ["S256"],
      registration_endpoint: `${base}/api/mcp/oauth/register`,
    });
  });

  return router;
}

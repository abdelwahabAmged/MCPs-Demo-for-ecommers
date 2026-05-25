import express from "express";
import type { Request, Response } from "express";

export function createWellKnownRouter(port: number): express.Router {
  const router = express.Router();

  router.get("/oauth-protected-resource", (_req: Request, res: Response) => {
    console.log("oauth-protected-resource ", port);
    res.json({
      resource: `http://localhost:${port}`,
      bearer_methods_supported: ["header"],
      resource_documentation: `http://localhost:${port}/health`,
    });
  });

  router.get("/oauth-authorization-server", (_req: Request, res: Response) => {
    console.log("oauth-authorization-server", port);
    res.json({
      issuer: `http://localhost:${port}`,
      authorization_endpoint: `http://localhost:${port}/authorize`,
      token_endpoint: `http://localhost:${port}/token`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code"],
      code_challenge_methods_supported: ["S256"],
      registration_endpoint: `http://localhost:${port}/register`,
    });
  });

  return router;
}

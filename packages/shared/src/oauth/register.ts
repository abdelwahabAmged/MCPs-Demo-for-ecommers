import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";

export function handleDynamicClientRegistration(
  req: Request,
  res: Response,
): void {
  const clientId = randomUUID();
  console.log("clientId", clientId);
  console.log("req.body", req.body);
  res.status(201).json({
    client_id: clientId,
    client_name: req.body?.client_name || "MCP Client",
    redirect_uris: req.body?.redirect_uris || [],
    grant_types: ["authorization_code"],
    response_types: ["code"],
    token_endpoint_auth_method: "none",
  });
}

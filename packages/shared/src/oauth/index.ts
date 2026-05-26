import express from "express";
import { handleDynamicClientRegistration } from "./register.js";

export { createWellKnownRouter } from "./wellKnown.js";
export type { WellKnownOptions } from "./wellKnown.js";
export { handleDynamicClientRegistration } from "./register.js";

export function createOAuthRouter(): express.Router {
  const router = express.Router();

  router.post("/register", handleDynamicClientRegistration);

  return router;
}

import { createContext } from "react-router";

export interface CloudflareContext {
  env: CloudflareEnvironment;
  ctx: ExecutionContext;
}

export const cloudflareContext = createContext<CloudflareContext>();

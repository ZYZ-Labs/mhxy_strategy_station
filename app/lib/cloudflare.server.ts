import type { RouterContextProvider } from "react-router";

import { cloudflareContext } from "~/context";

export function getCloudflare(
  context: Readonly<RouterContextProvider>,
): CloudflareContextValue {
  return context.get(cloudflareContext);
}

type CloudflareContextValue = {
  env: CloudflareEnvironment;
  ctx: ExecutionContext;
};

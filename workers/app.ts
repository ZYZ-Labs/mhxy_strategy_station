import { createRequestHandler, RouterContextProvider } from "react-router";
import { createMcpHandler } from "agents/mcp/server";

import { cloudflareContext } from "../app/context";
import { createStrategyMcpServer } from "../app/mcp/server";
import { assertSameOrigin } from "../app/lib/http.server";

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);

export default {
  fetch(request, env, ctx) {
    const pathname = new URL(request.url).pathname;
    if (pathname === "/mcp") {
      return createMcpHandler(
        () => createStrategyMcpServer(env.DB),
        { route: "/mcp", legacy: "stateless" },
      )(request, env, ctx);
    }
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
      try {
        assertSameOrigin(request);
      } catch (error) {
        if (error instanceof Response) return error;
        throw error;
      }
    }
    const context = new RouterContextProvider();
    context.set(cloudflareContext, { env, ctx });
    return requestHandler(request, context);
  },
} satisfies ExportedHandler<CloudflareEnvironment>;

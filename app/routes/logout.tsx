import { redirect } from "react-router";

import { expiredSessionCookie, logout } from "~/features/auth/service.server";
import { getCloudflare } from "~/lib/cloudflare.server";

import type { Route } from "./+types/logout";

export async function action({ request, context }: Route.ActionArgs) {
  const { env } = getCloudflare(context);
  await logout(env.DB, request);
  return redirect("/", {
    headers: { "Set-Cookie": expiredSessionCookie(new URL(request.url).protocol === "https:") },
  });
}

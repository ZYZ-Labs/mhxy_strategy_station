import { requireUser } from "~/features/auth/service.server";
import { getAuthorLatestRevision } from "~/features/content/repository.server";
import { getCloudflare } from "~/lib/cloudflare.server";

import type { Route } from "./+types/api-submission-status";

export async function loader({ request, context, params }: Route.LoaderArgs) {
  const { env } = getCloudflare(context);
  const user = await requireUser(env.DB, request);
  const revision = await getAuthorLatestRevision(env.DB, params.entryId, user.id);
  if (!revision) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json({
    entryId: revision.entryId,
    revisionId: revision.revisionId,
    status: revision.status,
    riskLevel: revision.riskLevel,
    updatedAt: revision.updatedAt,
    rejectionReason: revision.rejectionReason,
  });
}

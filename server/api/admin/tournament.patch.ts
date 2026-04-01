import { prisma } from "~/server/utils/prisma";
import { logRequest } from "~/server/utils/logger";
import { getActiveTournament } from "~/server/utils/tournament";

const VALID_STATUSES = ["DRAFT", "LIVE"] as const;

export default defineEventHandler(async (event) => {
  const tournament = await getActiveTournament();
  const body = await readBody(event);

  const data: Record<string, unknown> = {};

  if (body?.status !== undefined) {
    if (!VALID_STATUSES.includes(body.status)) {
      throw createApiError({
        error: "Ongeldige status",
        code: 400,
        reason: "Invalid tournament status",
      });
    }
    data.status = body.status;
  }

  if (body?.poolScheduleLive !== undefined) {
    data.poolScheduleLive = Boolean(body.poolScheduleLive);
  }

  if (body?.koScheduleLive !== undefined) {
    data.koScheduleLive = Boolean(body.koScheduleLive);
  }

  if (Object.keys(data).length === 0) {
    throw createApiError({
      error: "Geen geldige velden opgegeven",
      code: 400,
      reason: "No valid fields provided",
    });
  }

  const updated = await prisma.tournament.update({
    where: { id: tournament.id },
    data,
  });

  logRequest(event, "success", `Tournament updated: ${JSON.stringify(data)}`);
  return updated;
});

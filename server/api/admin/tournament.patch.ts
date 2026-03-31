import { prisma } from "~/server/utils/prisma";
import { logRequest } from "~/server/utils/logger";
import { getActiveTournament } from "~/server/utils/tournament";

const VALID_STATUSES = ["DRAFT", "LIVE"] as const;

export default defineEventHandler(async (event) => {
  const tournament = await getActiveTournament();
  const body = await readBody(event);

  if (!VALID_STATUSES.includes(body?.status)) {
    throw createApiError({
      error: "Ongeldige status",
      code: 400,
      reason: "Invalid tournament status",
    });
  }

  const updated = await prisma.tournament.update({
    where: { id: tournament.id },
    data: { status: body.status },
  });

  logRequest(event, "success", `Tournament status updated: ${body.status}`);
  return updated;
});

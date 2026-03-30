import { prisma } from "~/server/utils/prisma";
import { logRequest } from "~/server/utils/logger";
import { getActiveTournament } from "~/server/utils/tournament";

const VALID_TYPES = ["POOLS", "KNOCKOUT", "COMBINATION"] as const;
const VALID_STATUSES = ["DRAFT", "LIVE"] as const;

export default defineEventHandler(async (event) => {
  const tournament = await getActiveTournament();
  const body = await readBody(event);

  const data: Record<string, unknown> = {};

  if (body?.type !== undefined) {
    if (!VALID_TYPES.includes(body.type)) {
      throw createApiError({
        error: "Ongeldig competitietype",
        code: 400,
        reason: "Invalid tournament type",
      });
    }
    data.type = body.type;
  }

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

  if (body?.name !== undefined) data.name = body.name;
  if (body?.startTime !== undefined) data.startTime = new Date(body.startTime);
  if (body?.matchDuration !== undefined) data.matchDuration = Number(body.matchDuration);
  if (body?.breakTime !== undefined) data.breakTime = Number(body.breakTime);
  if (body?.pointsWin !== undefined) data.pointsWin = Number(body.pointsWin);
  if (body?.pointsDraw !== undefined) data.pointsDraw = Number(body.pointsDraw);
  if (body?.pointsLoss !== undefined) data.pointsLoss = Number(body.pointsLoss);

  const updated = await prisma.tournament.update({
    where: { id: tournament.id },
    data,
  });

  logRequest(event, "success", `Tournament updated: ${JSON.stringify(data)}`);
  return updated;
});

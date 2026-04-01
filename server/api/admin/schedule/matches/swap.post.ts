import { prisma } from "~/server/utils/prisma";
import { logRequest } from "~/server/utils/logger";
import { getActiveTournament } from "~/server/utils/tournament";

export default defineEventHandler(async (event) => {
  await getActiveTournament();
  const body = await readBody(event);

  if (!body?.matchAId || !body?.matchBId) {
    throw createApiError({
      error: "matchAId en matchBId zijn verplicht",
      code: 400,
      reason: "matchAId and matchBId are required",
    });
  }

  const matches = await prisma.match.findMany({
    where: { id: { in: [body.matchAId, body.matchBId] } },
    include: {
      field: true,
      teamA: true,
      teamB: true,
    },
  });

  if (matches.length < 2) {
    throw createApiError({
      error: "Een of beide wedstrijden niet gevonden",
      code: 404,
      reason: "One or both matches not found",
    });
  }

  const matchA = matches.find((m) => m.id === body.matchAId)!;
  const matchB = matches.find((m) => m.id === body.matchBId)!;

  await prisma.match.update({
    where: { id: matchA.id },
    data: { fieldId: matchB.fieldId, startTime: matchB.startTime },
  });

  await prisma.match.update({
    where: { id: matchB.id },
    data: { fieldId: matchA.fieldId, startTime: matchA.startTime },
  });

  logRequest(event, "success", `Swapped matches ${matchA.id} and ${matchB.id}`);
  return { swapped: true };
});

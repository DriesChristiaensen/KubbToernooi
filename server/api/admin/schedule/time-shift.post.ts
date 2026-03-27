import { prisma } from "~/server/utils/prisma";
import { logRequest } from "~/server/utils/logger";
import { getActiveTournament } from "~/server/utils/tournament";

export default defineEventHandler(async (event) => {
  const tournament = await getActiveTournament();
  const body = await readBody(event);

  if (!body?.fromTime) {
    throw createApiError({
      error: "Begintijdstip is verplicht",
      code: 400,
      reason: "fromTime is required",
    });
  }

  if (body?.offsetMinutes === undefined || body?.offsetMinutes === null) {
    throw createApiError({
      error: "Aantal minuten is verplicht",
      code: 400,
      reason: "offsetMinutes is required",
    });
  }

  const fromTime = new Date(body.fromTime);
  const offsetMs = Number(body.offsetMinutes) * 60 * 1000;

  const matches = await prisma.match.findMany({
    where: {
      field: { tournamentId: tournament.id },
      startTime: { gte: fromTime },
    },
  });

  await Promise.all(
    matches.map((m) =>
      prisma.match.update({
        where: { id: m.id },
        data: { startTime: new Date(m.startTime.getTime() + offsetMs) },
      }),
    ),
  );

  logRequest(event, "success", `Time-shifted ${matches.length} matches by ${body.offsetMinutes} minutes`);
  return { shifted: matches.length };
});

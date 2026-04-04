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

  const fromTime = new Date(body.fromTime);
  if (isNaN(fromTime.getTime())) {
    throw createApiError({
      error: "Ongeldig tijdstip",
      code: 400,
      reason: "fromTime is not a valid date",
    });
  }

  if (body?.offsetMinutes === undefined || body?.offsetMinutes === null) {
    throw createApiError({
      error: "Aantal minuten is verplicht",
      code: 400,
      reason: "offsetMinutes is required",
    });
  }

  const offsetMs = Number(body.offsetMinutes) * 60 * 1000;
  if (isNaN(offsetMs)) {
    throw createApiError({
      error: "Ongeldig aantal minuten",
      code: 400,
      reason: "offsetMinutes must be a number",
    });
  }

  const matches = await prisma.match.findMany({
    where: {
      field: { tournamentId: tournament.id },
      startTime: { gte: fromTime },
    },
  });

  await prisma.$transaction(
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

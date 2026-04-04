import { z } from "zod";
import { prisma } from "~/server/utils/prisma";
import { logRequest } from "~/server/utils/logger";
import { getActiveTournament } from "~/server/utils/tournament";

const bodySchema = z.object({
  fromTime: z.string().refine((s) => !isNaN(new Date(s).getTime()), { message: "Invalid date" }),
  offsetMinutes: z.number().int(),
});

export default defineEventHandler(async (event) => {
  const tournament = await getActiveTournament();
  const raw = await readBody(event);

  let body;
  try {
    body = bodySchema.parse(raw ?? {});
  } catch {
    throw createApiError({
      error: "Ongeldige invoer",
      code: "invalid_input",
      reason: "Invalid input - fromTime and offsetMinutes required",
    });
  }

  const fromTime = new Date(body.fromTime);
  const offsetMs = body.offsetMinutes * 60 * 1000;

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

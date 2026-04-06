import { z } from "zod";
import { prisma } from "~/server/utils/prisma";
import { logRequest } from "~/server/utils/logger";
import { getActiveTournament } from "~/server/utils/tournament";

const bodySchema = z.object({
  fromTime: z.string().refine((s) => !isNaN(new Date(s).getTime()), { message: "Invalid date" }),
  offsetMinutes: z.number().int(),
});

/**
 * Shift the start time of all matches starting at or after a given time.
 * Atomically updates all affected matches in a single transaction.
 * @param {Object} body - Request body
 * @param {string} body.fromTime - Reference time (ISO 8601). Matches at or after this time are shifted.
 * @param {number} body.offsetMinutes - Time offset in minutes (can be positive or negative)
 * @returns {Object} Count of shifted matches: { shifted: number }
 * @throws {400} If fromTime is invalid or offsetMinutes is not an integer
 * @throws {404} If no active tournament exists
 */
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

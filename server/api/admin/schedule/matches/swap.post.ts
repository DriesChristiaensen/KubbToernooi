import { z } from "zod";
import { prisma } from "~/server/utils/prisma";
import { logRequest } from "~/server/utils/logger";
import { getActiveTournament } from "~/server/utils/tournament";

const bodySchema = z.object({
  matchAId: z.string().min(1),
  matchBId: z.string().min(1),
});

/**
 * Swap field and start time between two matches.
 * Atomically swaps both matches to avoid partial state. Matches must exist and be different.
 * @param {Object} body - Request body
 * @param {string} body.matchAId - First match ID (required)
 * @param {string} body.matchBId - Second match ID (required, must differ from matchAId)
 * @returns {Object} Swap status: { swapped: boolean }
 * @throws {400} If either match ID is missing or invalid
 * @throws {404} If one or both matches do not exist
 */
export default defineEventHandler(async (event) => {
  await getActiveTournament();
  const raw = await readBody(event);

  let body;
  try {
    body = bodySchema.parse(raw ?? {});
  } catch {
    throw createApiError({
      error: "matchAId en matchBId zijn verplicht",
      code: "invalid_match_id",
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
      code: "match_not_found",
      reason: "One or both matches not found",
    });
  }

  // Safe: matches.length < 2 check above guarantees both IDs are present in the result
  const matchA = matches.find((m) => m.id === body.matchAId)!;
  const matchB = matches.find((m) => m.id === body.matchBId)!;

  await prisma.$transaction(async (tx) => {
    // Atomically swap both matches to avoid half-swapped state
    await tx.match.update({
      where: { id: matchA.id },
      data: { fieldId: matchB.fieldId, startTime: matchB.startTime },
    });

    await tx.match.update({
      where: { id: matchB.id },
      data: { fieldId: matchA.fieldId, startTime: matchA.startTime },
    });
  });

  logRequest(event, "success", `Swapped matches ${matchA.id} and ${matchB.id}`);
  return { swapped: true };
});

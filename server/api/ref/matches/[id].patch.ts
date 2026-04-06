import { z } from "zod";
import { prisma } from "~/server/utils/prisma";
import { logRequest } from "~/server/utils/logger";
import { recalculatePoolStandings } from "~/server/utils/standings";

const bodySchema = z.object({
  scoreA: z.number().int().nonnegative(),
  scoreB: z.number().int().nonnegative(),
  koWinnerId: z.string().optional(),
});

/**
 * Record match score and auto-advance winner in KO bracket.
 * For pool matches, recalculates standings. For KO draws, requires koWinnerId to determine advancement.
 * Atomically updates match, advances winner to next KO round, and recalculates pool standings if needed.
 * @param {string} id - Match ID (path parameter)
 * @param {Object} body - Request body
 * @param {number} body.scoreA - Score for team A (non-negative integer, required)
 * @param {number} body.scoreB - Score for team B (non-negative integer, required)
 * @param {string} [body.koWinnerId] - Required for KO matches on draw: ID of advancing team
 * @returns {Object} Updated match object with scoreA, scoreB, status="PLAYED", koWinnerId
 * @throws {400} If id is missing, scores invalid, or KO winner missing/invalid on draw
 * @throws {404} If match does not exist
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  if (!id) {
    throw createApiError({ error: "Ongeldig wedstrijd-ID", code: "invalid_match_id", reason: "Invalid match ID" });
  }

  const raw = await readBody(event);

  let body;
  try {
    body = bodySchema.parse(raw ?? {});
  } catch {
    throw createApiError({
      error: "Score moet een niet-negatief geheel getal zijn",
      code: "invalid_input",
      reason: "Invalid score",
    });
  }

  const match = await prisma.match.findFirst({ where: { id } });
  if (!match) {
    throw createApiError({ error: "Wedstrijd niet gevonden", code: "match_not_found", reason: "Match not found" });
  }

  const isDraw = body.scoreA === body.scoreB;
  const updateData: Record<string, unknown> = { scoreA: body.scoreA, scoreB: body.scoreB, status: "PLAYED" };

  if (match.phase === "KO" && isDraw) {
    const koWinnerId = body.koWinnerId;
    if (!koWinnerId) {
      throw createApiError({
        error: "Winnaar is verplicht bij gelijkspel in een knock-out wedstrijd",
        code: "invalid_input",
        reason: "KO winner required on draw",
      });
    }
    if (koWinnerId !== match.teamAId && koWinnerId !== match.teamBId) {
      throw createApiError({
        error: "Winnaar moet één van de spelende teams zijn",
        code: "invalid_input",
        reason: "Invalid KO winner",
      });
    }
    updateData.koWinnerId = koWinnerId;
  }

  const updated = await prisma.$transaction(async (tx) => {
    // Save match score atomically with KO advancement
    const matchResult = await tx.match.update({ where: { id }, data: updateData });

    if (match.phase === "KO" && match.nextMatchId) {
      const winnerId = body.scoreA > body.scoreB
        ? match.teamAId
        : body.scoreB > body.scoreA
        ? match.teamBId
        : typeof updateData.koWinnerId === "string"
        ? updateData.koWinnerId
        : match.teamAId;

      if (winnerId) {
        // Determine slot: first sibling → teamA, second sibling → teamB
        const siblings = await tx.match.findMany({
          where: { nextMatchId: match.nextMatchId },
          orderBy: { id: "asc" },
        });
        const isFirst = siblings.length === 0 || siblings[0]?.id === match.id;
        await tx.match.update({
          where: { id: match.nextMatchId },
          data: isFirst ? { teamAId: winnerId } : { teamBId: winnerId },
        });
      }
    }

    return matchResult;
  });

  if (match.phase === "POOL" && match.poolId != null) {
    await recalculatePoolStandings(match.poolId);
  }

  logRequest(event, "success", `Match ${id} score saved: ${body.scoreA}-${body.scoreB}`);
  return updated;
});

import { prisma } from "~/server/utils/prisma";
import { logRequest } from "~/server/utils/logger";
import { recalculatePoolStandings } from "~/server/utils/standings";

/**
 * Delete a match's recorded score and revert status.
 * Sets status to LIVE if match is in progress, SCHEDULED otherwise.
 * Recalculates standings for pool matches.
 * @param {string} id - Match ID (path parameter)
 * @returns {Object} Reverted match object with scoreA=null, scoreB=null, status reverted
 * @throws {400} If id is missing or no score exists to delete
 * @throws {404} If match does not exist
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  if (!id) {
    throw createApiError({ error: "Ongeldig wedstrijd-ID", code: "invalid_match_id", reason: "Invalid match ID" });
  }

  const match = await prisma.match.findFirst({ where: { id } });
  if (!match) {
    throw createApiError({ error: "Wedstrijd niet gevonden", code: "match_not_found", reason: "Match not found" });
  }

  if (match.scoreA === null && match.scoreB === null) {
    throw createApiError({
      error: "Er is geen score om te verwijderen",
      code: "invalid_input",
      reason: "No score to delete",
    });
  }

  const now = new Date();
  const newStatus = match.startTime <= now ? "LIVE" : "SCHEDULED";

  const updated = await prisma.match.update({
    where: { id },
    data: {
      scoreA: null,
      scoreB: null,
      koWinnerId: null,
      status: newStatus,
    },
  });

  if (match.phase === "POOL" && match.poolId != null) {
    await recalculatePoolStandings(match.poolId);
  }

  logRequest(event, "success", `Match ${id} score deleted`);
  return updated;
});

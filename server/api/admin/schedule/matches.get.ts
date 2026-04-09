import { prisma } from "~/server/utils/prisma";
import { getActiveTournament } from "~/server/utils/tournament";

/**
 * Get all scheduled matches for the active tournament (admin view).
 * Only shows matches with both teams assigned (no byes or empty KO slots).
 * @returns {Array<Object>} Array of matches with field, teamA, teamB, pool, sorted by startTime
 * @throws {404} If no active tournament exists
 */
export default defineEventHandler(async (_event) => {
  const tournament = await getActiveTournament();

  return await prisma.match.findMany({
    where: {
      field: { tournamentId: tournament.id },
      teamAId: { not: null },
      teamBId: { not: null },
    },
    include: {
      field: true,
      teamA: true,
      teamB: true,
      pool: true,
    },
    orderBy: [{ startTime: "asc" }, { round: "asc" }, { id: "asc" }],
  });
});

import { prisma } from "~/server/utils/prisma";
import { getActiveTournament } from "~/server/utils/tournament";

/**
 * Get all matches for the active tournament (referee view).
 * Only shows matches with both teams assigned (no byes or empty KO slots).
 * Includes field, teams, and KO winner info.
 * @returns {Array<Object>} Array of matches with field, teamA, teamB, koWinner, sorted by startTime
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
      koWinner: true,
    },
    orderBy: [{ startTime: "asc" }, { id: "asc" }],
  });
});

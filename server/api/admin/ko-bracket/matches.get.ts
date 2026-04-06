import { prisma } from "~/server/utils/prisma";
import { getActiveTournament } from "~/server/utils/tournament";

/**
 * Get all KO bracket matches for the active tournament (admin view).
 * @returns {Array<Object>} Array of KO matches with teamA, teamB, field, sorted by round then startTime
 * @throws {404} If no active tournament exists
 */
export default defineEventHandler(async (_event) => {
  const tournament = await getActiveTournament();

  const matches = await prisma.match.findMany({
    where: { phase: "KO", field: { tournamentId: tournament.id } },
    include: {
      teamA: { select: { id: true, name: true } },
      teamB: { select: { id: true, name: true } },
      field: { select: { id: true, name: true } },
    },
    orderBy: [{ round: "asc" }, { startTime: "asc" }],
  });

  return matches;
});

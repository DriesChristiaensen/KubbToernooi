import { prisma } from "~/server/utils/prisma";
import { getActiveTournament } from "~/server/utils/tournament";

/**
 * Get all KO bracket matches for the active tournament (admin view).
 * @query bracket - "A" (default) or "B" — which bracket to return
 * @returns {Array<Object>} Array of KO matches with teamA, teamB, field, sorted by round then startTime
 * @throws {404} If no active tournament exists
 */
export default defineEventHandler(async (event) => {
  const tournament = await getActiveTournament();
  const query = getQuery(event);
  const bracket = query.bracket === "B" ? "B" : "A";

  const matches = await prisma.match.findMany({
    where: { phase: "KO", tournamentId: tournament.id, koBracket: bracket },
    include: {
      teamA: { select: { id: true, name: true } },
      teamB: { select: { id: true, name: true } },
      field: { select: { id: true, name: true } },
    },
    orderBy: [{ round: "asc" }, { bracketPosition: "asc" }, { startTime: "asc" }],
  });

  return matches;
});

import { prisma } from "~/server/utils/prisma";
import { getActiveTournament } from "~/server/utils/tournament";

/**
 * Get all teams in the active tournament (admin view).
 * @returns {Array<Object>} Array of teams with id, name, tournamentId, sorted by name
 * @throws {404} If no active tournament exists
 */
export default defineEventHandler(async () => {
  const tournament = await getActiveTournament();

  return prisma.team.findMany({
    where: { tournamentId: tournament.id },
    orderBy: { name: "asc" },
  });
});

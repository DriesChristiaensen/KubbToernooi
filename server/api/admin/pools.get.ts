import { prisma } from "~/server/utils/prisma";
import { getActiveTournament } from "~/server/utils/tournament";

/**
 * Get all pools in the active tournament with team assignments (admin view).
 * @returns {Array<Object>} Array of pools with id, name, teamsAdvancing, poolTeams (with team details), sorted by name
 * @throws {404} If no active tournament exists
 */
export default defineEventHandler(async (_event) => {
  const tournament = await getActiveTournament();

  return await prisma.pool.findMany({
    where: { tournamentId: tournament.id },
    include: { poolTeams: { include: { team: true } } },
    orderBy: { name: "asc" },
  });
});

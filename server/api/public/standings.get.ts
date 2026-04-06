import { prisma } from "~/server/utils/prisma";

/**
 * Get public pool standings for the active tournament.
 * Only visible when tournament is active and poolScheduleLive flag is enabled.
 * Standings are sorted by points, goal difference, and goals for.
 * @returns {Array<Object>} Array of pools with standings and teams, sorted by pool name
 */
export default defineEventHandler(async (_event) => {
  const tournament = await prisma.tournament.findFirst({ where: { isActive: true } });

  if (!tournament || !tournament.poolScheduleLive) return [];

  return await prisma.pool.findMany({
    where: { tournamentId: tournament.id },
    include: {
      standings: {
        include: { team: true },
        orderBy: [
          { points: "desc" },
          { goalDifference: "desc" },
          { goalsFor: "desc" },
        ],
      },
    },
    orderBy: { name: "asc" },
  });
});

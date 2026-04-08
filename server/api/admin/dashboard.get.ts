import { prisma } from "~/server/utils/prisma";

/**
 * Get admin dashboard summary for enabling/disabling navigation cards.
 * @returns {{ type: string|null, teamCount: number, poolCount: number }}
 */
export default defineEventHandler(async () => {
  const tournament = await prisma.tournament.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
  });

  if (!tournament) {
    return { type: null, teamCount: 0, poolCount: 0 };
  }

  const [teamCount, poolCount] = await Promise.all([
    prisma.team.count({ where: { tournamentId: tournament.id } }),
    prisma.pool.count({ where: { tournamentId: tournament.id } }),
  ]);

  return { type: tournament.type, teamCount, poolCount };
});

import { prisma } from "~/server/utils/prisma";

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

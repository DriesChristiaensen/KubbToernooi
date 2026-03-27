import { prisma } from "~/server/utils/prisma";

export default defineEventHandler(async (_event) => {
  const tournament = await prisma.tournament.findFirst({ orderBy: { id: "desc" } });

  if (!tournament || tournament.status === "DRAFT") return [];

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

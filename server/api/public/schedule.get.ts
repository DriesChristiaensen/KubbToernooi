import { prisma } from "~/server/utils/prisma";

export default defineEventHandler(async (_event) => {
  const tournament = await prisma.tournament.findFirst({ orderBy: { id: "desc" } });

  if (!tournament || tournament.status === "DRAFT") return [];

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
    orderBy: [{ startTime: "asc" }, { id: "asc" }],
  });
});

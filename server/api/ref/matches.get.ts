import { prisma } from "~/server/utils/prisma";
import { getActiveTournament } from "~/server/utils/tournament";

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

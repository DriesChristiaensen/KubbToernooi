import { prisma } from "~/server/utils/prisma";
import { getActiveTournament } from "~/server/utils/tournament";

export default defineEventHandler(async (_event) => {
  const tournament = await getActiveTournament();

  return await prisma.match.findMany({
    where: { field: { tournamentId: tournament.id } },
    include: {
      field: true,
      teamA: true,
      teamB: true,
      pool: true,
    },
    orderBy: [{ startTime: "asc" }, { round: "asc" }, { id: "asc" }],
  });
});

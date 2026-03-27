import { prisma } from "~/server/utils/prisma";
import { getActiveTournament } from "~/server/utils/tournament";

export default defineEventHandler(async (_event) => {
  const tournament = await getActiveTournament();

  const matches = await prisma.match.findMany({
    where: { phase: "KO", field: { tournamentId: tournament.id } },
    include: {
      teamA: { select: { id: true, name: true } },
      teamB: { select: { id: true, name: true } },
      field: { select: { id: true, name: true } },
    },
    orderBy: [{ round: "asc" }, { startTime: "asc" }],
  });

  return matches;
});

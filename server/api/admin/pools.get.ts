import { prisma } from "~/server/utils/prisma";
import { getActiveTournament } from "~/server/utils/tournament";

export default defineEventHandler(async (_event) => {
  const tournament = await getActiveTournament();

  return await prisma.pool.findMany({
    where: { tournamentId: tournament.id },
    include: { poolTeams: { include: { team: true } } },
    orderBy: { name: "asc" },
  });
});

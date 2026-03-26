import { prisma } from "~/server/utils/prisma";
import { getActiveTournament } from "~/server/utils/tournament";

export default defineEventHandler(async () => {
  const tournament = await getActiveTournament();

  return prisma.field.findMany({
    where: { tournamentId: tournament.id },
    orderBy: { name: "asc" },
  });
});

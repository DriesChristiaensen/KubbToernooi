import { prisma } from "~/server/utils/prisma";
import { getActiveTournament } from "~/server/utils/tournament";

export default defineEventHandler(async (_event) => {
  const tournament = await getActiveTournament();

  const [teams, fields, pools, matches, standings] = await Promise.all([
    prisma.team.findMany({ where: { tournamentId: tournament.id } }),
    prisma.field.findMany({ where: { tournamentId: tournament.id } }),
    prisma.pool.findMany({
      where: { tournamentId: tournament.id },
      include: { poolTeams: true },
    }),
    prisma.match.findMany({
      where: { field: { tournamentId: tournament.id } },
      orderBy: [{ startTime: "asc" }, { id: "asc" }],
    }),
    prisma.standing.findMany({
      where: { pool: { tournamentId: tournament.id } },
    }),
  ]);

  return { tournament, teams, fields, pools, matches, standings };
});

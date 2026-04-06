import { prisma } from "~/server/utils/prisma";
import { getActiveTournament } from "~/server/utils/tournament";

/**
 * Export the complete active tournament snapshot as JSON.
 * Includes all tournament data: teams, fields, pools with team assignments, matches, and standings.
 * Can be imported via /admin/import endpoint.
 * @returns {Object} Snapshot with tournament, teams, fields, pools, matches, standings
 * @throws {404} If no active tournament exists
 */
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

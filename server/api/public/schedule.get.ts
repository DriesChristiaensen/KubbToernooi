import { type MatchPhase, TournamentStatus } from "@prisma/client";
import { prisma } from "~/server/utils/prisma";

/**
 * Get publicly visible schedule for the active tournament.
 * Only shows matches when tournament is LIVE and respective schedule flag is enabled.
 * Only shows matches with both teams assigned (no byes or empty KO slots).
 * @returns {Array<Object>} Array of visible matches with field, teamA, teamB, pool, sorted by startTime
 */
export default defineEventHandler(async (_event) => {
  const tournament = await prisma.tournament.findFirst({
    where: { isActive: true },
  });

  if (!tournament) return [];

  const phases: MatchPhase[] = [];
  if (tournament.status !== TournamentStatus.LIVE) return [];
  if (tournament.poolScheduleLive) phases.push("POOL");
  if (tournament.koScheduleLive) phases.push("KO");
  if (phases.length === 0) return [];

  return await prisma.match.findMany({
    where: {
      tournamentId: tournament.id,
      phase: { in: phases },
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

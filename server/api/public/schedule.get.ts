import { TournamentStatus } from "@prisma/client";
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
  if (tournament.status !== TournamentStatus.LIVE) return [];

  type MatchPhaseFilter =
    | { phase: "POOL"; teamBId: { not: null } }
    | { phase: "KO"; koBracket: string };

  const phaseConditions: MatchPhaseFilter[] = [];
  if (tournament.poolScheduleLive) phaseConditions.push({ phase: "POOL", teamBId: { not: null } });
  if (tournament.koScheduleLive) phaseConditions.push({ phase: "KO", koBracket: "A" });
  if (tournament.bKoScheduleLive) phaseConditions.push({ phase: "KO", koBracket: "B" });
  if (phaseConditions.length === 0) return [];

  return await prisma.match.findMany({
    where: {
      tournamentId: tournament.id,
      teamAId: { not: null },
      OR: phaseConditions,
    },
    select: {
      id: true,
      phase: true,
      round: true,
      startTime: true,
      status: true,
      scoreA: true,
      scoreB: true,
      koWinnerId: true,
      bracketPosition: true,
      koBracket: true,
      field: true,
      teamA: true,
      teamB: true,
      pool: true,
    },
    orderBy: [{ startTime: "asc" }, { id: "asc" }],
  });
});

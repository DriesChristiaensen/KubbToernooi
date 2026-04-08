import { TournamentStatus } from "@prisma/client";
import { prisma } from "~/server/utils/prisma";

/**
 * Get admin status banner data: tournament visibility, schedule visibility, and visible match counts.
 * @returns {Object|null} Banner data or null if no active tournament
 */
export default defineEventHandler(async (_event) => {
  const tournament = await prisma.tournament.findFirst({ where: { isActive: true } });
  if (!tournament) return null;

  const isLive = tournament.status === TournamentStatus.LIVE;
  const hasPools = tournament.type === "POOLS" || tournament.type === "COMBINATION";
  const hasKo = tournament.type === "KNOCKOUT" || tournament.type === "COMBINATION";

  const [visiblePoolMatchCount, visibleKoMatchCount] = await Promise.all([
    hasPools && isLive && tournament.poolScheduleLive
      ? prisma.match.count({
          where: {
            tournamentId: tournament.id,
            phase: "POOL",
            teamAId: { not: null },
            teamBId: { not: null },
          },
        })
      : Promise.resolve(0),
    hasKo && isLive && tournament.koScheduleLive
      ? prisma.match.count({
          where: {
            tournamentId: tournament.id,
            phase: "KO",
            teamAId: { not: null },
            teamBId: { not: null },
          },
        })
      : Promise.resolve(0),
  ]);

  return {
    status: tournament.status,
    type: tournament.type,
    poolScheduleLive: tournament.poolScheduleLive,
    koScheduleLive: tournament.koScheduleLive,
    visiblePoolMatchCount,
    visibleKoMatchCount,
  };
});

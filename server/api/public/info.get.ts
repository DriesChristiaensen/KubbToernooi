import { prisma } from "~/server/utils/prisma";
import { TournamentStatus } from "@prisma/client";

/**
 * Get public tournament information (no authentication required).
 * @returns {Object} Tournament info: { type, tournamentLive, poolScheduleLive, koScheduleLive }
 */
export default defineEventHandler(async () => {
  const tournament = await prisma.tournament.findFirst({
    where: { isActive: true },
  });

  let maxKoRound: number | null = null;
  if (tournament) {
    const lastKoMatch = await prisma.match.findFirst({
      where: { tournamentId: tournament.id, phase: "KO" },
      orderBy: { round: "desc" },
      select: { round: true },
    });
    maxKoRound = lastKoMatch?.round ?? null;
  }

  return {
    type: tournament?.type ?? null,
    tournamentLive: tournament?.status === TournamentStatus.LIVE,
    poolScheduleLive: tournament?.poolScheduleLive ?? false,
    koScheduleLive: tournament?.koScheduleLive ?? false,
    maxKoRound,
  };
});

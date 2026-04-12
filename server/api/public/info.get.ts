import { prisma } from "~/server/utils/prisma";
import { TournamentStatus } from "@prisma/client";

/**
 * Get public tournament information (no authentication required).
 * @returns {Object} Tournament info: { type, tournamentLive, poolScheduleLive, koScheduleLive, bKoScheduleLive, hasBKnockout }
 */
export default defineEventHandler(async () => {
  const tournament = await prisma.tournament.findFirst({
    where: { isActive: true },
  });

  let maxKoRound: number | null = null;
  let maxBKoRound: number | null = null;
  if (tournament) {
    const lastKoMatch = await prisma.match.findFirst({
      where: { tournamentId: tournament.id, phase: "KO", koBracket: "A" },
      orderBy: { round: "desc" },
      select: { round: true },
    });
    maxKoRound = lastKoMatch?.round ?? null;

    const lastBKoMatch = await prisma.match.findFirst({
      where: { tournamentId: tournament.id, phase: "KO", koBracket: "B" },
      orderBy: { round: "desc" },
      select: { round: true },
    });
    maxBKoRound = lastBKoMatch?.round ?? null;
  }

  return {
    type: tournament?.type ?? null,
    tournamentLive: tournament?.status === TournamentStatus.LIVE,
    poolScheduleLive: tournament?.poolScheduleLive ?? false,
    koScheduleLive: tournament?.koScheduleLive ?? false,
    bKoScheduleLive: tournament?.bKoScheduleLive ?? false,
    hasBKnockout: tournament?.hasBKnockout ?? false,
    maxKoRound,
    maxBKoRound,
  };
});

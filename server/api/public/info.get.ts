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
  return {
    type: tournament?.type ?? null,
    tournamentLive: tournament?.status === TournamentStatus.LIVE,
    poolScheduleLive: tournament?.poolScheduleLive ?? false,
    koScheduleLive: tournament?.koScheduleLive ?? false,
  };
});

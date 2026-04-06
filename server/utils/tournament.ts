import { prisma } from "~/server/utils/prisma";

/**
 * Fetch the active tournament, throwing an error if none exists.
 * Used by endpoints that require an active tournament context.
 * @returns {Promise<Object>} Active tournament object
 * @throws {400} If no active tournament exists
 */
export async function getActiveTournament() {
  const tournament = await prisma.tournament.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
  });

  if (!tournament) {
    throw createApiError({
      error: "Geen toernooi gevonden. Maak eerst een toernooi aan.",
      code: "tournament_not_found",
      reason: "No tournament found",
    });
  }

  return tournament;
}

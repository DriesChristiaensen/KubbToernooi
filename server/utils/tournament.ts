import { prisma } from "~/server/utils/prisma";

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

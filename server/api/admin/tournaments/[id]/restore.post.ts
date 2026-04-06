import { prisma } from "~/server/utils/prisma";
import { logRequest } from "~/server/utils/logger";

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  if (!id) {
    throw createApiError({ error: "Ongeldig toernooi-ID", code: "invalid_tournament_id", reason: "Invalid tournament ID" });
  }

  const tournament = await prisma.tournament.findFirst({
    where: { id, isActive: false },
  });

  if (!tournament) {
    throw createApiError({
      error: "Toernooi niet gevonden",
      code: "tournament_not_found",
      reason: "Tournament not found",
    });
  }

  const restored = await prisma.$transaction(async (tx) => {
    // Atomically deactivate current tournament and activate the target
    await tx.tournament.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    });

    return tx.tournament.update({
      where: { id },
      data: { isActive: true },
    });
  });

  setResponseStatus(event, 201);
  logRequest(event, "success", `Tournament restored: ${tournament.name}`);
  return restored;
});

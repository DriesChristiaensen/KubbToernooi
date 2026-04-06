import { prisma } from "~/server/utils/prisma";
import { logRequest } from "~/server/utils/logger";

/**
 * Activate a previously inactive tournament and deactivate the current active tournament.
 * Atomically switches active tournament to the specified one.
 * @param {string} id - Tournament ID (path parameter, must be inactive)
 * @returns {Object} Restored tournament object with id, name, isActive=true
 * @throws {400} If tournament ID is missing or tournament is already active
 * @throws {404} If tournament does not exist
 */
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

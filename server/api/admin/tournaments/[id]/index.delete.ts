import { prisma } from "~/server/utils/prisma";
import { logRequest } from "~/server/utils/logger";

/**
 * Delete an inactive tournament and all its data (cascade delete).
 * Only non-active tournaments can be deleted; active tournament must be deactivated first.
 * @param {string} id - Tournament ID (path parameter)
 * @returns {null} Empty response body (204 No Content)
 * @throws {400} If tournament ID is missing or tournament is active
 * @throws {404} If tournament does not exist
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  if (!id) {
    throw createApiError({ error: "Ongeldig toernooi-ID", code: "invalid_tournament_id", reason: "Invalid tournament ID" });
  }

  const tournament = await prisma.tournament.findFirst({ where: { id } });

  if (!tournament) {
    throw createApiError({
      error: "Toernooi niet gevonden",
      code: "tournament_not_found",
      reason: "Tournament not found",
    });
  }

  if (tournament.isActive) {
    throw createApiError({
      error: "Actief toernooi kan niet verwijderd worden",
      code: "invalid_input",
      reason: "Cannot delete active tournament",
    });
  }

  await prisma.tournament.delete({ where: { id } });

  setResponseStatus(event, 204);
  logRequest(event, "success", `Tournament deleted: ${tournament.name}`);
  return null;
});

import { prisma } from "~/server/utils/prisma";
import { logRequest } from "~/server/utils/logger";

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

import { prisma } from "~/server/utils/prisma";
import { logRequest } from "~/server/utils/logger";

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  if (!id) {
    throw createApiError({ error: "Ongeldig toernooi-ID", code: 400, reason: "Invalid tournament ID" });
  }

  const tournament = await prisma.tournament.findFirst({ where: { id } });

  if (!tournament) {
    throw createApiError({
      error: "Toernooi niet gevonden",
      code: 404,
      reason: "Tournament not found",
    });
  }

  if (tournament.isActive) {
    throw createApiError({
      error: "Actief toernooi kan niet verwijderd worden",
      code: 400,
      reason: "Cannot delete active tournament",
    });
  }

  await prisma.tournament.delete({ where: { id } });

  logRequest(event, "success", `Tournament deleted: ${tournament.name}`);
  return { success: true };
});

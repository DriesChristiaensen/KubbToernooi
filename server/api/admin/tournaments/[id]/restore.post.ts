import { prisma } from "~/server/utils/prisma";
import { logRequest } from "~/server/utils/logger";

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  if (!id) {
    throw createApiError({ error: "Ongeldig toernooi-ID", code: 400, reason: "Invalid tournament ID" });
  }

  const tournament = await prisma.tournament.findFirst({
    where: { id, isActive: false },
  });

  if (!tournament) {
    throw createApiError({
      error: "Toernooi niet gevonden",
      code: 404,
      reason: "Tournament not found",
    });
  }

  await prisma.tournament.updateMany({
    where: { isActive: true },
    data: { isActive: false },
  });

  const restored = await prisma.tournament.update({
    where: { id },
    data: { isActive: true },
  });

  logRequest(event, "success", `Tournament restored: ${tournament.name}`);
  return restored;
});

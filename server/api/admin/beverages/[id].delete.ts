import { prisma } from "~/server/utils/prisma";
import { logRequest } from "~/server/utils/logger";

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  if (!id) {
    throw createApiError({ error: "Ongeldig ID", code: "invalid_beverage_id", reason: "Missing id" });
  }

  const existing = await prisma.beverage.findUnique({ where: { id } });
  if (!existing) {
    throw createApiError({ error: "Drank niet gevonden", code: "beverage_not_found", reason: "Not found" });
  }

  await prisma.beverage.delete({ where: { id } });
  setResponseStatus(event, 204);
  logRequest(event, "success", `Beverage deleted: ${id}`);
  return null;
});

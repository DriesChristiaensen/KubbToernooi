import { prisma } from "~/server/utils/prisma";
import { logRequest } from "~/server/utils/logger";

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  if (!id) {
    throw createApiError({
      error: "Ongeldig poule-ID",
      code: "invalid_pool_id",
      reason: "Invalid pool ID",
    });
  }

  const pool = await prisma.pool.findFirst({ where: { id } });
  if (!pool) {
    throw createApiError({ error: "Poule niet gevonden", code: "pool_not_found", reason: "Pool not found" });
  }

  await prisma.pool.delete({ where: { id } });
  setResponseStatus(event, 204);
  logRequest(event, "success", `Pool ${id} deleted`);
  return null;
});

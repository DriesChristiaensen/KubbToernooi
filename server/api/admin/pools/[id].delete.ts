import { prisma } from "~/server/utils/prisma";
import { logRequest } from "~/server/utils/logger";

/**
 * Delete a pool and all its matches and team assignments (cascade delete).
 * @param {string} id - Pool ID (path parameter)
 * @returns {null} Empty response body (204 No Content)
 * @throws {400} If pool ID is missing
 * @throws {404} If pool does not exist
 */
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

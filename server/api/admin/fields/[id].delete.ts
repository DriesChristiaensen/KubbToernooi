import { prisma } from "~/server/utils/prisma";
import { logRequest } from "~/server/utils/logger";

/**
 * Delete a field and all its matches (cascade delete).
 * @param {string} id - Field ID (path parameter)
 * @returns {null} Empty response body (204 No Content)
 * @throws {400} If field ID is missing
 * @throws {404} If field does not exist
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createApiError({
      error: "Ongeldig ID",
      code: "invalid_field_id",
      reason: "Invalid field ID",
    });
  }

  const field = await prisma.field.findFirst({ where: { id } });
  if (!field) {
    throw createApiError({ error: "Veld niet gevonden", code: "field_not_found", reason: "Field not found" });
  }

  await prisma.field.delete({ where: { id } });

  setResponseStatus(event, 204);
  logRequest(event, "success", `Field deleted: id=${id}`);
  return null;
});

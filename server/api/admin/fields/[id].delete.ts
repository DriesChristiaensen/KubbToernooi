import { prisma } from "~/server/utils/prisma";
import { logRequest } from "~/server/utils/logger";

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createApiError({
      error: "Ongeldig ID",
      code: 400,
      reason: "Invalid field ID",
    });
  }

  const field = await prisma.field.findFirst({ where: { id } });
  if (!field) {
    throw createApiError({ error: "Veld niet gevonden", code: 404, reason: "Field not found" });
  }

  await prisma.field.delete({ where: { id } });

  logRequest(event, "success", `Field deleted: id=${id}`);
  return { success: true };
});

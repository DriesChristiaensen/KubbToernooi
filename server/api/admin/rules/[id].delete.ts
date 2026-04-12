import { prisma } from "~/server/utils/prisma";
import { logRequest } from "~/server/utils/logger";

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  if (!id) {
    throw createApiError({ error: "Ongeldig ID", code: "invalid_rule_id", reason: "Missing id" });
  }

  const existing = await prisma.rule.findUnique({ where: { id } });
  if (!existing) {
    throw createApiError({ error: "Regel niet gevonden", code: "rule_not_found", reason: "Not found" });
  }

  await prisma.rule.delete({ where: { id } });
  setResponseStatus(event, 204);
  logRequest(event, "success", `Rule deleted: ${id}`);
  return null;
});

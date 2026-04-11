import { prisma } from "~/server/utils/prisma";
import { logRequest } from "~/server/utils/logger";

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  if (!id) {
    throw createApiError({ error: "Ongeldig ID", code: "invalid_rule_group_id", reason: "Missing id" });
  }

  const existing = await prisma.ruleGroup.findUnique({ where: { id } });
  if (!existing) {
    throw createApiError({ error: "Groep niet gevonden", code: "rule_group_not_found", reason: "Not found" });
  }

  await prisma.ruleGroup.delete({ where: { id } });
  setResponseStatus(event, 204);
  logRequest(event, "success", `RuleGroup deleted: ${id}`);
  return null;
});

import { prisma } from "~/server/utils/prisma";
import { logRequest } from "~/server/utils/logger";

export default defineEventHandler(async (event) => {
  const groupId = getRouterParam(event, "groupId");
  if (!groupId) {
    throw createApiError({ error: "Ongeldig ID", code: "invalid_rule_group_id", reason: "Missing groupId" });
  }

  const group = await prisma.ruleGroup.findUnique({ where: { id: groupId } });
  if (!group) {
    throw createApiError({ error: "Groep niet gevonden", code: "rule_group_not_found", reason: "Not found" });
  }

  const max = await prisma.rule.findFirst({
    where: { ruleGroupId: groupId },
    orderBy: { orderNumber: "desc" },
  });

  const rule = await prisma.rule.create({
    data: { text: "", orderNumber: (max?.orderNumber ?? 0) + 1, ruleGroupId: groupId },
  });

  setResponseStatus(event, 201);
  logRequest(event, "success", `Rule created in group ${groupId}`);
  return rule;
});

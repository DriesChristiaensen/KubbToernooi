import { prisma } from "~/server/utils/prisma";
import { logRequest } from "~/server/utils/logger";

export default defineEventHandler(async (event) => {
  const groupId = getRouterParam(event, "groupId");
  if (!groupId) {
    throw createApiError({ error: "Ongeldig ID", code: "invalid_beverage_group_id", reason: "Missing groupId" });
  }

  const group = await prisma.beverageGroup.findUnique({ where: { id: groupId } });
  if (!group) {
    throw createApiError({ error: "Groep niet gevonden", code: "beverage_group_not_found", reason: "Not found" });
  }

  const max = await prisma.beverage.findFirst({
    where: { beverageGroupId: groupId },
    orderBy: { orderNumber: "desc" },
  });

  const beverage = await prisma.beverage.create({
    data: { text: "", price: 0, orderNumber: (max?.orderNumber ?? 0) + 1, beverageGroupId: groupId },
  });

  setResponseStatus(event, 201);
  logRequest(event, "success", `Beverage created in group ${groupId}`);
  return beverage;
});

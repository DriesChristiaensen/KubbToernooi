import { prisma } from "~/server/utils/prisma";
import { logRequest } from "~/server/utils/logger";

export default defineEventHandler(async (event) => {
  const max = await prisma.ruleGroup.findFirst({ orderBy: { orderNumber: "desc" } });
  const group = await prisma.ruleGroup.create({
    data: { title: "", orderNumber: (max?.orderNumber ?? 0) + 1 },
    include: { rules: true },
  });
  setResponseStatus(event, 201);
  logRequest(event, "success", `RuleGroup created: ${group.id}`);
  return group;
});

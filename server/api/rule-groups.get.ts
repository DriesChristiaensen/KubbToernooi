import { prisma } from "~/server/utils/prisma";

export default defineEventHandler(async () => {
  return prisma.ruleGroup.findMany({
    orderBy: { orderNumber: "asc" },
    include: { rules: { orderBy: { orderNumber: "asc" } } },
  });
});

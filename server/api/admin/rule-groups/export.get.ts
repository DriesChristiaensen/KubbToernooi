import { prisma } from "~/server/utils/prisma";

export default defineEventHandler(async () => {
  const groups = await prisma.ruleGroup.findMany({
    orderBy: { orderNumber: "asc" },
    include: { rules: { orderBy: { orderNumber: "asc" } } },
  });
  return { groups };
});

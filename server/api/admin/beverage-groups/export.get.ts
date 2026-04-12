import { prisma } from "~/server/utils/prisma";

export default defineEventHandler(async () => {
  const groups = await prisma.beverageGroup.findMany({
    orderBy: { orderNumber: "asc" },
    include: { beverages: { orderBy: { orderNumber: "asc" } } },
  });
  return { groups };
});

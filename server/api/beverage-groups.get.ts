import { prisma } from "~/server/utils/prisma";

export default defineEventHandler(async () => {
  return prisma.beverageGroup.findMany({
    orderBy: { orderNumber: "asc" },
    include: { beverages: { orderBy: { orderNumber: "asc" } } },
  });
});

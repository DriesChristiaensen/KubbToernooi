import { prisma } from "~/server/utils/prisma";
import { logRequest } from "~/server/utils/logger";

export default defineEventHandler(async (event) => {
  const max = await prisma.beverageGroup.findFirst({ orderBy: { orderNumber: "desc" } });
  const group = await prisma.beverageGroup.create({
    data: { title: "", orderNumber: (max?.orderNumber ?? 0) + 1 },
    include: { beverages: true },
  });
  setResponseStatus(event, 201);
  logRequest(event, "success", `BeverageGroup created: ${group.id}`);
  return group;
});

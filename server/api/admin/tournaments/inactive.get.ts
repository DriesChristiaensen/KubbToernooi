import { prisma } from "~/server/utils/prisma";

export default defineEventHandler(async (_event) => {
  return await prisma.tournament.findMany({
    where: { isActive: false },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, createdAt: true, type: true, status: true },
  });
});

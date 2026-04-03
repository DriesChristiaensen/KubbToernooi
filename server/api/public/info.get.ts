import { prisma } from "~/server/utils/prisma";

export default defineEventHandler(async () => {
  const tournament = await prisma.tournament.findFirst({ where: { isActive: true } });
  return {
    type: tournament?.type ?? null,
    poolScheduleLive: tournament?.poolScheduleLive ?? false,
    koScheduleLive: tournament?.koScheduleLive ?? false,
  };
});

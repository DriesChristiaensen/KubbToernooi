import { prisma } from "~/server/utils/prisma";

/**
 * Get whether the referee functionality is currently enabled.
 * Returns true by default when no active tournament exists.
 */
export default defineEventHandler(async () => {
  const tournament = await prisma.tournament.findFirst({
    where: { isActive: true },
    select: { refsEnabled: true },
  });
  return { refsEnabled: tournament?.refsEnabled ?? true };
});

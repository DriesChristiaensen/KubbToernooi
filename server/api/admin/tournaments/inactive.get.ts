import { prisma } from "~/server/utils/prisma";

/**
 * Get all inactive tournaments (admin view).
 * @returns {Array<Object>} Array of inactive tournaments with id, name, createdAt, type, status, sorted by creation date (newest first)
 */
export default defineEventHandler(async (_event) => {
  return await prisma.tournament.findMany({
    where: { isActive: false },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, createdAt: true, type: true, status: true },
  });
});

import { prisma } from "~/server/utils/prisma";
import { getActiveTournament } from "~/server/utils/tournament";

/**
 * Get all fields in the active tournament (admin view).
 * @returns {Array<Object>} Array of fields with id, name, tournamentId, sorted by name
 * @throws {404} If no active tournament exists
 */
export default defineEventHandler(async () => {
  const tournament = await getActiveTournament();

  return prisma.field.findMany({
    where: { tournamentId: tournament.id },
    orderBy: { name: "asc" },
  });
});

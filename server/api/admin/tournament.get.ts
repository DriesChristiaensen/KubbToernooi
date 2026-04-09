import { getActiveTournament } from "~/server/utils/tournament";

/**
 * Get the active tournament details (admin view).
 * @returns {Object} Tournament object with all properties and defaults
 * @throws {404} If no active tournament exists
 */
export default defineEventHandler(async (_event) => {
  return await getActiveTournament();
});

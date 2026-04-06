import { prisma } from "~/server/utils/prisma";
import { logRequest } from "~/server/utils/logger";

/**
 * Delete a team and all its references (cascade delete).
 * @param {string} id - Team ID (path parameter)
 * @returns {null} Empty response body (204 No Content)
 * @throws {400} If team ID is missing
 * @throws {404} If team does not exist
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createApiError({
      error: "Ongeldig ID",
      code: "invalid_team_id",
      reason: "Invalid team ID",
    });
  }

  const team = await prisma.team.findFirst({ where: { id } });
  if (!team) {
    throw createApiError({ error: "Team niet gevonden", code: "team_not_found", reason: "Team not found" });
  }

  await prisma.team.delete({ where: { id } });

  setResponseStatus(event, 204);
  logRequest(event, "success", `Team deleted: id=${id}`);
  return null;
});

import { prisma } from "~/server/utils/prisma";
import { logRequest } from "~/server/utils/logger";

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

  logRequest(event, "success", `Team deleted: id=${id}`);
  return { success: true };
});

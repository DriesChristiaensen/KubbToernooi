import { prisma } from "~/server/utils/prisma";
import { logRequest } from "~/server/utils/logger";
import { getActiveTournament } from "~/server/utils/tournament";

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createApiError({
      error: "Ongeldig ID",
      code: 400,
      reason: "Invalid team ID",
    });
  }

  const tournament = await getActiveTournament();
  const body = await readBody(event);

  if (!body?.name?.trim()) {
    throw createApiError({
      error: "Teamnaam is verplicht",
      code: 400,
      reason: "Missing name field",
    });
  }

  const name = body.name.trim();

  const existing = await prisma.team.findFirst({
    where: { name, tournamentId: tournament.id, id: { not: id } },
  });

  if (existing) {
    throw createApiError({
      error: "Er bestaat al een team met deze naam",
      code: 409,
      reason: "Duplicate team name",
    });
  }

  const team = await prisma.team.update({
    where: { id },
    data: { name },
  });

  logRequest(event, "success", `Team updated: ${team.name}`);
  return team;
});

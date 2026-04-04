import { z } from "zod";
import { prisma } from "~/server/utils/prisma";
import { logRequest } from "~/server/utils/logger";
import { getActiveTournament } from "~/server/utils/tournament";

const bodySchema = z.object({
  name: z.string().trim().min(1, "Team name is required"),
});

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createApiError({
      error: "Ongeldig ID",
      code: "invalid_team_id",
      reason: "Invalid team ID",
    });
  }

  const tournament = await getActiveTournament();
  const raw = await readBody(event);

  let body;
  try {
    body = bodySchema.parse(raw ?? {});
  } catch {
    throw createApiError({
      error: "Teamnaam is verplicht",
      code: "team_name_empty",
      reason: "Missing name field",
    });
  }

  const name = body.name;

  const existing = await prisma.team.findFirst({
    where: { name, tournamentId: tournament.id, id: { not: id } },
  });

  if (existing) {
    throw createApiError({
      error: "Er bestaat al een team met deze naam",
      code: "team_name_exists",
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

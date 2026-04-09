import { z } from "zod";
import { prisma } from "~/server/utils/prisma";
import { logRequest } from "~/server/utils/logger";
import { getActiveTournament } from "~/server/utils/tournament";

const bodySchema = z.object({
  name: z.string().trim().min(1, "Team name is required"),
});

/**
 * Update a team's name in the active tournament.
 * @param {string} id - Team ID (path parameter)
 * @param {Object} body - Request body
 * @param {string} body.name - New team name (unique within tournament, required, non-empty)
 * @returns {Object} Updated team object with id, name, tournamentId
 * @throws {400} If id is missing or name is empty
 * @throws {404} If team does not exist or no active tournament exists
 * @throws {409} If new name already exists in the current tournament (for a different team)
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

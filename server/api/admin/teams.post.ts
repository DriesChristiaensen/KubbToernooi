import { z } from "zod";
import { prisma } from "~/server/utils/prisma";
import { logRequest } from "~/server/utils/logger";
import { getActiveTournament } from "~/server/utils/tournament";

const bodySchema = z.object({
  name: z.string().trim().min(1, "Team name is required"),
});

/**
 * Create a new team in the active tournament.
 * @param {Object} body - Request body
 * @param {string} body.name - Team name (unique within tournament, required, non-empty)
 * @returns {Team} Created team object
 * @throws {400} If name is empty or not provided
 * @throws {404} If no active tournament exists
 * @throws {409} If team name already exists in the current tournament
 */
export default defineEventHandler(async (event) => {
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
    where: { name, tournamentId: tournament.id },
  });

  if (existing) {
    throw createApiError({
      error: "Er bestaat al een team met deze naam",
      code: "team_name_exists",
      reason: "Duplicate team name",
    });
  }

  const team = await prisma.team.create({
    data: { name, tournamentId: tournament.id },
  });

  setResponseStatus(event, 201);
  logRequest(event, "success", `Team created: ${team.name}`);
  return team;
});

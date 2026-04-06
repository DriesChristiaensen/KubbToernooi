import { z } from "zod";
import { prisma } from "~/server/utils/prisma";
import { logRequest } from "~/server/utils/logger";

const bodySchema = z.object({
  teamAId: z.string().optional(),
  teamBId: z.string().optional(),
});

/**
 * Assign teams to a KO bracket match.
 * Only updates unplayed KO matches. Used for assigning teams to bye slots or correcting assignments.
 * @param {string} id - Match ID (path parameter)
 * @param {Object} body - Request body
 * @param {string} [body.teamAId] - Team A ID (optional)
 * @param {string} [body.teamBId] - Team B ID (optional)
 * @returns {Object} Updated match object with teamAId, teamBId, status
 * @throws {400} If id is missing or input validation fails
 * @throws {404} If match does not exist
 * @throws {409} If match is not a KO match or has already been played
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  if (!id) {
    throw createApiError({ error: "Ongeldig wedstrijd-ID", code: "invalid_match_id", reason: "Invalid match ID" });
  }

  const raw = await readBody(event);

  let body;
  try {
    body = bodySchema.parse(raw ?? {});
  } catch {
    throw createApiError({
      error: "Ongeldige invoer",
      code: "invalid_input",
      reason: "Invalid input",
    });
  }

  const match = await prisma.match.findFirst({ where: { id } });
  if (!match) {
    throw createApiError({ error: "Wedstrijd niet gevonden", code: "match_not_found", reason: "Match not found" });
  }

  if (match.phase !== "KO") {
    throw createApiError({
      error: "Alleen KO-wedstrijden kunnen worden aangepast",
      code: "invalid_input",
      reason: "Not a KO match",
    });
  }

  if (match.status === "PLAYED") {
    throw createApiError({
      error: "Gespeelde wedstrijden kunnen niet worden aangepast",
      code: "invalid_input",
      reason: "Match already played",
    });
  }

  const updateData: Record<string, unknown> = {};
  if (body.teamAId !== undefined) updateData.teamAId = body.teamAId;
  if (body.teamBId !== undefined) updateData.teamBId = body.teamBId;

  const updated = await prisma.match.update({ where: { id }, data: updateData });

  logRequest(event, "success", `KO match ${id} adjusted`);
  return updated;
});

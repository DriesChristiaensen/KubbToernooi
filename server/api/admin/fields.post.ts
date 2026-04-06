import { z } from "zod";
import { prisma } from "~/server/utils/prisma";
import { logRequest } from "~/server/utils/logger";
import { getActiveTournament } from "~/server/utils/tournament";

const bodySchema = z.object({
  name: z.string().trim().min(1, "Field name is required"),
});

/**
 * Create a new field in the active tournament.
 * @param {Object} body - Request body
 * @param {string} body.name - Field name (unique within tournament, required, non-empty)
 * @returns {Object} Created field object with id, name, tournamentId
 * @throws {400} If name is empty or not provided
 * @throws {404} If no active tournament exists
 * @throws {409} If field name already exists in the current tournament
 */
export default defineEventHandler(async (event) => {
  const tournament = await getActiveTournament();
  const raw = await readBody(event);

  let body;
  try {
    body = bodySchema.parse(raw ?? {});
  } catch {
    throw createApiError({
      error: "Veldnaam is verplicht",
      code: "field_name_empty",
      reason: "Missing name field",
    });
  }

  const name = body.name;

  const existing = await prisma.field.findFirst({
    where: { name, tournamentId: tournament.id },
  });

  if (existing) {
    throw createApiError({
      error: "Er bestaat al een veld met deze naam",
      code: "field_name_exists",
      reason: "Duplicate field name",
    });
  }

  const field = await prisma.field.create({
    data: { name, tournamentId: tournament.id },
  });

  setResponseStatus(event, 201);
  logRequest(event, "success", `Field created: ${field.name}`);
  return field;
});

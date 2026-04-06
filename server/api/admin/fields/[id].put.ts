import { z } from "zod";
import { prisma } from "~/server/utils/prisma";
import { logRequest } from "~/server/utils/logger";
import { getActiveTournament } from "~/server/utils/tournament";

const bodySchema = z.object({
  name: z.string().trim().min(1, "Field name is required"),
});

/**
 * Update a field's name in the active tournament.
 * @param {string} id - Field ID (path parameter)
 * @param {Object} body - Request body
 * @param {string} body.name - New field name (unique within tournament, required, non-empty)
 * @returns {Object} Updated field object with id, name, tournamentId
 * @throws {400} If id is missing or name is empty
 * @throws {404} If field does not exist
 * @throws {409} If new name already exists in the current tournament (for a different field)
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createApiError({
      error: "Ongeldig ID",
      code: "invalid_field_id",
      reason: "Invalid field ID",
    });
  }

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
    where: { name, tournamentId: tournament.id, id: { not: id } },
  });

  if (existing) {
    throw createApiError({
      error: "Er bestaat al een veld met deze naam",
      code: "field_name_exists",
      reason: "Duplicate field name",
    });
  }

  const field = await prisma.field.update({
    where: { id },
    data: { name },
  });

  logRequest(event, "success", `Field updated: ${field.name}`);
  return field;
});

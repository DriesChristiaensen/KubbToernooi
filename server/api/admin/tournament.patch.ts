import { z } from "zod";
import { prisma } from "~/server/utils/prisma";
import { logRequest } from "~/server/utils/logger";
import { getActiveTournament } from "~/server/utils/tournament";

const bodySchema = z.object({
  status: z.enum(["DRAFT", "LIVE"]).optional(),
  poolScheduleLive: z.boolean().optional(),
  koScheduleLive: z.boolean().optional(),
  qualifyGlobally: z.boolean().optional(),
  globalQualifyingTeams: z.number().int().min(2).optional(),
}).refine(
  (data) => Object.values(data).some((v) => v !== undefined),
  { message: "At least one field must be provided" },
);

/**
 * Update active tournament properties: status and schedule visibility flags.
 * At least one field must be provided; status must be "DRAFT" or "LIVE".
 * @param {Object} body - Request body (at least one field required)
 * @param {string} [body.status] - Tournament status: "DRAFT" or "LIVE"
 * @param {boolean} [body.poolScheduleLive] - Whether pool schedule is public
 * @param {boolean} [body.koScheduleLive] - Whether KO schedule is public
 * @returns {Object} Updated tournament object with id, name, status, poolScheduleLive, koScheduleLive
 * @throws {400} If no fields provided or status is invalid
 * @throws {404} If no active tournament exists
 */
export default defineEventHandler(async (event) => {
  const tournament = await getActiveTournament();
  const raw = await readBody(event);

  let body;
  try {
    body = bodySchema.parse(raw ?? {});
  } catch (error) {
    const parseError = error as z.ZodError;
    const firstIssue = parseError.issues[0];
    const isDutchStatus = firstIssue?.path[0] === "status";
    throw createApiError({
      error: isDutchStatus ? "Ongeldige status" : "Geen geldige velden opgegeven",
      code: "invalid_input",
      reason: isDutchStatus ? "Invalid tournament status" : firstIssue?.message || "Invalid input",
    });
  }

  const data: Record<string, unknown> = {};

  if (body.status !== undefined) {
    data.status = body.status;
  }

  if (body.poolScheduleLive !== undefined) {
    data.poolScheduleLive = body.poolScheduleLive;
  }

  if (body.koScheduleLive !== undefined) {
    data.koScheduleLive = body.koScheduleLive;
  }

  if (body.qualifyGlobally !== undefined) {
    data.qualifyGlobally = body.qualifyGlobally;
  }

  if (body.globalQualifyingTeams !== undefined) {
    data.globalQualifyingTeams = body.globalQualifyingTeams;
  }

  const updated = await prisma.tournament.update({
    where: { id: tournament.id },
    data,
  });

  logRequest(event, "success", `Tournament updated: ${JSON.stringify(data)}`);
  return updated;
});

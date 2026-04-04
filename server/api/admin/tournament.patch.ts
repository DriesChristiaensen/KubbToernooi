import { z } from "zod";
import { prisma } from "~/server/utils/prisma";
import { logRequest } from "~/server/utils/logger";
import { getActiveTournament } from "~/server/utils/tournament";

const bodySchema = z.object({
  status: z.enum(["DRAFT", "LIVE"]).optional(),
  poolScheduleLive: z.boolean().optional(),
  koScheduleLive: z.boolean().optional(),
}).refine(
  (data) => Object.values(data).some((v) => v !== undefined),
  { message: "At least one field must be provided" },
);

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

  const updated = await prisma.tournament.update({
    where: { id: tournament.id },
    data,
  });

  logRequest(event, "success", `Tournament updated: ${JSON.stringify(data)}`);
  return updated;
});

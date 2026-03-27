import { prisma } from "~/server/utils/prisma";
import { logRequest } from "~/server/utils/logger";

export default defineEventHandler(async (event) => {
  const idParam = getRouterParam(event, "id");
  const id = Number(idParam);
  if (!idParam || isNaN(id)) {
    throw createApiError({ error: "Ongeldig wedstrijd-ID", code: 400, reason: "Invalid match ID" });
  }

  const body = await readBody(event);

  const match = await prisma.match.findFirst({ where: { id } });
  if (!match) {
    throw createApiError({ error: "Wedstrijd niet gevonden", code: 404, reason: "Match not found" });
  }

  if (match.phase !== "KO") {
    throw createApiError({
      error: "Alleen KO-wedstrijden kunnen worden aangepast",
      code: 400,
      reason: "Not a KO match",
    });
  }

  if (match.status === "PLAYED") {
    throw createApiError({
      error: "Gespeelde wedstrijden kunnen niet worden aangepast",
      code: 400,
      reason: "Match already played",
    });
  }

  const updateData: Record<string, unknown> = {};
  if (body?.teamAId !== undefined) updateData.teamAId = Number(body.teamAId);
  if (body?.teamBId !== undefined) updateData.teamBId = Number(body.teamBId);

  const updated = await prisma.match.update({ where: { id }, data: updateData });

  logRequest(event, "success", `KO match ${id} adjusted`);
  return updated;
});

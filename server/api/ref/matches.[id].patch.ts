import { prisma } from "~/server/utils/prisma";
import { logRequest } from "~/server/utils/logger";

export default defineEventHandler(async (event) => {
  const idParam = getRouterParam(event, "id");
  const id = Number(idParam);
  if (!idParam || isNaN(id)) {
    throw createApiError({ error: "Ongeldig wedstrijd-ID", code: 400, reason: "Invalid match ID" });
  }

  const body = await readBody(event);
  const scoreA = Number(body?.scoreA);
  const scoreB = Number(body?.scoreB);

  if (!Number.isInteger(scoreA) || scoreA < 0 || !Number.isInteger(scoreB) || scoreB < 0) {
    throw createApiError({
      error: "Score moet een niet-negatief geheel getal zijn",
      code: 400,
      reason: "Invalid score",
    });
  }

  const match = await prisma.match.findFirst({ where: { id } });
  if (!match) {
    throw createApiError({ error: "Wedstrijd niet gevonden", code: 404, reason: "Match not found" });
  }

  const isDraw = scoreA === scoreB;
  const updateData: Record<string, unknown> = { scoreA, scoreB, status: "PLAYED" };

  if (match.phase === "KO" && isDraw) {
    const koWinnerId = body?.koWinnerId ? Number(body.koWinnerId) : null;
    if (!koWinnerId) {
      throw createApiError({
        error: "Winnaar is verplicht bij gelijkspel in een knock-out wedstrijd",
        code: 400,
        reason: "KO winner required on draw",
      });
    }
    if (koWinnerId !== match.teamAId && koWinnerId !== match.teamBId) {
      throw createApiError({
        error: "Winnaar moet één van de spelende teams zijn",
        code: 400,
        reason: "Invalid KO winner",
      });
    }
    updateData.koWinnerId = koWinnerId;
  }

  const updated = await prisma.match.update({ where: { id }, data: updateData });

  logRequest(event, "success", `Match ${id} score saved: ${scoreA}-${scoreB}`);
  return updated;
});

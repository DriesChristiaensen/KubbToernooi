import { prisma } from "~/server/utils/prisma";
import { logRequest } from "~/server/utils/logger";
import { recalculatePoolStandings } from "~/server/utils/standings";

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  if (!id) {
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
    // Safe: ternary guard ensures koWinnerId is truthy before casting
    const koWinnerId = body?.koWinnerId ? (body.koWinnerId as string) : null;
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

  const updated = await prisma.$transaction(async (tx) => {
    // Save match score atomically with KO advancement
    const matchResult = await tx.match.update({ where: { id }, data: updateData });

    if (match.phase === "KO" && match.nextMatchId) {
      const winnerId = scoreA > scoreB
        ? match.teamAId
        : scoreB > scoreA
        ? match.teamBId
        : typeof updateData.koWinnerId === "string"
        ? updateData.koWinnerId
        : match.teamAId;

      if (winnerId) {
        // Determine slot: first sibling → teamA, second sibling → teamB
        const siblings = await tx.match.findMany({
          where: { nextMatchId: match.nextMatchId },
          orderBy: { id: "asc" },
        });
        const isFirst = siblings.length === 0 || siblings[0]?.id === match.id;
        await tx.match.update({
          where: { id: match.nextMatchId },
          data: isFirst ? { teamAId: winnerId } : { teamBId: winnerId },
        });
      }
    }

    return matchResult;
  });

  if (match.phase === "POOL" && match.poolId != null) {
    await recalculatePoolStandings(match.poolId);
  }

  logRequest(event, "success", `Match ${id} score saved: ${scoreA}-${scoreB}`);
  return updated;
});

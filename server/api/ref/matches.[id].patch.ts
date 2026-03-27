import { prisma } from "~/server/utils/prisma";
import { logRequest } from "~/server/utils/logger";
import { recalculatePoolStandings } from "~/server/utils/standings";

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

  if (match.phase === "POOL" && match.poolId != null) {
    await recalculatePoolStandings(match.poolId);
  }

  if (match.phase === "KO") {
    const roundMatches = await prisma.match.findMany({ where: { phase: "KO", round: match.round } });
    if (roundMatches.every((m) => m.status === "PLAYED") && roundMatches.length >= 2) {
      const winners = roundMatches.map((m) => {
        const sa = m.scoreA ?? 0;
        const sb = m.scoreB ?? 0;
        if (sa > sb) return m.teamAId;
        if (sb > sa) return m.teamBId;
        return m.koWinnerId ?? m.teamAId;
      });
      const pairs: Array<{ teamAId: number; teamBId: number; fieldId: number }> = [];
      for (let i = 0; i + 1 < winners.length; i += 2) {
        pairs.push({ teamAId: winners[i]!, teamBId: winners[i + 1]!, fieldId: roundMatches[i]!.fieldId });
      }
      if (pairs.length > 0) {
        const tournament = await prisma.tournament.findFirst();
        if (tournament) {
          const nextRound = match.round + 1;
          const slotMs = (tournament.matchDuration + tournament.breakTime) * 60 * 1000;
          await prisma.match.createMany({
            data: pairs.map((pair) => ({
              phase: "KO" as const,
              round: nextRound,
              fieldId: pair.fieldId,
              teamAId: pair.teamAId,
              teamBId: pair.teamBId,
              poolId: null,
              startTime: new Date(tournament.startTime.getTime() + (nextRound - 1) * slotMs),
              status: "SCHEDULED" as const,
            })),
          });
        }
      }
    }
  }

  logRequest(event, "success", `Match ${id} score saved: ${scoreA}-${scoreB}`);
  return updated;
});

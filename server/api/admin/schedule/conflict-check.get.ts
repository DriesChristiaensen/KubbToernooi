import { prisma } from "~/server/utils/prisma";
import { getActiveTournament } from "~/server/utils/tournament";

export default defineEventHandler(async (event) => {
  await getActiveTournament();
  const query = getQuery(event);

  if (!query.matchId) {
    throw createApiError({
      error: "matchId is verplicht",
      code: 400,
      reason: "matchId is required",
    });
  }

  const matchId = query.matchId as string;
  const proposedFieldId = query.fieldId ? (query.fieldId as string) : undefined;
  const proposedStartTime = query.startTime ? new Date(query.startTime as string) : undefined;

  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) {
    throw createApiError({
      error: "Wedstrijd niet gevonden",
      code: 404,
      reason: "Match not found",
    });
  }

  const checkFieldId = proposedFieldId ?? match.fieldId;
  const checkStartTime = proposedStartTime ?? match.startTime;

  const conflictingMatches = await prisma.match.findMany({
    where: {
      id: { not: matchId as string },
      startTime: checkStartTime,
    },
  });

  const conflicts: string[] = [];

  const fieldConflict = conflictingMatches.find((m) => m.fieldId === checkFieldId);
  if (fieldConflict) conflicts.push("Veld is al bezet op dit tijdstip");

  const teamConflict = conflictingMatches.find(
    (m) =>
      m.teamAId === match.teamAId ||
      m.teamBId === match.teamAId ||
      m.teamAId === match.teamBId ||
      m.teamBId === match.teamBId,
  );
  if (teamConflict) conflicts.push("Een van de teams speelt al een andere wedstrijd op dit tijdstip");

  return { ok: conflicts.length === 0, conflicts };
});

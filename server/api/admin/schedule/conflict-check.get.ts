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

  // Safe: !query.matchId guard above ensures this is a non-empty string
  const matchId = query.matchId as string;
  // Safe: ternary guard ensures fieldId/startTime are defined before casting
  const proposedFieldId = query.fieldId ? (query.fieldId as string) : undefined;
  let proposedStartTime: Date | undefined;
  if (query.startTime) {
    const parsed = new Date(query.startTime as string);
    if (isNaN(parsed.getTime())) {
      throw createApiError({ error: "Ongeldig tijdstip", code: 400, reason: "startTime is not a valid date" });
    }
    proposedStartTime = parsed;
  }

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { teamA: true, teamB: true },
  });
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
    where: { id: { not: matchId }, startTime: checkStartTime },
    include: { field: true, teamA: true, teamB: true },
  });

  const conflicts: string[] = [];

  const fieldConflict = conflictingMatches.find((m) => m.fieldId === checkFieldId);
  if (fieldConflict) {
    const fieldName = fieldConflict.field?.name ?? checkFieldId;
    const tA = fieldConflict.teamA?.name ?? "?";
    const tB = fieldConflict.teamB?.name ?? "?";
    conflicts.push(`Veld ${fieldName} is al bezet: ${tA} vs ${tB}`);
  }

  // Null guards prevent null === null false positives from bye/empty KO slots
  const teamConflict = conflictingMatches.find(
    (m) =>
      (match.teamAId !== null && (m.teamAId === match.teamAId || m.teamBId === match.teamAId)) ||
      (match.teamBId !== null && (m.teamAId === match.teamBId || m.teamBId === match.teamBId)),
  );
  if (teamConflict) {
    const tA = match.teamA?.name ?? "?";
    const tB = match.teamB?.name ?? "?";
    conflicts.push(`${tA} of ${tB} speelt al een andere wedstrijd op dit tijdstip`);
  }

  return { ok: conflicts.length === 0, conflicts };
});

import { prisma } from "~/server/utils/prisma";
import { getActiveTournament } from "~/server/utils/tournament";

/**
 * Check for scheduling conflicts before updating a match.
 * Validates whether a proposed field+time combination conflicts with existing matches.
 * @param {Object} query - Query parameters
 * @param {string} query.matchId - Match ID to check (required)
 * @param {string} [query.fieldId] - Proposed field ID (defaults to match's current field)
 * @param {string} [query.startTime] - Proposed start time in ISO 8601 format (defaults to match's current time)
 * @returns {Object} Conflict check result: { ok: boolean, conflicts: string[] }
 * @throws {400} If matchId is missing or startTime is invalid
 * @throws {404} If match does not exist or no active tournament exists
 */
export default defineEventHandler(async (event) => {
  await getActiveTournament();
  const query = getQuery(event);

  if (!query.matchId) {
    throw createApiError({
      error: "matchId is verplicht",
      code: "invalid_match_id",
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
      throw createApiError({ error: "Ongeldig tijdstip", code: "invalid_date", reason: "startTime is not a valid date" });
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
      code: "match_not_found",
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

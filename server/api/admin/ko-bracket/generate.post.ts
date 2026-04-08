import { z } from "zod";
import { prisma } from "~/server/utils/prisma";
import { logRequest } from "~/server/utils/logger";
import { getActiveTournament } from "~/server/utils/tournament";

const bodySchema = z.object({
  overwrite: z.boolean().optional(),
  startDateTime: z
    .string()
    .refine((s) => !isNaN(new Date(s).getTime()), { message: "Invalid date" })
    .refine((s) => /T|:/.test(s), {
      message: "startDateTime must include a time component",
    })
    .optional(),
});

/**
 * Generate KO bracket matches with automatic bye advancement to next round.
 * Bracket size is computed as next power of 2 ≥ participant count.
 * Bye teams (only teamA, no teamB) are automatically advanced to their nextMatch.
 * @param {Object} body - Request body
 * @param {boolean} [body.overwrite=false] - If true, delete existing KO matches before regenerating
 * @param {string} [body.startDateTime] - KO phase start date/time (ISO 8601). Defaults to tournament.startTime
 * @returns {Object} Generated match count: { generated: number }
 * @throws {400} If startDateTime invalid, or insufficient teams/standings to fill bracket
 * @throws {400} If tournament type is POOLS but not enough pools have standings
 * @throws {409} If KO matches already exist and overwrite is false
 */
export default defineEventHandler(async (event) => {
  const raw = await readBody(event);
  const body = bodySchema.parse(raw ?? {});
  const overwrite = body.overwrite === true;

  const tournament = await getActiveTournament();

  const existingCount = await prisma.match.count({ where: { phase: "KO", tournamentId: tournament.id } });
  if (existingCount > 0 && !overwrite) {
    throw createApiError({
      error: "Er is al een KO-schema. Gebruik overwrite om te vervangen.",
      code: "ko_matches_exist",
      reason: "KO matches already exist",
    });
  }

  const fields = await prisma.field.findMany({
    where: { tournamentId: tournament.id },
  });
  if (fields.length === 0) {
    throw createApiError({
      error: "Geen velden beschikbaar voor KO-wedstrijden",
      code: "no_fields_available",
      reason: "No fields available for KO matches",
    });
  }

  let participantCount: number;

  if (tournament.type === "KNOCKOUT") {
    const teams = await prisma.team.findMany({
      where: { tournamentId: tournament.id },
    });
    if (teams.length < 2) {
      throw createApiError({
        error: "Niet genoeg teams om KO-schema te genereren",
        code: "not_enough_teams_ko",
        reason: "Not enough teams to generate KO bracket",
      });
    }
    participantCount = teams.length;
  } else {
    const pools = await prisma.pool.findMany({
      where: { tournamentId: tournament.id },
      include: {
        standings: {
          orderBy: [
            { points: "desc" },
            { goalDifference: "desc" },
            { goalsFor: "desc" },
          ],
        },
      },
    });

    if (pools.length === 0) {
      throw createApiError({
        error: "Niet genoeg poule-standen om KO-schema te genereren",
        code: "not_enough_standings_ko",
        reason: "Not enough standings to generate KO bracket",
      });
    }

    participantCount = pools.reduce(
      (sum, pool) => sum + pool.teamsAdvancing,
      0,
    );

    if (participantCount < 2) {
      throw createApiError({
        error: "Niet genoeg poule-standen om KO-schema te genereren",
        code: "not_enough_standings_ko",
        reason: "Not enough standings to generate KO bracket",
      });
    }
  }

  const bracketSize = Math.pow(2, Math.ceil(Math.log2(participantCount)));
  const round1Count = bracketSize / 2;
  const totalRounds = Math.log2(bracketSize);

  const matchStartTime = body.startDateTime
    ? new Date(body.startDateTime)
    : new Date(tournament.startTime);
  const slotMs = (tournament.matchDuration + tournament.breakTime) * 60 * 1000;

  let totalCreated = 0;

  await prisma.$transaction(async (tx) => {
    // Atomically delete old KO matches and create new bracket
    if (existingCount > 0) {
      await tx.match.deleteMany({ where: { phase: "KO", tournamentId: tournament.id } });
    }

    const roundMatchIds = new Map<number, string[]>();

    for (let r = totalRounds; r >= 1; r--) {
      const matchesInRound = Math.ceil(round1Count / Math.pow(2, r - 1));
      const nextRoundIds = roundMatchIds.get(r + 1) ?? [];
      const createdIds: string[] = [];

      for (let i = 0; i < matchesInRound; i++) {
        const nextMatchId =
          nextRoundIds.length > 0 ? nextRoundIds[Math.floor(i / 2)] : null;
        // Safe: fields.length === 0 guard above guarantees at least one field exists
        const field = fields[i % fields.length]!;
        const slotOffset = Math.floor(i / fields.length);

        const created = await tx.match.create({
          data: {
            phase: "KO",
            round: r,
            tournamentId: tournament.id,
            fieldId: field.id,
            teamAId: null,
            teamBId: null,
            poolId: null,
            startTime: new Date(matchStartTime.getTime() + slotOffset * slotMs),
            status: "SCHEDULED",
            ...(nextMatchId !== null ? { nextMatchId } : {}),
          },
        });

        createdIds.push(created.id);
        totalCreated++;
      }

      roundMatchIds.set(r, createdIds);
    }
  });

  setResponseStatus(event, 201);
  logRequest(event, "success", `Generated ${totalCreated} KO match slots`);
  return { generated: totalCreated };
});

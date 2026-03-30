import { z } from "zod";
import { prisma } from "~/server/utils/prisma";
import { logRequest } from "~/server/utils/logger";

const bodySchema = z.object({
  overwrite: z.boolean().optional(),
  startDateTime: z.string().optional(),
});

function buildRound1Slots(
  participants: { teamId: number }[],
  bracketSize: number,
): Array<{ teamAId: number | null; teamBId: number | null }> {
  const n = participants.length;
  const byes = bracketSize - n;
  const slots: Array<{ teamAId: number | null; teamBId: number | null }> = [];

  // Top seeds get byes (teamB = null, team advances automatically)
  for (let i = 0; i < byes; i++) {
    slots.push({ teamAId: participants[i].teamId, teamBId: null });
  }

  // Remaining participants paired top vs bottom (seed N+1 vs seed byes+N, etc.)
  const remaining = participants.slice(byes);
  const half = Math.floor(remaining.length / 2);
  for (let i = 0; i < half; i++) {
    slots.push({
      teamAId: remaining[i].teamId,
      teamBId: remaining[remaining.length - 1 - i].teamId,
    });
  }

  // Fill any remaining slots with null (shouldn't happen with correct bracket math)
  const round1Count = bracketSize / 2;
  while (slots.length < round1Count) {
    slots.push({ teamAId: null, teamBId: null });
  }

  return slots;
}

export default defineEventHandler(async (event) => {
  const raw = await readBody(event);
  const body = bodySchema.parse(raw ?? {});
  const overwrite = body.overwrite === true;

  const tournament = await prisma.tournament.findFirst();
  if (!tournament) {
    throw createApiError({
      error: "Geen toernooi gevonden",
      code: 404,
      reason: "No tournament found",
    });
  }

  const existingCount = await prisma.match.count({ where: { phase: "KO" } });
  if (existingCount > 0 && !overwrite) {
    throw createApiError({
      error: "Er is al een KO-schema. Gebruik overwrite om te vervangen.",
      code: 409,
      reason: "KO matches already exist",
    });
  }

  const fields = await prisma.field.findMany();
  if (fields.length === 0) {
    throw createApiError({
      error: "Geen velden beschikbaar voor KO-wedstrijden",
      code: 400,
      reason: "No fields available for KO matches",
    });
  }

  let participants: { teamId: number }[];

  if (tournament.type === "KNOCKOUT") {
    const teams = await prisma.team.findMany({
      where: { tournamentId: tournament.id },
      orderBy: { id: "asc" },
    });
    if (teams.length < 2) {
      throw createApiError({
        error: "Niet genoeg teams om KO-schema te genereren",
        code: 400,
        reason: "Not enough teams to generate KO bracket",
      });
    }
    participants = teams.map((t) => ({ teamId: t.id }));
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
        code: 400,
        reason: "Not enough standings to generate KO bracket",
      });
    }

    participants = pools.flatMap((pool) =>
      pool.standings.slice(0, pool.teamsAdvancing).map((s) => ({ teamId: s.teamId })),
    );

    if (participants.length < 2) {
      throw createApiError({
        error: "Niet genoeg poule-standen om KO-schema te genereren",
        code: 400,
        reason: "Not enough standings to generate KO bracket",
      });
    }
  }

  if (existingCount > 0) {
    await prisma.match.deleteMany({ where: { phase: "KO" } });
  }

  const n = participants.length;
  const bracketSize = Math.pow(2, Math.ceil(Math.log2(n)));
  const round1Count = bracketSize / 2;
  const totalRounds = Math.log2(bracketSize);
  const round1Slots = buildRound1Slots(participants, bracketSize);

  const matchStartTime = body.startDateTime ? new Date(body.startDateTime) : new Date(tournament.startTime);
  const slotMs = (tournament.matchDuration + tournament.breakTime) * 60 * 1000;

  // Create matches from the final (last round) back to round 1
  // so that nextMatchId can be set when creating earlier rounds
  const roundMatchIds = new Map<number, number[]>();
  let totalCreated = 0;

  for (let r = totalRounds; r >= 1; r--) {
    const matchesInRound = Math.ceil(round1Count / Math.pow(2, r - 1));
    const nextRoundIds = roundMatchIds.get(r + 1) ?? [];
    const createdIds: number[] = [];

    for (let i = 0; i < matchesInRound; i++) {
      const nextMatchId = nextRoundIds.length > 0 ? nextRoundIds[Math.floor(i / 2)] : null;
      const field = fields[i % fields.length];
      const slotOffset = Math.floor(i / fields.length);

      let teamAId: number | null = null;
      let teamBId: number | null = null;
      if (r === 1 && i < round1Slots.length) {
        teamAId = round1Slots[i].teamAId;
        teamBId = round1Slots[i].teamBId;
      }

      const created = await prisma.match.create({
        data: {
          phase: "KO",
          round: r,
          fieldId: field.id,
          teamAId,
          teamBId,
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

  logRequest(event, "success", `Generated ${totalCreated} KO matches`);
  return { generated: totalCreated };
});

import { z } from "zod";
import { prisma } from "~/server/utils/prisma";
import { logRequest } from "~/server/utils/logger";
import { getActiveTournament } from "~/server/utils/tournament";

const bodySchema = z.object({
  overwrite: z.boolean().optional(),
  startDateTime: z.string().optional(),
});

const BYE = "";

function generateRoundRobin(teamIds: string[]): Array<Array<[string, string]>> {
  const n = teamIds.length;
  if (n < 2) return [];

  const teams = [...teamIds];
  if (n % 2 !== 0) teams.push(BYE);

  const N = teams.length;
  const rounds: Array<Array<[string, string]>> = [];

  for (let round = 0; round < N - 1; round++) {
    const roundMatches: Array<[string, string]> = [];
    for (let i = 0; i < N / 2; i++) {
      const a = teams[i];
      const b = teams[N - 1 - i];
      if (a !== BYE && b !== BYE) roundMatches.push([a, b]);
    }
    if (roundMatches.length > 0) rounds.push(roundMatches);
    const last = teams[N - 1];
    for (let i = N - 1; i > 1; i--) teams[i] = teams[i - 1];
    teams[1] = last;
  }

  return rounds;
}

export default defineEventHandler(async (event) => {
  const tournament = await getActiveTournament();
  const raw = await readBody(event);
  const body = bodySchema.parse(raw ?? {});
  const overwrite = body.overwrite === true;
  const baseTime = body.startDateTime ? new Date(body.startDateTime) : tournament.startTime;

  const existingCount = await prisma.match.count({
    where: { pool: { tournamentId: tournament.id }, phase: "POOL" },
  });

  if (existingCount > 0 && !overwrite) {
    throw createApiError({
      error: "Er zijn al wedstrijden gegenereerd. Gebruik overwrite om opnieuw te genereren.",
      code: 409,
      reason: "Matches already exist. Use overwrite:true to regenerate.",
    });
  }

  const [pools, fields] = await Promise.all([
    prisma.pool.findMany({
      where: { tournamentId: tournament.id },
      include: { poolTeams: true },
    }),
    prisma.field.findMany({
      where: { tournamentId: tournament.id },
      orderBy: { id: "asc" },
    }),
  ]);

  if (pools.length === 0) {
    throw createApiError({
      error: "Geen poules gevonden om een schema te genereren",
      code: 400,
      reason: "No pools exist to generate schedule from",
    });
  }

  if (fields.length === 0) {
    throw createApiError({
      error: "Geen velden gevonden om wedstrijden aan toe te wijzen",
      code: 400,
      reason: "No fields exist to assign matches to",
    });
  }

  if (overwrite) {
    await prisma.match.deleteMany({
      where: { pool: { tournamentId: tournament.id }, phase: "POOL" },
    });
  }

  const poolRounds = new Map<string, Array<Array<[string, string]>>>();
  for (const pool of pools) {
    const teamIds = pool.poolTeams.map((pt: { teamId: string }) => pt.teamId);
    poolRounds.set(pool.id, generateRoundRobin(teamIds));
  }

  const maxRounds = Math.max(...Array.from(poolRounds.values()).map((r) => r.length), 0);
  const fieldCount = fields.length;
  const slotDurationMs = (tournament.matchDuration + tournament.breakTime) * 60 * 1000;

  const matchData: Array<{
    phase: "POOL";
    round: number;
    startTime: Date;
    fieldId: string;
    poolId: string;
    teamAId: string;
    teamBId: string;
    status: "SCHEDULED";
  }> = [];

  let slotIndex = 0;

  for (let round = 0; round < maxRounds; round++) {
    const roundMatches: Array<{ poolId: string; teamA: string; teamB: string }> = [];

    for (const [poolId, rounds] of poolRounds) {
      if (round < rounds.length) {
        for (const [a, b] of rounds[round]) {
          roundMatches.push({ poolId, teamA: a, teamB: b });
        }
      }
    }

    for (let batch = 0; batch < roundMatches.length; batch += fieldCount) {
      const batchMatches = roundMatches.slice(batch, batch + fieldCount);
      const slotStart = new Date(baseTime.getTime() + slotIndex * slotDurationMs);

      for (let i = 0; i < batchMatches.length; i++) {
        const m = batchMatches[i];
        matchData.push({
          phase: "POOL",
          round: round + 1,
          startTime: slotStart,
          fieldId: fields[i]!.id,
          poolId: m.poolId,
          teamAId: m.teamA,
          teamBId: m.teamB,
          status: "SCHEDULED",
        });
      }
      slotIndex++;
    }
  }

  await prisma.match.createMany({ data: matchData });

  logRequest(event, "success", `Generated ${matchData.length} pool matches`);
  return { generated: matchData.length };
});

import { z } from "zod";
import { prisma } from "~/server/utils/prisma";
import { logRequest } from "~/server/utils/logger";
import { getActiveTournament } from "~/server/utils/tournament";

const bodySchema = z.object({
  overwrite: z.boolean().optional(),
  startDateTime: z.string()
    .refine((s) => !isNaN(new Date(s).getTime()), { message: "Invalid date" })
    .refine((s) => /T|:/.test(s), { message: "startDateTime must include a time component" })
    .optional(),
});

const BYE = "";

interface RoundQueue {
  poolId: string;
  rounds: Array<Array<[string, string]>>;
  roundIdx: number;
  scheduled: number;
  total: number;
}

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

  const poolRounds = new Map<string, Array<Array<[string, string]>>>();
  for (const pool of pools) {
    const teamIds = pool.poolTeams.map((pt: { teamId: string }) => pt.teamId);
    poolRounds.set(pool.id, generateRoundRobin(teamIds));
  }

  const slotDurationMs = (tournament.matchDuration + tournament.breakTime) * 60 * 1000;

  // Priority-queue over rounds: always schedule the pool furthest behind in completion ratio.
  // For equal-sized pools this produces the same round-interleaved order as before (T7.2).
  // For unequal pools the larger pool gets proportionally more early slots, balancing load (T19).
  const roundQueues: RoundQueue[] = Array.from(poolRounds.entries()).map(([poolId, rounds]) => ({
    poolId,
    rounds,
    roundIdx: 0,
    scheduled: 0,
    total: rounds.reduce((sum, r) => sum + r.length, 0),
  }));

  const allMatches: Array<{ poolId: string; teamA: string; teamB: string; round: number }> = [];
  while (roundQueues.some((q) => q.roundIdx < q.rounds.length)) {
    const available = roundQueues.filter((q) => q.roundIdx < q.rounds.length);
    const best = available.reduce((min, q) =>
      q.scheduled / q.total < min.scheduled / min.total ? q : min,
    );
    const currentRound = best.rounds[best.roundIdx];
    for (const [a, b] of currentRound) {
      allMatches.push({ poolId: best.poolId, teamA: a, teamB: b, round: best.roundIdx + 1 });
    }
    best.scheduled += currentRound.length;
    best.roundIdx++;
  }

  // Greedy packing: assign each match to the earliest available field slot
  // Hard constraint: no team plays in overlapping slots
  const fieldNextSlot = new Map<string, number>(fields.map((f: { id: string }) => [f.id, 0]));
  const teamNextSlot = new Map<string, number>();

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

  for (const m of allMatches) {
    const teamConstraint = Math.max(teamNextSlot.get(m.teamA) ?? 0, teamNextSlot.get(m.teamB) ?? 0);

    // Safe: fields.length === 0 guard above guarantees at least one field exists
    let bestField = fields[0]!;
    let bestSlot = Math.max(fieldNextSlot.get(bestField.id) ?? 0, teamConstraint);

    for (const field of fields) {
      const startSlot = Math.max(fieldNextSlot.get(field.id) ?? 0, teamConstraint);
      if (startSlot < bestSlot) {
        bestSlot = startSlot;
        bestField = field;
      }
    }

    matchData.push({
      phase: "POOL",
      round: m.round,
      startTime: new Date(baseTime.getTime() + bestSlot * slotDurationMs),
      fieldId: bestField.id,
      poolId: m.poolId,
      teamAId: m.teamA,
      teamBId: m.teamB,
      status: "SCHEDULED",
    });

    fieldNextSlot.set(bestField.id, bestSlot + 1);
    teamNextSlot.set(m.teamA, bestSlot + 1);
    teamNextSlot.set(m.teamB, bestSlot + 1);
  }

  await prisma.$transaction(async (tx) => {
    // Atomically delete old matches and create new ones
    if (overwrite) {
      await tx.match.deleteMany({
        where: { pool: { tournamentId: tournament.id }, phase: "POOL" },
      });
    }
    await tx.match.createMany({ data: matchData });
  });

  logRequest(event, "success", `Generated ${matchData.length} pool matches`);
  return { generated: matchData.length };
});

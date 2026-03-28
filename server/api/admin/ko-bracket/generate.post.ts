import { prisma } from "~/server/utils/prisma";
import { logRequest } from "~/server/utils/logger";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const overwrite = body?.overwrite === true;

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
    // COMBINATION / POOLS: take only top teamsAdvancing from each pool
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

  // Pair top-half vs bottom-half: seed 1 vs seed N, seed 2 vs seed N-1, etc.
  const half = Math.floor(participants.length / 2);
  const topHalf = participants.slice(0, half);
  const bottomHalf = participants.slice(participants.length - half).reverse();

  const matchStartTime = new Date(tournament.startTime);
  const slotMs = (tournament.matchDuration + tournament.breakTime) * 60 * 1000;

  const matchData = topHalf.map((top, i) => {
    const bottom = bottomHalf[i];
    const field = fields[i % fields.length];
    const slotOffset = Math.floor(i / fields.length);
    return {
      phase: "KO" as const,
      round: 1,
      fieldId: field.id,
      teamAId: top.teamId,
      teamBId: bottom.teamId,
      poolId: null,
      startTime: new Date(matchStartTime.getTime() + slotOffset * slotMs),
      status: "SCHEDULED" as const,
    };
  });

  await prisma.match.createMany({ data: matchData });

  logRequest(event, "success", `Generated ${matchData.length} KO matches`);
  return { generated: matchData.length };
});

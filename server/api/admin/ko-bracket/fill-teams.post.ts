import { prisma } from "~/server/utils/prisma";
import { logRequest } from "~/server/utils/logger";

function buildRound1Slots(
  participants: { teamId: string }[],
  bracketSize: number,
): Array<{ teamAId: string | null; teamBId: string | null }> {
  const n = participants.length;
  const byes = bracketSize - n;
  const slots: Array<{ teamAId: string | null; teamBId: string | null }> = [];

  for (let i = 0; i < byes; i++) {
    slots.push({ teamAId: participants[i].teamId, teamBId: null });
  }

  const remaining = participants.slice(byes);
  const half = Math.floor(remaining.length / 2);
  for (let i = 0; i < half; i++) {
    slots.push({
      teamAId: remaining[i].teamId,
      teamBId: remaining[remaining.length - 1 - i].teamId,
    });
  }

  const round1Count = bracketSize / 2;
  while (slots.length < round1Count) {
    slots.push({ teamAId: null, teamBId: null });
  }

  return slots;
}

export default defineEventHandler(async (event) => {
  const tournament = await prisma.tournament.findFirst();
  if (!tournament) {
    throw createApiError({
      error: "Geen toernooi gevonden",
      code: 404,
      reason: "No tournament found",
    });
  }

  const koMatches = await prisma.match.findMany({
    where: { phase: "KO" },
    orderBy: [{ round: "asc" }],
  });

  if (koMatches.length === 0) {
    throw createApiError({
      error: "Genereer eerst het KO-schema (stap 1) voor je teams invult",
      code: 400,
      reason: "No KO matches exist to fill teams into",
    });
  }

  let participants: { teamId: string }[];

  if (tournament.type === "KNOCKOUT") {
    const teams = await prisma.team.findMany({
      where: { tournamentId: tournament.id },
      orderBy: { id: "asc" },
    });
    if (teams.length < 2) {
      throw createApiError({
        error: "Niet genoeg teams",
        code: 400,
        reason: "Not enough teams",
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
        error: "Niet genoeg poule-standen",
        code: 400,
        reason: "Not enough standings to fill teams",
      });
    }

    participants = pools.flatMap((pool) =>
      pool.standings.slice(0, pool.teamsAdvancing).map((s) => ({ teamId: s.teamId })),
    );

    if (participants.length < 2) {
      throw createApiError({
        error: "Niet genoeg poule-standen",
        code: 400,
        reason: "Not enough standings to fill teams",
      });
    }
  }

  const round1Matches = koMatches.filter((m) => m.round === 1);
  const bracketSize = round1Matches.length * 2;
  const slots = buildRound1Slots(participants, bracketSize);

  let filled = 0;
  for (let i = 0; i < round1Matches.length; i++) {
    const slot = slots[i] ?? { teamAId: null, teamBId: null };
    await prisma.match.update({
      where: { id: round1Matches[i].id },
      data: { teamAId: slot.teamAId, teamBId: slot.teamBId },
    });
    filled++;
  }

  logRequest(event, "success", `Filled teams into ${filled} KO round-1 matches`);
  return { filled };
});

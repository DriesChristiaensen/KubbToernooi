import { z } from "zod";
import { prisma } from "~/server/utils/prisma";
import { logRequest } from "~/server/utils/logger";
import { getActiveTournament } from "~/server/utils/tournament";

const bodySchema = z.object({
  bracket: z.enum(["A", "B"]).optional().default("A"),
});

function buildRound1Slots(
  participants: { teamId: string }[],
  bracketSize: number,
): Array<{ teamAId: string | null; teamBId: string | null; isByeB: boolean }> {
  const n = participants.length;
  const byes = bracketSize - n;
  const slots: Array<{ teamAId: string | null; teamBId: string | null; isByeB: boolean }> = [];

  for (let i = 0; i < byes; i++) {
    slots.push({ teamAId: participants[i].teamId, teamBId: null, isByeB: true });
  }

  const remaining = participants.slice(byes);
  const half = Math.floor(remaining.length / 2);
  for (let i = 0; i < half; i++) {
    slots.push({
      teamAId: remaining[i].teamId,
      teamBId: remaining[remaining.length - 1 - i].teamId,
      isByeB: false,
    });
  }

  const round1Count = bracketSize / 2;
  while (slots.length < round1Count) {
    slots.push({ teamAId: null, teamBId: null, isByeB: false });
  }

  return slots;
}

/**
 * Fill KO bracket round 1 with teams and auto-advance byes.
 * For KNOCKOUT tournaments, uses all teams. For POOLS tournaments, uses top advancers from each pool.
 * For bracket "B", uses non-qualifying teams (those that didn't reach the A bracket).
 * Bye teams (teamAId set, teamBId null) are automatically marked as PLAYED and advanced to next round.
 * @param {Object} body - Request body
 * @param {string} [body.bracket="A"] - Which bracket to fill: "A" (main KO) or "B" (non-qualifiers)
 * @returns {Object} Count of round-1 matches filled: { filled: number }
 * @throws {404} If no KO matches exist (must generate bracket first) or no active tournament exists
 * @throws {400} If not enough teams/standings to fill the bracket
 */
export default defineEventHandler(async (event) => {
  const raw = await readBody(event);
  const body = bodySchema.parse(raw ?? {});
  const bracket = body.bracket;

  const tournament = await getActiveTournament();

  const koMatches = await prisma.match.findMany({
    where: { phase: "KO", tournamentId: tournament.id, koBracket: bracket },
    orderBy: [{ round: "asc" }],
  });

  if (koMatches.length === 0) {
    throw createApiError({
      error: "Genereer eerst het KO-schema (stap 1) voor je teams invult",
      code: "no_ko_matches",
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
        code: "not_enough_teams_ko",
        reason: "Not enough teams",
      });
    }
    participants = teams.map((t) => ({ teamId: t.id }));
  } else {
    const pools = await prisma.pool.findMany({
      where: { tournamentId: tournament.id },
      orderBy: { name: "asc" },
      include: {
        poolTeams: true,
        standings: {
          orderBy: [
            { points: "desc" },
            { won: "desc" },
            { goalDifference: "desc" },
            { goalsFor: "desc" },
          ],
        },
      },
    });

    if (pools.length === 0) {
      throw createApiError({
        error: "Niet genoeg poule-standen",
        code: "not_enough_standings_ko",
        reason: "Not enough standings to fill teams",
      });
    }

    if (tournament.qualifyGlobally) {
      const total = tournament.globalQualifyingTeams;
      const numPools = pools.length;
      const base = Math.floor(total / numPools);
      const extras = total % numPools;

      // Sort pools: most teams first; tiebreak by cross-pool ranking of their (base)th standing entry
      const poolsSorted = [...pools].sort((a, b) => {
        const teamCountDiff = b.poolTeams.length - a.poolTeams.length;
        if (teamCountDiff !== 0) return teamCountDiff;
        const aNext = a.standings[base];
        const bNext = b.standings[base];
        if (!aNext && !bNext) return a.name.localeCompare(b.name);
        if (!aNext) return 1;
        if (!bNext) return -1;
        const diff =
          bNext.points - aNext.points ||
          bNext.won - aNext.won ||
          bNext.goalDifference - aNext.goalDifference ||
          bNext.goalsFor - aNext.goalsFor;
        return diff !== 0 ? diff : a.name.localeCompare(b.name);
      });

      if (bracket === "A") {
        participants = poolsSorted.flatMap((pool, i) => {
          const allocation = base + (i < extras ? 1 : 0);
          return pool.standings.slice(0, allocation).map((s) => ({ teamId: s.teamId }));
        });
      } else {
        // B bracket: teams that didn't qualify for A bracket
        participants = poolsSorted.flatMap((pool, i) => {
          const allocation = base + (i < extras ? 1 : 0);
          return pool.standings.slice(allocation).map((s) => ({ teamId: s.teamId }));
        });
      }
    } else {
      if (bracket === "A") {
        participants = pools.flatMap((pool) =>
          pool.standings
            .slice(0, pool.teamsAdvancing)
            .map((s) => ({ teamId: s.teamId })),
        );
      } else {
        // B bracket: teams ranked below teamsAdvancing in each pool
        participants = pools.flatMap((pool) =>
          pool.standings
            .slice(pool.teamsAdvancing)
            .map((s) => ({ teamId: s.teamId })),
        );
      }
    }

    if (participants.length < 2) {
      throw createApiError({
        error: "Niet genoeg poule-standen",
        code: "not_enough_standings_ko",
        reason: "Not enough standings to fill teams",
      });
    }
  }

  const round1Matches = koMatches.filter((m) => m.round === 1);
  const bracketSize = round1Matches.length * 2;
  const slots = buildRound1Slots(participants, bracketSize);

  let filled = 0;

  await prisma.$transaction(async (tx) => {
    // Clear all bracket teams and reset bye flags before refilling
    await tx.match.updateMany({
      where: { phase: "KO", tournamentId: tournament.id, koBracket: bracket },
      data: { teamAId: null, teamBId: null, status: "SCHEDULED", isByeA: false, isByeB: false },
    });

    // Atomically fill round-1 teams and auto-advance byes
    for (let i = 0; i < round1Matches.length; i++) {
      const slot = slots[i] ?? { teamAId: null, teamBId: null, isByeB: false };
      await tx.match.update({
        where: { id: round1Matches[i].id },
        data: { teamAId: slot.teamAId, teamBId: slot.teamBId, isByeB: slot.isByeB },
      });
      filled++;
    }

    // Auto-advance bye teams to their next-round match
    for (let i = 0; i < round1Matches.length; i++) {
      const slot = slots[i] ?? { teamAId: null, teamBId: null, isByeB: false };
      // Safe: loop bound (i < round1Matches.length) guarantees this element exists
      const match = round1Matches[i]!;

      if (slot.isByeB && slot.teamAId && match.nextMatchId) {
        const siblings = await tx.match.findMany({
          where: { nextMatchId: match.nextMatchId },
          orderBy: { id: "asc" },
        });
        const isFirst = siblings.length === 0 || siblings[0]?.id === match.id;
        await tx.match.update({
          where: { id: match.nextMatchId },
          data: isFirst ? { teamAId: slot.teamAId } : { teamBId: slot.teamAId },
        });
        await tx.match.update({
          where: { id: match.id },
          data: { status: "PLAYED" },
        });
      }
    }
  });

  logRequest(
    event,
    "success",
    `Filled teams into ${filled} KO round-1 matches (bracket ${bracket})`,
  );
  return { filled };
});

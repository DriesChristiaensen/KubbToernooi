import { prisma } from "~/server/utils/prisma";

/**
 * Get public pool standings for the active tournament.
 * Only visible when tournament is active and poolScheduleLive flag is enabled.
 * Standings are sorted by points, wins, goal difference, and goals for.
 * When qualifyGlobally is true, teamsAdvancing per pool is computed from globalQualifyingTeams.
 * @returns {Array<Object>} Array of pools with standings and teams, sorted by pool name
 */
export default defineEventHandler(async (_event) => {
  const tournament = await prisma.tournament.findFirst({ where: { isActive: true } });

  if (!tournament || !tournament.poolScheduleLive) return [];

  const pools = await prisma.pool.findMany({
    where: { tournamentId: tournament.id },
    include: {
      poolTeams: { include: { team: true } },
      standings: {
        include: { team: true },
        orderBy: [
          { points: "desc" },
          { won: "desc" },
          { goalDifference: "desc" },
          { goalsFor: "desc" },
        ],
      },
    },
    orderBy: { name: "asc" },
  });

  // Fill in zero-standings for any team not yet present in the standings table
  const poolsWithZeros = pools.map((pool) => {
    const standingTeamIds = new Set(pool.standings.map((st) => st.teamId));
    const zeroStandings = pool.poolTeams
      .filter((pt) => !standingTeamIds.has(pt.teamId))
      .map((pt) => ({
        id: `zero-${pt.teamId}`,
        poolId: pool.id,
        teamId: pt.teamId,
        team: pt.team,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDifference: 0,
        points: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));
    return { ...pool, standings: [...pool.standings, ...zeroStandings] };
  });

  if (!tournament.qualifyGlobally) {
    return poolsWithZeros;
  }

  // Compute per-pool teamsAdvancing based on globalQualifyingTeams
  const total = tournament.globalQualifyingTeams;
  const numPools = poolsWithZeros.length;
  if (numPools === 0) return poolsWithZeros;

  const base = Math.floor(total / numPools);
  const extras = total % numPools;

  const poolsSorted = [...poolsWithZeros].sort((a, b) => {
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

  const allocationMap = new Map<string, number>();
  for (let i = 0; i < poolsSorted.length; i++) {
    allocationMap.set(poolsSorted[i]!.id, base + (i < extras ? 1 : 0));
  }

  return poolsWithZeros.map((pool) => ({
    ...pool,
    teamsAdvancing: allocationMap.get(pool.id) ?? base,
  }));
});

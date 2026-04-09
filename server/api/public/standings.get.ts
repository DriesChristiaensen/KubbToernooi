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
      poolTeams: true,
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

  if (!tournament.qualifyGlobally) {
    return pools;
  }

  // Compute per-pool teamsAdvancing based on globalQualifyingTeams
  const total = tournament.globalQualifyingTeams;
  const numPools = pools.length;
  if (numPools === 0) return pools;

  const base = Math.floor(total / numPools);
  const extras = total % numPools;

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

  const allocationMap = new Map<string, number>();
  for (let i = 0; i < poolsSorted.length; i++) {
    allocationMap.set(poolsSorted[i]!.id, base + (i < extras ? 1 : 0));
  }

  return pools.map((pool) => ({
    ...pool,
    teamsAdvancing: allocationMap.get(pool.id) ?? base,
  }));
});

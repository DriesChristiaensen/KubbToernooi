import { prisma } from "~/server/utils/prisma";

export async function recalculatePoolStandings(poolId: string): Promise<void> {
  const [poolTeams, playedMatches, tournament] = await Promise.all([
    prisma.poolTeam.findMany({ where: { poolId } }),
    prisma.match.findMany({ where: { poolId, status: "PLAYED" } }),
    prisma.tournament.findFirst({ where: { isActive: true }, orderBy: { createdAt: "desc" } }),
  ]);

  const pointsWin = tournament?.pointsWin ?? 3;
  const pointsDraw = tournament?.pointsDraw ?? 1;
  const pointsLoss = tournament?.pointsLoss ?? 0;

  // Compute all standings in memory
  const standingsData = poolTeams.map((pt) => {
    const teamMatches = playedMatches.filter(
      (m) => m.teamAId === pt.teamId || m.teamBId === pt.teamId,
    );

    let won = 0;
    let drawn = 0;
    let lost = 0;
    let goalsFor = 0;
    let goalsAgainst = 0;

    for (const m of teamMatches) {
      const isTeamA = m.teamAId === pt.teamId;
      const gf = (isTeamA ? m.scoreA : m.scoreB) ?? 0;
      const ga = (isTeamA ? m.scoreB : m.scoreA) ?? 0;
      goalsFor += gf;
      goalsAgainst += ga;
      if (gf === ga) drawn++;
      else if (gf > ga) won++;
      else lost++;
    }

    const points = won * pointsWin + drawn * pointsDraw + lost * pointsLoss;

    return {
      poolId,
      teamId: pt.teamId,
      played: teamMatches.length,
      won,
      drawn,
      lost,
      goalsFor,
      goalsAgainst,
      goalDifference: goalsFor - goalsAgainst,
      points,
    };
  });

  // Batch delete old standings and recreate them in a single transaction
  await prisma.$transaction(async (tx) => {
    await tx.standing.deleteMany({ where: { poolId } });
    await tx.standing.createMany({
      data: standingsData,
    });
  });
}

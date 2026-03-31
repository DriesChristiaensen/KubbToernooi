import { prisma } from "~/server/utils/prisma";
import { logRequest } from "~/server/utils/logger";
import { getActiveTournament } from "~/server/utils/tournament";

export default defineEventHandler(async (event) => {
  const tournament = await getActiveTournament();
  const body = await readBody(event);

  const poolCount = Number(body?.poolCount);
  if (!Number.isInteger(poolCount) || poolCount <= 0) {
    throw createApiError({
      error: "Aantal poules moet een positief getal zijn",
      code: 400,
      reason: "Invalid pool count",
    });
  }

  const teams = await prisma.team.findMany({
    where: { tournamentId: tournament.id },
  });

  if (teams.length < poolCount) {
    throw createApiError({
      error: "Niet genoeg teams om poules te genereren",
      code: 400,
      reason: "Not enough teams",
    });
  }

  const existing = await prisma.pool.findMany({
    where: { tournamentId: tournament.id },
  });

  if (existing.length > 0 && !body?.overwrite) {
    throw createApiError({
      error: "Er bestaan al poules. Wil je doorgaan?",
      code: 409,
      reason: "Pools already exist",
    });
  }

  if (body?.overwrite) {
    await prisma.pool.deleteMany({ where: { tournamentId: tournament.id } });
  }

  const shuffled = [...teams].sort(() => Math.random() - 0.5);
  const poolData: { name: string; teamIds: string[] }[] = Array.from(
    { length: poolCount },
    (_, i) => ({ name: `Poule ${String.fromCharCode(65 + i)}`, teamIds: [] }),
  );
  shuffled.forEach((team, i) => {
    poolData[i % poolCount].teamIds.push(team.id);
  });

  for (const pool of poolData) {
    const created = await prisma.pool.create({
      data: { name: pool.name, tournamentId: tournament.id },
    });
    if (pool.teamIds.length > 0) {
      await prisma.poolTeam.createMany({
        data: pool.teamIds.map((teamId) => ({ poolId: created.id, teamId })),
      });
    }
  }

  logRequest(event, "success", `Generated ${poolCount} pools`);
  return { generated: poolCount };
});

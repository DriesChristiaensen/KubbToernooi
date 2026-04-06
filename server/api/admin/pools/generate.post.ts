import { z } from "zod";
import { prisma } from "~/server/utils/prisma";
import { logRequest } from "~/server/utils/logger";
import { getActiveTournament } from "~/server/utils/tournament";

const bodySchema = z.object({
  poolCount: z.number().int().positive(),
  overwrite: z.boolean().optional(),
});

/**
 * Generate pools and distribute all teams evenly across them.
 * Pools are named "Poule A", "Poule B", etc. Teams are shuffled and distributed round-robin.
 * @param {Object} body - Request body
 * @param {number} body.poolCount - Number of pools to generate (required, positive integer)
 * @param {boolean} [body.overwrite=false] - If true, delete existing pools and teams assignments before generating
 * @returns {Object} Count of generated pools: { generated: number }
 * @throws {400} If poolCount is invalid (not a positive integer)
 * @throws {400} If not enough teams to distribute (teams.length < poolCount)
 * @throws {404} If no active tournament exists
 * @throws {409} If pools already exist and overwrite is false
 */
export default defineEventHandler(async (event) => {
  const tournament = await getActiveTournament();
  const raw = await readBody(event);

  let body;
  try {
    body = bodySchema.parse(raw ?? {});
  } catch {
    throw createApiError({
      error: "Aantal poules moet een positief getal zijn",
      code: "invalid_input",
      reason: "Invalid pool count",
    });
  }

  const teams = await prisma.team.findMany({
    where: { tournamentId: tournament.id },
  });

  if (teams.length < body.poolCount) {
    throw createApiError({
      error: "Niet genoeg teams om poules te genereren",
      code: "invalid_input",
      reason: "Not enough teams",
    });
  }

  const existing = await prisma.pool.findMany({
    where: { tournamentId: tournament.id },
  });

  if (existing.length > 0 && !body.overwrite) {
    throw createApiError({
      error: "Er bestaan al poules. Wil je doorgaan?",
      code: "invalid_input",
      reason: "Pools already exist",
    });
  }

  const shuffled = [...teams].sort(() => Math.random() - 0.5);
  const poolData: { name: string; teamIds: string[] }[] = Array.from(
    { length: body.poolCount },
    (_, i) => ({ name: `Poule ${String.fromCharCode(65 + i)}`, teamIds: [] }),
  );
  shuffled.forEach((team, i) => {
    poolData[i % body.poolCount].teamIds.push(team.id);
  });

  await prisma.$transaction(async (tx) => {
    // Atomically delete old pools and create new ones
    if (body.overwrite) {
      await tx.pool.deleteMany({ where: { tournamentId: tournament.id } });
    }

    for (const pool of poolData) {
      const created = await tx.pool.create({
        data: { name: pool.name, tournamentId: tournament.id },
      });
      if (pool.teamIds.length > 0) {
        await tx.poolTeam.createMany({
          data: pool.teamIds.map((teamId) => ({ poolId: created.id, teamId })),
        });
      }
    }
  });

  setResponseStatus(event, 201);
  logRequest(event, "success", `Generated ${body.poolCount} pools`);
  return { generated: body.poolCount };
});

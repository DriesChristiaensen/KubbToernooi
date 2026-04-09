import { z } from "zod";
import { prisma } from "~/server/utils/prisma";
import { logRequest } from "~/server/utils/logger";
import { getActiveTournament } from "~/server/utils/tournament";

const bodySchema = z.object({
  name: z.string().min(1).optional(),
  teamsAdvancing: z.number().int().nonnegative().optional(),
  teamIds: z.array(z.string()).optional(),
});

/**
 * Update a pool's properties and team assignments.
 * Atomically updates pool metadata and reassigns teams if teamIds is provided.
 * @param {string} id - Pool ID (path parameter)
 * @param {Object} body - Request body (all fields optional)
 * @param {string} [body.name] - New pool name
 * @param {number} [body.teamsAdvancing] - Number of teams advancing to KO (non-negative)
 * @param {string[]} [body.teamIds] - Complete list of team IDs to assign to pool (replaces existing)
 * @returns {Object} Updated pool object with id, name, teamsAdvancing, tournamentId
 * @throws {400} If id is missing or input validation fails
 * @throws {404} If pool does not exist or no active tournament exists
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  if (!id) {
    throw createApiError({
      error: "Ongeldig poule-ID",
      code: "invalid_pool_id",
      reason: "Invalid pool ID",
    });
  }

  await getActiveTournament();
  const raw = await readBody(event);

  let body;
  try {
    body = bodySchema.parse(raw ?? {});
  } catch {
    throw createApiError({
      error: "Ongeldige invoer",
      code: "invalid_input",
      reason: "Invalid input",
    });
  }

  const pool = await prisma.pool.findFirst({ where: { id } });
  if (!pool) {
    throw createApiError({
      error: "Poule niet gevonden",
      code: "pool_not_found",
      reason: "Pool not found",
    });
  }

  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.teamsAdvancing !== undefined) {
    data.teamsAdvancing = body.teamsAdvancing;
  }

  const updated = await prisma.$transaction(async (tx) => {
    // Atomically update pool and reassign teams
    const poolResult = await tx.pool.update({ where: { id }, data });

    if (Array.isArray(body.teamIds)) {
      await tx.poolTeam.deleteMany({ where: { poolId: id } });
      if (body.teamIds.length > 0) {
        await tx.poolTeam.createMany({
          // Safe: Array.isArray guard above confirms body.teamIds is an array
          data: (body.teamIds as string[]).map((teamId) => ({ poolId: id, teamId })),
        });
      }
    }

    return poolResult;
  });

  logRequest(event, "success", `Pool ${id} updated`);
  return updated;
});

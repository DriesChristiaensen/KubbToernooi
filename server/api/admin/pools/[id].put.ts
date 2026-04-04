import { prisma } from "~/server/utils/prisma";
import { logRequest } from "~/server/utils/logger";
import { getActiveTournament } from "~/server/utils/tournament";

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  if (!id) {
    throw createApiError({
      error: "Ongeldig poule-ID",
      code: 400,
      reason: "Invalid pool ID",
    });
  }

  await getActiveTournament();
  const body = await readBody(event);

  const pool = await prisma.pool.findFirst({ where: { id } });
  if (!pool) {
    throw createApiError({
      error: "Poule niet gevonden",
      code: 404,
      reason: "Pool not found",
    });
  }

  const data: Record<string, unknown> = {};
  if (body?.name !== undefined) data.name = body.name;
  if (body?.teamsAdvancing !== undefined) {
    const n = Number(body.teamsAdvancing);
    if (!Number.isInteger(n) || n < 0) {
      throw createApiError({ error: "Ongeldig aantal doorstoters", code: 400, reason: "teamsAdvancing must be a non-negative integer" });
    }
    data.teamsAdvancing = n;
  }

  const updated = await prisma.$transaction(async (tx) => {
    // Atomically update pool and reassign teams
    const poolResult = await tx.pool.update({ where: { id }, data });

    if (Array.isArray(body?.teamIds)) {
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

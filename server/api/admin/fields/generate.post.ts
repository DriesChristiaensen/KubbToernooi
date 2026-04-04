import { prisma } from "~/server/utils/prisma";
import { logRequest } from "~/server/utils/logger";
import { getActiveTournament } from "~/server/utils/tournament";

export default defineEventHandler(async (event) => {
  const tournament = await getActiveTournament();
  const body = await readBody(event);

  const count = Number(body?.count);
  if (!Number.isInteger(count) || count <= 0) {
    throw createApiError({
      error: "Aantal is verplicht en moet een positief getal zijn",
      code: 400,
      reason: "Invalid count",
    });
  }

  const existing = await prisma.field.findMany({
    where: { tournamentId: tournament.id },
  });

  if (existing.length > 0 && !body?.overwrite) {
    throw createApiError({
      error: "Er bestaan al velden. Wil je doorgaan?",
      code: 409,
      reason: "Fields already exist",
    });
  }

  const data = Array.from({ length: count }, (_, i) => ({
    name: `Veld ${i + 1}`,
    tournamentId: tournament.id,
  }));

  const result = await prisma.$transaction(async (tx) => {
    // Atomically delete old fields and create new ones
    if (body?.overwrite) {
      await tx.field.deleteMany({ where: { tournamentId: tournament.id } });
    }
    return tx.field.createMany({ data });
  });

  logRequest(event, "success", `Generated ${result.count} fields`);
  return { generated: result.count };
});

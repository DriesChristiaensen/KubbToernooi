import { z } from "zod";
import { prisma } from "~/server/utils/prisma";
import { logRequest } from "~/server/utils/logger";
import { getActiveTournament } from "~/server/utils/tournament";

const bodySchema = z.object({
  count: z.number().int().positive(),
  overwrite: z.boolean().optional(),
});

export default defineEventHandler(async (event) => {
  const tournament = await getActiveTournament();
  const raw = await readBody(event);

  let body;
  try {
    body = bodySchema.parse(raw ?? {});
  } catch {
    throw createApiError({
      error: "Aantal is verplicht en moet een positief getal zijn",
      code: "invalid_input",
      reason: "Invalid count",
    });
  }

  const existing = await prisma.field.findMany({
    where: { tournamentId: tournament.id },
  });

  if (existing.length > 0 && !body.overwrite) {
    throw createApiError({
      error: "Er bestaan al velden. Wil je doorgaan?",
      code: "invalid_input",
      reason: "Fields already exist",
    });
  }

  const data = Array.from({ length: body.count }, (_, i) => ({
    name: `Veld ${i + 1}`,
    tournamentId: tournament.id,
  }));

  const result = await prisma.$transaction(async (tx) => {
    // Atomically delete old fields and create new ones
    if (body.overwrite) {
      await tx.field.deleteMany({ where: { tournamentId: tournament.id } });
    }
    return tx.field.createMany({ data });
  });

  logRequest(event, "success", `Generated ${result.count} fields`);
  return { generated: result.count };
});

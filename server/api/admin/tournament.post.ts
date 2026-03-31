import { prisma } from "~/server/utils/prisma";
import { logRequest } from "~/server/utils/logger";

const VALID_TYPES = ["POOLS", "KNOCKOUT", "COMBINATION"] as const;

export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  if (!body?.name?.trim()) {
    throw createApiError({
      error: "Naam is verplicht",
      code: 400,
      reason: "Missing tournament name",
    });
  }

  if (!VALID_TYPES.includes(body.type)) {
    throw createApiError({
      error: "Ongeldig competitietype",
      code: 400,
      reason: "Invalid tournament type",
    });
  }

  const fieldCount = Number(body.fieldCount);
  if (!fieldCount || fieldCount < 1) {
    throw createApiError({
      error: "Aantal velden moet minimaal 1 zijn",
      code: 400,
      reason: "Invalid fieldCount",
    });
  }

  const existing = await prisma.tournament.findFirst({ where: { isActive: true } });
  if (existing) {
    await prisma.tournament.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    });
  }

  const tournament = await prisma.tournament.create({
    data: {
      name: body.name.trim(),
      type: body.type,
      startTime: new Date(body.startTime),
      matchDuration: Number(body.matchDuration),
      breakTime: Number(body.breakTime),
      pointsWin: Number(body.pointsWin),
      pointsDraw: Number(body.pointsDraw),
      pointsLoss: Number(body.pointsLoss),
      isActive: true,
      status: "DRAFT",
    },
  });

  await prisma.field.createMany({
    data: Array.from({ length: fieldCount }, (_, i) => ({
      name: `Veld ${i + 1}`,
      tournamentId: tournament.id,
    })),
  });

  logRequest(event, "success", `Tournament created: ${tournament.name}`);
  return tournament;
});

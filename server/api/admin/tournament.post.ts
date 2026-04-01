import { z } from "zod";
import { prisma } from "~/server/utils/prisma";
import { logRequest } from "~/server/utils/logger";

const bodySchema = z.object({
  name: z.string().trim().min(1),
  type: z.enum(["POOLS", "KNOCKOUT", "COMBINATION"]),
  startTime: z.string().refine((s) => !isNaN(new Date(s).getTime()), { message: "Invalid date" }),
  matchDuration: z.number().int().positive(),
  breakTime: z.number().int().min(0),
  pointsWin: z.number().int(),
  pointsDraw: z.number().int(),
  pointsLoss: z.number().int(),
  fieldCount: z.number().int().min(1),
});

export default defineEventHandler(async (event) => {
  const raw = await readBody(event);
  const parsed = bodySchema.safeParse(raw ?? {});

  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    // Safe: path[0] is string | number | undefined; string comparison below is false for non-strings
    const field = firstIssue?.path[0] as string | undefined;
    const isDutchName = field === "name";
    throw createApiError({
      error: isDutchName ? "Naam is verplicht" : "Ongeldige invoer",
      code: 400,
      reason: parsed.error.issues.map((i) => i.message).join("; "),
    });
  }

  const body = parsed.data;

  const existing = await prisma.tournament.findFirst({ where: { isActive: true } });
  if (existing) {
    await prisma.tournament.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    });
  }

  const tournament = await prisma.tournament.create({
    data: {
      name: body.name,
      type: body.type,
      startTime: new Date(body.startTime),
      matchDuration: body.matchDuration,
      breakTime: body.breakTime,
      pointsWin: body.pointsWin,
      pointsDraw: body.pointsDraw,
      pointsLoss: body.pointsLoss,
      isActive: true,
      status: "DRAFT",
    },
  });

  await prisma.field.createMany({
    data: Array.from({ length: body.fieldCount }, (_, i) => ({
      name: `Veld ${i + 1}`,
      tournamentId: tournament.id,
    })),
  });

  logRequest(event, "success", `Tournament created: ${tournament.name}`);
  return tournament;
});

import { z } from "zod";
import { prisma } from "~/server/utils/prisma";
import { logRequest } from "~/server/utils/logger";

const bodySchema = z.object({
  name: z.string().trim().min(1),
  type: z.enum(["POOLS", "KNOCKOUT", "COMBINATION"]),
  startTime: z.string()
    .refine((s) => !isNaN(new Date(s).getTime()), { message: "Invalid date" })
    .refine((s) => /T|:/.test(s), { message: "startTime must include a time component" }),
  matchDuration: z.number().int().positive(),
  breakTime: z.number().int().min(0),
  pointsWin: z.number().int(),
  pointsDraw: z.number().int(),
  pointsLoss: z.number().int(),
  fieldCount: z.number().int().min(1),
  hasBKnockout: z.boolean().optional(),
});

/**
 * Create a new tournament and deactivate any existing active tournament.
 * Atomically creates the tournament and initial fields in a single transaction.
 * @param {Object} body - Request body
 * @param {string} body.name - Tournament name (unique, required)
 * @param {string} body.type - Tournament type: POOLS, KNOCKOUT, or COMBINATION
 * @param {string} body.startTime - Tournament start date/time (ISO 8601 with time component)
 * @param {number} body.matchDuration - Match duration in minutes (positive)
 * @param {number} body.breakTime - Break time between matches in minutes (≥0)
 * @param {number} body.pointsWin - Points awarded for a win
 * @param {number} body.pointsDraw - Points awarded for a draw
 * @param {number} body.pointsLoss - Points awarded for a loss
 * @param {number} body.fieldCount - Number of initial fields to create (≥1)
 * @returns {Tournament} Created tournament with fields initialized
 * @throws {400} If name is empty or invalid, or matchDuration < 1
 * @throws {409} If name already exists
 */
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
      code: "invalid_input",
      reason: parsed.error.issues.map((i) => i.message).join("; "),
    });
  }

  const body = parsed.data;

  const duplicate = await prisma.tournament.findFirst({ where: { name: body.name } });
  if (duplicate) {
    throw createApiError({
      error: 'Er bestaat al een toernooi met deze naam',
      code: "tournament_name_exists",
      reason: 'Tournament name already exists',
      field: 'name',
    });
  }

  const { tournament } = await prisma.$transaction(async (tx) => {
    // Atomically deactivate old tournament and create new one
    const existing = await tx.tournament.findFirst({ where: { isActive: true } });
    if (existing) {
      await tx.tournament.updateMany({
        where: { isActive: true },
        data: { isActive: false },
      });
    }

    const newTournament = await tx.tournament.create({
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
        hasBKnockout: body.hasBKnockout ?? false,
      },
    });

    // Create initial fields in same transaction
    await tx.field.createMany({
      data: Array.from({ length: body.fieldCount }, (_, i) => ({
        name: `Veld ${i + 1}`,
        tournamentId: newTournament.id,
      })),
    });

    return { tournament: newTournament };
  });

  setResponseStatus(event, 201);
  logRequest(event, "success", `Tournament created: ${tournament.name}`);
  return tournament;
});

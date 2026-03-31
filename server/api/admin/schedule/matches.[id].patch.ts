import { prisma } from "~/server/utils/prisma";
import { logRequest } from "~/server/utils/logger";
import { getActiveTournament } from "~/server/utils/tournament";

export default defineEventHandler(async (event) => {
  await getActiveTournament();
  const id = getRouterParam(event, "id") as string;
  const body = await readBody(event);

  const match = await prisma.match.findUnique({ where: { id } });
  if (!match) {
    throw createApiError({
      error: "Wedstrijd niet gevonden",
      code: 404,
      reason: "Match not found",
    });
  }

  const newFieldId = body?.fieldId !== undefined ? (body.fieldId as string) : match.fieldId;
  const newStartTime = body?.startTime !== undefined ? new Date(body.startTime) : match.startTime;

  if (body?.fieldId !== undefined) {
    const field = await prisma.field.findFirst({ where: { id: newFieldId } });
    if (!field) {
      throw createApiError({
        error: "Veld niet gevonden",
        code: 404,
        reason: "Field not found",
      });
    }
  }

  const conflicting = await prisma.match.findMany({
    where: { id: { not: id }, startTime: newStartTime },
  });

  const fieldConflict = conflicting.find((m) => m.fieldId === newFieldId);
  const teamConflict = conflicting.find(
    (m) =>
      m.teamAId === match.teamAId ||
      m.teamBId === match.teamAId ||
      m.teamAId === match.teamBId ||
      m.teamBId === match.teamBId,
  );

  if (fieldConflict || teamConflict) {
    throw createApiError({
      error: "Conflict gevonden: veld of team is al bezet op dit tijdstip",
      code: 409,
      reason: "Conflict detected: field or team already booked at this time",
    });
  }

  const updated = await prisma.match.update({
    where: { id },
    data: { fieldId: newFieldId, startTime: newStartTime },
  });

  logRequest(event, "success", `Match ${id} updated: field=${newFieldId}, time=${newStartTime}`);
  return updated;
});

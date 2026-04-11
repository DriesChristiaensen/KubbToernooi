import { z } from "zod";
import { prisma } from "~/server/utils/prisma";
import { logRequest } from "~/server/utils/logger";

const bodySchema = z.object({
  teamAId: z.string().nullable().optional(),
  teamBId: z.string().nullable().optional(),
  startTime: z.string().datetime().optional(),
  fieldId: z.string().optional(),
  isByeA: z.boolean().optional(),
  isByeB: z.boolean().optional(),
});

/**
 * Assign teams to a KO bracket match.
 * Only updates unplayed KO matches. Used for assigning teams to bye slots or correcting assignments.
 * @param {string} id - Match ID (path parameter)
 * @param {Object} body - Request body
 * @param {string} [body.teamAId] - Team A ID (optional)
 * @param {string} [body.teamBId] - Team B ID (optional)
 * @returns {Object} Updated match object with teamAId, teamBId, status
 * @throws {400} If id is missing or input validation fails
 * @throws {404} If match does not exist
 * @throws {409} If match is not a KO match or has already been played
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  if (!id) {
    throw createApiError({ error: "Ongeldig wedstrijd-ID", code: "invalid_match_id", reason: "Invalid match ID" });
  }

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

  const match = await prisma.match.findFirst({ where: { id } });
  if (!match) {
    throw createApiError({ error: "Wedstrijd niet gevonden", code: "match_not_found", reason: "Match not found" });
  }

  if (match.phase !== "KO") {
    throw createApiError({
      error: "Alleen KO-wedstrijden kunnen worden aangepast",
      code: "invalid_input",
      reason: "Not a KO match",
    });
  }

  // Block editing only if score is already filled in
  if (match.scoreA !== null || match.scoreB !== null) {
    throw createApiError({
      error: "Wedstrijden met een score kunnen niet worden aangepast",
      code: "invalid_input",
      reason: "Match already has a score",
    });
  }

  const updateData: Record<string, unknown> = {};
  if (body.teamAId !== undefined) updateData.teamAId = body.teamAId;
  if (body.teamBId !== undefined) updateData.teamBId = body.teamBId;
  if (body.startTime !== undefined) updateData.startTime = new Date(body.startTime);
  if (body.fieldId !== undefined) {
    const field = await prisma.field.findFirst({ where: { id: body.fieldId } });
    if (!field) {
      throw createApiError({ error: "Veld niet gevonden", code: "field_not_found", reason: "Field not found" });
    }
    updateData.fieldId = body.fieldId;
  }

  const isByeA = body.isByeA ?? false;
  const isByeB = body.isByeB ?? false;
  const wasBye = match.isByeA || match.isByeB;
  const effectiveTeamAId = body.teamAId !== undefined ? body.teamAId : match.teamAId;
  const effectiveTeamBId = body.teamBId !== undefined ? body.teamBId : match.teamBId;

  updateData.isByeA = isByeA;
  updateData.isByeB = isByeB;

  if (isByeB && effectiveTeamAId) {
    updateData.status = "PLAYED";
  } else if (isByeA && effectiveTeamBId) {
    updateData.status = "PLAYED";
  } else if (wasBye && !isByeA && !isByeB) {
    updateData.status = "SCHEDULED";
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.match.update({ where: { id }, data: updateData, include: { field: true, teamA: true, teamB: true } });

    if (match.nextMatchId) {
      const advancingTeamId = isByeB ? effectiveTeamAId : isByeA ? effectiveTeamBId : null;
      if (advancingTeamId) {
        const siblings = await tx.match.findMany({
          where: { nextMatchId: match.nextMatchId },
          orderBy: { id: "asc" },
        });
        const isFirst = siblings.length === 0 || siblings[0]?.id === id;
        await tx.match.update({
          where: { id: match.nextMatchId },
          data: isFirst ? { teamAId: advancingTeamId } : { teamBId: advancingTeamId },
        });
      } else if (wasBye && !isByeA && !isByeB) {
        const prevAdvancedId = match.isByeB ? match.teamAId : match.teamBId;
        if (prevAdvancedId) {
          const nextMatch = await tx.match.findFirst({ where: { id: match.nextMatchId } });
          if (nextMatch?.teamAId === prevAdvancedId) {
            await tx.match.update({ where: { id: match.nextMatchId }, data: { teamAId: null } });
          } else if (nextMatch?.teamBId === prevAdvancedId) {
            await tx.match.update({ where: { id: match.nextMatchId }, data: { teamBId: null } });
          }
        }
      }
    }

    return result;
  });

  logRequest(event, "success", `KO match ${id} adjusted`);
  return updated;
});

import { z } from "zod";
import { prisma } from "~/server/utils/prisma";
import { logRequest } from "~/server/utils/logger";
import { getActiveTournament } from "~/server/utils/tournament";

function parseCSV(csv: string): string[] {
  return csv
    .split("\n")
    .map((line) => line.split(",")[0].replace(/^"|"$/g, "").trim())
    .filter((name) => name.length > 0);
}

const bodySchema = z.object({
  csv: z.string().optional(),
  names: z.array(z.string()).optional(),
});

export default defineEventHandler(async (event) => {
  const tournament = await getActiveTournament();
  const raw = await readBody(event);

  let body;
  try {
    body = bodySchema.parse(raw ?? {});
  } catch {
    throw createApiError({
      error: "Voer teams in via CSV of namenlijst",
      code: "invalid_input",
      reason: "Invalid input format",
    });
  }

  const names: string[] = body?.csv
    ? parseCSV(body.csv)
    : (body?.names ?? []).map((n) => n.trim()).filter((n) => n.length > 0);

  if (names.length === 0) {
    throw createApiError({
      error: "Voer minstens één teamnaam in",
      code: "invalid_input",
      reason: "Empty names list",
    });
  }

  const unique = new Set(names);
  if (unique.size !== names.length) {
    throw createApiError({
      error: "Dubbele namen in de lijst",
      code: "invalid_input",
      reason: "Duplicates within list",
    });
  }

  const existing = await prisma.team.findMany({
    where: { tournamentId: tournament.id },
    select: { name: true },
  });
  const existingNames = new Set(existing.map((t) => t.name));
  const conflicts = names.filter((n) => existingNames.has(n));

  if (conflicts.length > 0) {
    throw createApiError({
      error: `Deze teams bestaan al: ${conflicts.join(", ")}`,
      code: "team_name_exists",
      reason: "Duplicates in database",
    });
  }

  const result = await prisma.team.createMany({
    data: names.map((name) => ({ name, tournamentId: tournament.id })),
  });

  setResponseStatus(event, 201);
  logRequest(event, "success", `Bulk imported ${result.count} teams`);
  return { imported: result.count };
});

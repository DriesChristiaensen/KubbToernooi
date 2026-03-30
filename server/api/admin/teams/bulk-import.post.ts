import { prisma } from "~/server/utils/prisma";
import { logRequest } from "~/server/utils/logger";
import { getActiveTournament } from "~/server/utils/tournament";

function parseCSV(csv: string): string[] {
  return csv
    .split("\n")
    .map((line) => line.split(",")[0].replace(/^"|"$/g, "").trim())
    .filter((name) => name.length > 0);
}

export default defineEventHandler(async (event) => {
  const tournament = await getActiveTournament();
  const body = await readBody(event);

  const names: string[] = body?.csv
    ? parseCSV(body.csv)
    : (body?.names ?? []).map((n: string) => n.trim()).filter((n: string) => n.length > 0);

  if (names.length === 0) {
    throw createApiError({
      error: "Voer minstens één teamnaam in",
      code: 400,
      reason: "Empty names list",
    });
  }

  const unique = new Set(names);
  if (unique.size !== names.length) {
    throw createApiError({
      error: "Dubbele namen in de lijst",
      code: 409,
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
      code: 409,
      reason: "Duplicates in database",
    });
  }

  const result = await prisma.team.createMany({
    data: names.map((name) => ({ name, tournamentId: tournament.id })),
  });

  logRequest(event, "success", `Bulk imported ${result.count} teams`);
  return { imported: result.count };
});

import { z } from "zod";
import { prisma } from "~/server/utils/prisma";
import { logRequest } from "~/server/utils/logger";

const bodySchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
});

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  if (!id) {
    throw createApiError({ error: "Ongeldig ID", code: "invalid_beverage_group_id", reason: "Missing id" });
  }

  const raw = await readBody(event);
  let body;
  try {
    body = bodySchema.parse(raw ?? {});
  } catch {
    throw createApiError({ error: "Titel is verplicht", code: "beverage_group_title_empty", reason: "Empty title" });
  }

  const existing = await prisma.beverageGroup.findUnique({ where: { id } });
  if (!existing) {
    throw createApiError({ error: "Groep niet gevonden", code: "beverage_group_not_found", reason: "Not found" });
  }

  const group = await prisma.beverageGroup.update({ where: { id }, data: { title: body.title } });
  logRequest(event, "success", `BeverageGroup updated: ${id}`);
  return group;
});

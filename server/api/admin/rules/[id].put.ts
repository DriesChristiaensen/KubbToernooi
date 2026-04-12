import { z } from "zod";
import { prisma } from "~/server/utils/prisma";
import { logRequest } from "~/server/utils/logger";

const bodySchema = z.object({
  text: z.string().trim().min(1, "Text is required"),
});

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  if (!id) {
    throw createApiError({ error: "Ongeldig ID", code: "invalid_rule_id", reason: "Missing id" });
  }

  const raw = await readBody(event);
  let body;
  try {
    body = bodySchema.parse(raw ?? {});
  } catch {
    throw createApiError({ error: "Tekst is verplicht", code: "rule_text_empty", reason: "Empty text" });
  }

  const existing = await prisma.rule.findUnique({ where: { id } });
  if (!existing) {
    throw createApiError({ error: "Regel niet gevonden", code: "rule_not_found", reason: "Not found" });
  }

  const rule = await prisma.rule.update({ where: { id }, data: { text: body.text } });
  logRequest(event, "success", `Rule updated: ${id}`);
  return rule;
});

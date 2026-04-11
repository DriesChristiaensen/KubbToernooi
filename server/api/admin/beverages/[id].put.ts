import { z } from "zod";
import { prisma } from "~/server/utils/prisma";
import { logRequest } from "~/server/utils/logger";

const bodySchema = z.object({
  text: z.string().trim().min(1, "Text is required"),
  price: z.number().nonnegative("Price must be non-negative"),
});

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  if (!id) {
    throw createApiError({ error: "Ongeldig ID", code: "invalid_beverage_id", reason: "Missing id" });
  }

  const raw = await readBody(event);
  let body;
  try {
    body = bodySchema.parse(raw ?? {});
  } catch {
    throw createApiError({ error: "Naam en prijs zijn verplicht", code: "beverage_text_empty", reason: "Invalid body" });
  }

  const existing = await prisma.beverage.findUnique({ where: { id } });
  if (!existing) {
    throw createApiError({ error: "Drank niet gevonden", code: "beverage_not_found", reason: "Not found" });
  }

  const beverage = await prisma.beverage.update({ where: { id }, data: { text: body.text, price: body.price } });
  logRequest(event, "success", `Beverage updated: ${id}`);
  return beverage;
});

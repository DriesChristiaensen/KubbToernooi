import { z } from "zod";
import { prisma } from "~/server/utils/prisma";

const bodySchema = z.object({ ids: z.array(z.string()) });

export default defineEventHandler(async (event) => {
  const raw = await readBody(event);
  let body;
  try {
    body = bodySchema.parse(raw ?? {});
  } catch {
    throw createApiError({ error: "Ongeldige invoer", code: "invalid_input", reason: "Invalid body" });
  }

  // Two-pass update to avoid unique constraint conflicts during reorder.
  // Pass 1: shift to negative values to free all slots, then pass 2: set final values.
  await prisma.$transaction(async (tx) => {
    await Promise.all(
      body.ids.map((id, index) =>
        tx.ruleGroup.update({ where: { id }, data: { orderNumber: -(index + 1) } }),
      ),
    );
    await Promise.all(
      body.ids.map((id, index) =>
        tx.ruleGroup.update({ where: { id }, data: { orderNumber: index + 1 } }),
      ),
    );
  });

  return { success: true };
});

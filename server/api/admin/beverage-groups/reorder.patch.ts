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

  await prisma.$transaction(async (tx) => {
    await Promise.all(
      body.ids.map((id, index) =>
        tx.beverageGroup.update({ where: { id }, data: { orderNumber: -(index + 1) } }),
      ),
    );
    await Promise.all(
      body.ids.map((id, index) =>
        tx.beverageGroup.update({ where: { id }, data: { orderNumber: index + 1 } }),
      ),
    );
  });

  return { success: true };
});

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

  await prisma.$transaction(
    body.ids.map((id, index) =>
      prisma.beverage.update({ where: { id }, data: { orderNumber: index + 1 } }),
    ),
  );

  return { success: true };
});

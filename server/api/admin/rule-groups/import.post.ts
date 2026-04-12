import { z } from "zod";
import { prisma } from "~/server/utils/prisma";

const bodySchema = z.object({
  groups: z.array(
    z.object({
      orderNumber: z.number(),
      title: z.string(),
      rules: z.array(
        z.object({
          orderNumber: z.number(),
          text: z.string(),
        }),
      ),
    }),
  ),
});

export default defineEventHandler(async (event) => {
  const raw = await readBody(event);
  let body;
  try {
    body = bodySchema.parse(raw ?? {});
  } catch {
    throw createApiError({
      error: "Ongeldig importformaat. Controleer het JSON-bestand.",
      code: "invalid_import_format",
      reason: "Invalid body",
    });
  }

  await prisma.$transaction(async (tx) => {
    await tx.ruleGroup.deleteMany();
    for (const group of body.groups) {
      await tx.ruleGroup.create({
        data: {
          orderNumber: group.orderNumber,
          title: group.title,
          rules: {
            create: group.rules.map((r) => ({
              orderNumber: r.orderNumber,
              text: r.text,
            })),
          },
        },
      });
    }
  });

  setResponseStatus(event, 201);
  return { imported: true };
});

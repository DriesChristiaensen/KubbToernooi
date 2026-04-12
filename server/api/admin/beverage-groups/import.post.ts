import { z } from "zod";
import { prisma } from "~/server/utils/prisma";

const bodySchema = z.object({
  groups: z.array(
    z.object({
      orderNumber: z.number(),
      title: z.string(),
      beverages: z.array(
        z.object({
          orderNumber: z.number(),
          text: z.string(),
          price: z.number(),
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
    await tx.beverageGroup.deleteMany();
    for (const group of body.groups) {
      await tx.beverageGroup.create({
        data: {
          orderNumber: group.orderNumber,
          title: group.title,
          beverages: {
            create: group.beverages.map((b) => ({
              orderNumber: b.orderNumber,
              text: b.text,
              price: b.price,
            })),
          },
        },
      });
    }
  });

  setResponseStatus(event, 201);
  return { imported: true };
});

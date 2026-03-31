import { prisma } from "~/server/utils/prisma";
import { logRequest } from "~/server/utils/logger";

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createApiError({
      error: "Ongeldig ID",
      code: 400,
      reason: "Invalid team ID",
    });
  }

  await prisma.team.delete({ where: { id } });

  logRequest(event, "success", `Team deleted: id=${id}`);
  return { success: true };
});

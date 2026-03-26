import { prisma } from "~/server/utils/prisma";
import { logRequest } from "~/server/utils/logger";

export default defineEventHandler(async (event) => {
  const idParam = getRouterParam(event, "id");
  const id = Number(idParam);

  if (Number.isNaN(id)) {
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

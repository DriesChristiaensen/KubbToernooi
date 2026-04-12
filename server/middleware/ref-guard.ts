import { prisma } from "~/server/utils/prisma";

/**
 * Server-side guard for /ref page routes.
 * When refs are disabled globally, clears the session for REFEREE users
 * and redirects to /ref/login before any page rendering occurs.
 *
 * This handles the SSR case where Nuxt composables (navigateTo, useRouter)
 * cannot be called after an async boundary without experimental.asyncContext.
 */
export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname;

  // Only intercept /ref page routes — skip /ref/login, API paths, and assets
  if (
    !path.startsWith("/ref") ||
    path === "/ref/login" ||
    path.startsWith("/api/") ||
    path.startsWith("/_nuxt/")
  ) {
    return;
  }

  const tournament = await prisma.tournament.findFirst({
    where: { isActive: true },
    select: { refsEnabled: true },
  });

  if (tournament?.refsEnabled === false) {
    const session = await getUserSession(event);
    if (session.user?.role === "REFEREE") {
      await clearUserSession(event);
    }
    return sendRedirect(event, "/ref/login", 302);
  }
});

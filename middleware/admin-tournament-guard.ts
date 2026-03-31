const EXEMPT_PATHS = ["/admin/admin-login", "/admin/tournament"];

export default defineNuxtRouteMiddleware(async (to) => {
  if (!to.path.startsWith("/admin")) return;
  if (EXEMPT_PATHS.some((p) => to.path === p || to.path.startsWith(p + "/"))) return;

  try {
    await $fetch("/api/admin/tournament");
  } catch (err: unknown) {
    const e = err as { status?: number; statusCode?: number };
    if (e?.status === 404 || e?.statusCode === 404) {
      return navigateTo("/admin/tournament");
    }
  }
});

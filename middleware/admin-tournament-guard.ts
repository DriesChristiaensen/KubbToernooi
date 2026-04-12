const EXEMPT_EXACT = ["/admin"];
const EXEMPT_PATHS = ["/admin/admin-login", "/admin/tournament"];

export default defineNuxtRouteMiddleware(async (to) => {
  if (!to.path.startsWith("/admin")) return;
  if (EXEMPT_EXACT.includes(to.path)) return;
  if (EXEMPT_PATHS.some((p) => to.path === p || to.path.startsWith(p + "/"))) return;

  let type: string | null = null;
  let teamCount = 0;
  let fieldCount = 0;
  let poolCount = 0;

  try {
    const data = await $fetch("/api/admin/dashboard");
    type = data.type;
    teamCount = data.teamCount;
    fieldCount = data.fieldCount;
    poolCount = data.poolCount;
  } catch {
    return navigateTo("/admin");
  }

  const hasTournament = type !== null;
  const isPoolBased = type === "POOLS" || type === "COMBINATION";
  const isKoBased = type === "KNOCKOUT" || type === "COMBINATION";
  const hasEnoughTeams = teamCount >= 2;
  const hasField = fieldCount >= 1;
  const hasPool = poolCount >= 1;

  const allowed: Record<string, boolean> = {
    "/admin/teams": hasTournament,
    "/admin/fields": hasTournament,
    "/admin/referees": true,
    "/admin/pools": isPoolBased && hasEnoughTeams,
    "/admin/ko-bracket": isKoBased && hasEnoughTeams && hasField,
    "/admin/schedule": isPoolBased && hasEnoughTeams && hasField && hasPool,
  };

  const key = Object.keys(allowed).find(
    (p) => to.path === p || to.path.startsWith(p + "/"),
  );

  if (key !== undefined && !allowed[key]) {
    return navigateTo("/admin");
  }
});

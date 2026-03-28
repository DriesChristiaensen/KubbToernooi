# Bug Report — Kubb Tournament WebApp

**Generated:** 2026-03-28
**Total Bugs:** 11
**Critical (API 404s):** 9
**Medium:** 2

---

## Summary

Most bugs are 404 errors on admin and ref API endpoints, suggesting missing or incorrectly named Nitro route handlers. Two additional bugs involve UI loading states and tournament logic.

---

## Category 1: API Route 404 Errors (Critical)

All endpoints return `404 Page not found`. The issue is likely that route handlers do not exist or are named incorrectly in the Nitro API.

### Bug #1: Delete Referees — DONE AND RESOLVED
- **Endpoint:** `DELETE /api/admin/referees/{id}`
- **Fix:** Added `server/api/admin/referees/[id].delete.ts` (Nitro requires directory-based dynamic routes)
- **Expected behavior:** Referee should be deleted and removed from UI

### Bug #2: Update Teams — DONE AND RESOLVED
- **Endpoint:** `PUT /api/admin/teams/{id}`
- **Fix:** Added `server/api/admin/teams/[id].put.ts`
- **Expected behavior:** Team details updated in database

### Bug #3: Delete Teams — DONE AND RESOLVED
- **Endpoint:** `DELETE /api/admin/teams/{id}`
- **Fix:** Added `server/api/admin/teams/[id].delete.ts`
- **Expected behavior:** Team deleted and removed from UI

### Bug #4: Update Fields — DONE AND RESOLVED
- **Endpoint:** `PUT /api/admin/fields/{id}`
- **Fix:** Added `server/api/admin/fields/[id].put.ts`
- **Expected behavior:** Field configuration updated in database

### Bug #5: Delete Fields — DONE AND RESOLVED
- **Endpoint:** `DELETE /api/admin/fields/{id}`
- **Fix:** Added `server/api/admin/fields/[id].delete.ts`
- **Expected behavior:** Field deleted and removed from UI

### Bug #6: Update Pools — DONE AND RESOLVED
- **Endpoint:** `PUT /api/admin/pools/{id}`
- **Fix:** Added `server/api/admin/pools/[id].put.ts`
- **Expected behavior:** Pool properties updated in database

### Bug #7: Delete Pools — DONE AND RESOLVED
- **Endpoint:** `DELETE /api/admin/pools/{id}`
- **Fix:** Added `server/api/admin/pools/[id].delete.ts`
- **Expected behavior:** Pool deleted and removed from UI

### Bug #8: Update Schedule Matches — DONE AND RESOLVED
- **Endpoint:** `PATCH /api/admin/schedule/matches/{id}`
- **Fix:** Added `server/api/admin/schedule/matches/[id].patch.ts`
- **Expected behavior:** Match details updated in database

### Bug #9: Save Scores (Referee Dashboard) — DONE AND RESOLVED
- **Endpoint:** `PATCH /api/ref/matches/{id}`
- **Fix:** Added `server/api/ref/matches/[id].patch.ts`; returns the updated match object (not `true`)
- **Expected behavior:** Match score saved to database; proper UI feedback

---

## Category 2: UI & Loading State Issues (Medium)

### Bug #10: Tournament Screen Reload — Premature "Not Found" Message — DONE AND RESOLVED
- **Location:** `pages/admin/tournament.vue`
- **Fix:** Added `isLoading` ref; shows `nl.common.loading` while fetching, only shows "not found" after fetch completes
- **Expected behavior:** Loading spinner displays until tournament data arrives; error message only if fetch fails

### Bug #11: KO Tournament Generation — Pool Requirement Logic — DONE AND RESOLVED
- **Location:** `server/api/admin/ko-bracket/generate.post.ts`
- **Fix:** Added tournament type check; KNOCKOUT type uses teams directly, COMBINATION/POOLS type uses standings
- **Expected behavior:** KO tournaments use teams directly without requiring pool setup

---

## Recommended Fix Order

1. **Bugs #1–9 (API 404s):** Fix first — likely all stem from missing Nitro route handlers
   - Check `/server/api/admin/` directory for missing handlers
   - Verify route naming follows pattern: `[id].put.ts`, `[id].delete.ts`, etc.
   - Verify `/server/api/ref/` has matches endpoint handler

2. **Bug #10 (Loading state):** Fix second — easier once API is working
   - Verify loading state is tracked and checked before rendering "not found" message

3. **Bug #11 (KO logic):** Fix last — requires understanding tournament type logic
   - Review tournament type checks in schema generation
   - Ensure KO tournaments skip pool requirement

---

## Files to Inspect

### Frontend (Vue components)
- `referees.vue` (line 46)
- `teams.vue` (lines 71, 90, 294)
- `fields.vue` (lines 67, 86, 268)
- `tournament.vue` (lines 156, 175, 438)
- `schedule.vue` (line 116)
- `index.vue` (lines 71, 168) — referee score dashboard

### Backend (Nitro API)
- `/server/api/admin/referees/` — check for `[id].delete.ts`
- `/server/api/admin/teams/` — check for `[id].put.ts`, `[id].delete.ts`
- `/server/api/admin/fields/` — check for `[id].put.ts`, `[id].delete.ts`
- `/server/api/admin/pools/` — check for `[id].put.ts`, `[id].delete.ts`
- `/server/api/admin/schedule/matches/` — check for `[id].patch.ts`
- `/server/api/ref/matches/` — check for `[id].patch.ts`

### Logic/Schema
- Tournament creation/generation logic (for Bug #11 — KO pool requirement)

---

## Testing Strategy

After each fix:
1. Run `npx vitest run` to ensure no test regressions
2. Test the specific operation in the browser (e.g., delete a referee, update a team)
3. Verify database state changed correctly (check via Prisma Studio or logs)
4. Move to next bug

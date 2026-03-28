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

### Bug #1: Delete Referees
- **Endpoint:** `DELETE /api/admin/referees/{id}`
- **Error:** `404 Page not found: /api/admin/referees/2`
- **Location:** `referees.vue:46` → `deleteReferee()`
- **Stack trace:** Uncaught (in promise) FetchError
- **Expected behavior:** Referee should be deleted and removed from UI

### Bug #2: Update Teams
- **Endpoint:** `PUT /api/admin/teams/{id}`
- **Error:** `404 Page not found: /api/admin/teams/9`
- **Location:** `teams.vue:71` → `saveEdit()`
- **Expected behavior:** Team details updated in database

### Bug #3: Delete Teams
- **Endpoint:** `DELETE /api/admin/teams/{id}`
- **Error:** `404 Page not found: /api/admin/teams/9`
- **Location:** `teams.vue:90` → `deleteTeam()` called from `teams.vue:294`
- **Expected behavior:** Team deleted and removed from UI

### Bug #4: Update Fields
- **Endpoint:** `PUT /api/admin/fields/{id}`
- **Error:** `404 Page not found: /api/admin/fields/4`
- **Location:** `fields.vue:67` → `saveEdit()`
- **Expected behavior:** Field configuration updated in database

### Bug #5: Delete Fields
- **Endpoint:** `DELETE /api/admin/fields/{id}`
- **Error:** `404 Page not found: /api/admin/fields/4`
- **Location:** `fields.vue:86` → `deleteField()` called from `fields.vue:268`
- **Expected behavior:** Field deleted and removed from UI

### Bug #6: Update Pools
- **Endpoint:** `PUT /api/admin/pools/{id}`
- **Error:** `404 Page not found: /api/admin/pools/3` and `/api/admin/pools/4`
- **Location:** `tournament.vue:156` → `savePool()`
- **Affected fields:** "teams door" (teams through) and "Naam" (Name)
- **Expected behavior:** Pool properties updated in database

### Bug #7: Delete Pools
- **Endpoint:** `DELETE /api/admin/pools/{id}`
- **Error:** `404 Page not found: /api/admin/pools/4`
- **Location:** `tournament.vue:175` → `deletePool()` called from `tournament.vue:438`
- **Expected behavior:** Pool deleted and removed from UI

### Bug #8: Update Schedule Matches
- **Endpoint:** `PATCH /api/admin/schedule/matches/{id}`
- **Error:** `404 Page not found: /api/admin/schedule/matches/5`
- **Location:** `schedule.vue:116` → `saveMatch()`
- **Expected behavior:** Match details updated in database

### Bug #9: Save Scores (Referee Dashboard)
- **Endpoint:** `PATCH /api/ref/matches/{id}`
- **Error:** `404 Page not found: /api/ref/matches/49`
- **Location:** `index.vue:71` → `saveScore()` called from `index.vue:168`
- **Additional issue:** Returns `true` as feedback instead of proper success message
- **Expected behavior:** Match score saved to database; proper UI feedback

---

## Category 2: UI & Loading State Issues (Medium)

### Bug #10: Tournament Screen Reload — Premature "Not Found" Message
- **Location:** Tournament detail page (component unknown — likely a layout or tournament detail page)
- **Issue:** Brief message "Geen toernooi gevonden" (No tournament found) appears while database call is still loading
- **Expected behavior:** Loading skeleton/spinner should display until tournament data arrives; error message only if fetch fails
- **Likely cause:** Missing loading state check; conditional rendering shows error before `isLoading` is false

### Bug #11: KO Tournament Generation — Pool Requirement Logic
- **Location:** Tournament creation/configuration flow (component unknown)
- **Issue:** KO tournament schema generation incorrectly requires pools to exist first
- **Expected behavior:** KO tournaments should NOT require pool setup; pools are only for group stage tournaments
- **Likely cause:** Logic conflates tournament types or missing type check in schema generation function

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

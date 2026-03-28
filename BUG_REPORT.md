# Bug Report — Kubb Tournament WebApp

**Generated:** 2026-03-28
**Total Bugs:** 7
**Critical:** 2
**High:** 3
**Medium:** 2

---

## Summary

Mixed set of bugs across schema generation, UI loading states, form validation, authentication, and datetime handling. Issues range from missing error handling to timezone mismatches and race conditions.

---

## Category 1: Critical Bugs

### Bug #1: Schema Generation Error When No Tournament Exists — DONE AND RESOLVED

- **Location:** Schema generation endpoint (likely `pages/admin/tournament.vue` or `server/api/admin/...`)
- **Issue:** Shows generic error message "Er is een fout opgetreden" (An error has occurred) when attempting to generate a schema without first creating a tournament
- **Expected behavior:** Should display a user-friendly message instructing user to create a tournament first; OR prevent access to generation UI until tournament exists
- **Component inspection needed:** Schema generation function/component
- **Likely cause:** Missing validation before attempting database operations; error not caught or displayed properly

### Bug #2: Missing Data Error During DB Load (All Admin Pages Except Tournament) — DONE AND RESOLVED

- **Location:** All admin pages EXCEPT the tournament page: referees, teams, fields, schedule, etc.
- **Issue:** Brief message "[Entity] not found" appears while database call is still loading
- **Expected behavior:** Loading state (skeleton/spinner) should display; error message only after fetch completes and fails
- **Affected pages:** Likely `pages/admin/referees.vue`, `pages/admin/teams.vue`, `pages/admin/fields.vue`, `pages/admin/schedule.vue`, etc.
- **Likely cause:** Conditional rendering checks for data before loading state; missing `isLoading` check

---

## Category 2: High Priority Bugs

### Bug #3: Save Score Button Remains Disabled After First Save — DONE AND RESOLVED

- **Location:** Referee dashboard — `pages/ref/index.vue`
- **Issue:** After successfully saving a score for the first time, the "Save" button stays disabled even when the user changes the score value
- **Expected behavior:** Button should enable when user input differs from stored database value
- **Likely cause:** After first save, form validation or dirty state check not resetting; need to compare new input against last saved value
- **Condition for enabling:** Button should enable when `currentScore !== savedScore`

### Bug #4: Login Rate Limit Not Reset on Successful Authentication — DONE AND RESOLVED

- **Location:** Authentication handler — likely `server/api/auth/...` or `server/utils/...`
- **Issue:** User's rate limit counter not cleared after successful login
- **Expected behavior:** After successful authentication, reset the user's login attempt counter (to allow new attempts on next session)
- **Impact:** Can prevent legitimate repeated logins or lockout false positives
- **Implementation note:** Clear rate limit cache/store entry for user after verified login

### Bug #5: Console Error Blocks Redirect After Login — DONE AND RESOLVED

- **Location:** Authentication flow, likely `composables/useAuth.ts` or form component
- **Issue:** After correct login, console error: `TypeError: Cannot read properties of null (reading 'autocomplete')` appears; redirect to correct screen blocked
- **Stack trace location:** Error occurs in form validation/initialization code (autocomplete field handling)
- **Expected behavior:** Login completes; user redirected to dashboard without console errors
- **Likely cause:** Code tries to access `autocomplete` property on null element (form field not mounted or already unmounted during redirect)
- **Fix approach:** Add null check before accessing DOM properties; or defer redirect until component fully unmounted

---

## Category 3: Medium Priority Bugs

### Bug #6: Match DateTime Field Defaults 2 Hours Too Early — DONE AND RESOLVED

- **Location:** Match editing page — `pages/admin/schedule.vue` or match edit dialog
- **Issue:** DateTime input field defaults to time 2 hours earlier than intended (e.g., if set for 14:00, shows 12:00)
- **Root cause:** UTC vs local time conversion mismatch; likely timezone offset not applied correctly
- **Expected behavior:** DateTime picker shows correct local time, matching user's browser timezone
- **Implementation note:** Verify timezone handling when converting between server (likely UTC) and client (local); check if `new Date()` instantiation or formatting function applies offset
- **Files to check:** Match editing component, datetime utility functions

### Bug #7: KO Bracket Generation (Combination Mode) — Team Advancement Calculation — DONE AND RESOLVED

- **Location:** `server/api/admin/ko-bracket/generate.post.ts` or tournament logic
- **Issue:** When generating KO bracket in combination (pool + knockout) mode:
  - Does not display total teams advancing from pools
  - Does not correctly calculate number of KO matches
- **Expected calculation:**
  - **Teams advancing:** Sum of all "teams through" (teamsThrough) values from each pool
  - **KO matches needed:** `ceil(total_advancing_teams / 2)` = ⌈n/2⌉
- **Expected behavior:** Display calculated advancement numbers; generate correct match count
- **Data needed:** Pull `teamsThrough` from each pool in tournament
- **Likely cause:** Missing logic to aggregate pool standings; potential hardcoded match calculation

---

## Recommended Fix Order

1. **Bug #1** (Schema generation error) — Quick win, improves UX immediately
2. **Bug #2** (Loading states on all admin pages) — Affects multiple pages; systematic fix
3. **Bug #5** (Login redirect blocking) — Blocks user authentication flow; critical UX
4. **Bug #4** (Rate limit reset) — Security-related; should be tied to Bug #5 fix
5. **Bug #3** (Save button disabled) — Affects data entry; medium priority
6. **Bug #6** (DateTime timezone) — Cosmetic but important for data accuracy
7. **Bug #7** (KO bracket calculation) — Tournament generation logic; needs careful testing

---

## Files to Inspect

### Frontend (Vue components)

- `pages/admin/tournament.vue` — schema generation & loading states
- `pages/admin/referees.vue`, `teams.vue`, `fields.vue`, `schedule.vue` — loading state issues
- `pages/ref/index.vue` — score save button disable state
- Login form component — datetime input, autocomplete error
- Match editing component — datetime field (Bug #6)

### Backend (Nitro API)

- `server/api/auth/...` — login handler, rate limit reset
- `server/api/admin/ko-bracket/generate.post.ts` — KO generation logic, team advancement calculation
- `server/utils/...` — timezone/datetime utilities
- Rate limit middleware/utility

### Utilities

- Auth composables (`composables/useAuth.ts`)
- Form/validation utilities
- Datetime conversion functions

---

## Testing Strategy

After each fix:

1. Run `npx vitest run` to ensure no test regressions
2. Test in browser: reproduce original issue, verify fix works
3. Check console for errors
4. Verify database state if applicable
5. Move to next bug

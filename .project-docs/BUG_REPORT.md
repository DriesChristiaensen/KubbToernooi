# Bug Report — Kubb Tournament WebApp

**Generated:** 2026-03-28 | **Updated:** 2026-04-01
**Total Bugs:** 19
**Critical:** 5
**High:** 5
**Medium:** 5
**Algorithm/Logic:** 4

---

## Summary

Bugs 1–5 (resolved) covered referee UX, score button state, datetime parameter, and KO bracket pre-generation. New bugs (6–19) cover: login flow breakage (401 + JS crash + logout), a URL routing mismatch for referee password reset, a Nuxt route conflict causing 400 errors on score save, stale `/login` page, tournament wizard input issues (12h clock, 6-digit year, negative points), missing per-step frontend validation, schedule swap lacking conflict detection, public page button group layout, "Mijn Team" theming, and schedule generation algorithm deficiencies.

---

## Category 1: Critical Bugs

### Bug #1: Referee Page Loading State — Incorrect Error Display — DONE AND RESOLVED

- **Location:** `pages/ref/index.vue` — match listing page
- **Issue:** Page shows error message "Er is een fout opgetreden" (An error has occurred) instead of loading state when the matches database call is still in progress
- **Expected behavior:** Should display "Laden..." (Loading...) spinner while fetching match data from database
- **Affected states:** Initial page load, page refresh, data polling
- **Likely cause:** Conditional rendering checks for error/empty state before `isLoading` flag is evaluated
- **Fix approach:** Reorder conditional logic to check `isLoading` first: `if (isLoading) show Loading else if (error) show Error else if (data) show Data else show EmptyState`

---

### Bug #2: Referee Score Button State Persistence — Separate State Per Match — DONE AND RESOLVED

- **Location:** `pages/ref/index.vue` — score input fields and save buttons
- **Issue:** After refreshing the page, refs can only modify an existing score once. The save button disable/enable logic does not properly track state per match after reload.
- **Root cause:** Button state tied to a single shared state variable or not properly keyed to individual matches; state not persisting across page reloads
- **Expected behavior:** Each match's score save button should:
  1. **Enabled** — if no score has been saved yet (initial state)
  2. **Enabled** — if user-entered score differs from last saved database value
  3. **Disabled** — if user-entered score equals last saved database value
- **Implementation requirement:** Button state must be stored independently per match with a unique identifier per match (e.g., `matchId + '_dirty'` or separate state object keyed by `matchId`)
- **Fix approach:** Use `Map<matchId, savedScore>` or object keyed by `matchId` instead of single state variable; ensure each button checks its own match ID for state

---

### Bug #3: Schema Generation — Missing DateTime Start Time Parameter — DONE AND RESOLVED

- **Location:** Schema generation endpoint — `server/api/admin/[...]/generate.post.ts` (pool/KO/schedule generation)
- **Issue:** Schema generation does not accept or use a datetime parameter for setting the tournament start time
- **Expected behavior:** Generation function must accept a `startDateTime` parameter (ISO 8601 or similar format) and use it to:
  - Set match start times based on schedule rules (e.g., each match starts `X` minutes after previous)
  - Propagate to all generated matches in the schema
- **Implementation approach:** Add `startDateTime` to request body validation (Zod schema); pass to match generation logic
- **Affected endpoints:** All schema generation endpoints (pool generation, KO generation, schedule generation)
- **Data to set:** Match `scheduledAt` field should be derived from `startDateTime + (matchIndex * intervalMinutes)`

---

## Category 2: High Priority Bugs

### Bug #4: KO Bracket Pre-Generation — Complete Match Tree with Nullable TeamB — DONE AND RESOLVED

- **Location:** `server/api/admin/ko-bracket/generate.post.ts` + KO match schema
- **Issue:** Currently, KO matches are generated only up to the current round. Must pre-generate ALL matches up to and including the final at once, with linking between rounds and nullable team slots.
- **Current state:** Matches created on-demand when scores are entered
- **Expected behavior:**
  - **Generation:** All rounds generated in one call; match tree fully formed
  - **Match linking:** Each match contains `nextMatchId` (ID of corresponding match in round n+1)
  - **Round n+1 structure:** Each round n+1 match has 2 preceding matches in round n (except round 1, which has 0 or 1)
  - **Team assignment:** Each KO match has `teamA` and `teamB` which can be `null`
    - **Round 1 null meaning:** `null teamB` = automatic advancement (bye); `null teamA` = invalid state
    - **Round n≥2 null meaning:** `null` = "Team to be determined" (waiting for winner from preceding match)
  - **Schema change:** `teamB` must be nullable in KO match model
- **Match generation algorithm:**
  ```
  1. Calculate firstRoundMatches = 2^ceil(log2(totalTeams))
  2. For round 1: Create firstRoundMatches matches
  3. For round n≥2: Create ceil(matchesInRound(n-1) / 2) matches
  4. Continue until round has 1 match (the final)
  5. Link each round n match to 2 matches in round n-1 (their input matches)
  6. Assign teams to round 1; leave all other rounds with null teams
  ```
- **Database schema changes needed:**
  - `KoMatch.teamB` → nullable (allow `null`)
  - `KoMatch.nextMatchId` → add field (FK to next round's match)
- **Likely cause:** Current implementation generates matches on-the-fly rather than upfront; no pre-linking logic

---

### Bug #5: KO Bracket Score Entry — Automatic Next Match Creation with Null Opponent — DONE AND RESOLVED

- **Location:** `server/api/ref/matches/[id].patch.ts` (score save for KO matches)
- **Issue:** When entering a score in a KO bracket match, a new match is created in the next round if it doesn't exist (this is correct behavior), but the opponent (the team from the other preceding match) is not yet filled in.
- **Current state:** May be incorrectly pre-assigning both teams to the next round match
- **Expected behavior:**
  - When match score is entered and winner determined:
    1. If next match exists: Update the appropriate team slot (`teamA` or `teamB`) with the winner
    2. If next match doesn't exist: Create it with the winner in the correct slot; other slot remains `null`
    3. Other team slots in the next match remain `null` until their corresponding match is completed
- **Implementation approach:**
  - Determine winner from score
  - Query next match (use `nextMatchId` from current match)
  - If next match exists: update correct team slot (`teamA` or `teamB`) based on which preceding match this is
  - If next match doesn't exist: create with winner in correct slot
  - Leave other team slot as `null` with message "Team to be determined" (waiting for other match)
- **Constraint:** A next-round match can have at most 1 team filled initially; second team only filled when the other preceding match is completed
- **Likely cause:** Score save logic may not distinguish between "winner of preceding match" vs "both opponents in next match"

---

---

## Category 3: Critical Bugs (New — reported 2026-04-01)

### Bug #6: Admin Login — 401 Invalid Credentials + JavaScript autocomplete crash — DONE AND RESOLVED

- **Location:** `pages/login.vue`, `composables/useAuth.ts:8–27`, `server/api/auth/login.post.ts`
- **Symptoms (two separate issues in the same flow):**
  1. `POST /api/auth/login 401 (Invalid credentials)` — admin cannot log in despite believing the password is correct
  2. `TypeError: Cannot read properties of null (reading 'autocomplete') at Object.isLogin` — unhandled JS exception in the minified bundle before and after the fetch
- **Issue 1 — 401 analysis:**
  - `login.post.ts:26–30` resolves the admin user by `{ role: 'ADMIN' }` with no username; if no admin user is seeded in the database or the stored bcrypt hash does not match, the response is always 401 with the generic message "Inloggen mislukt. Controleer je gegevens."
  - The error message gives no hint about whether the user exists but has the wrong password, or whether no admin user exists at all. This makes diagnosis difficult.
  - Likely root cause: admin user was not seeded (or was seeded with a different password than the one being used). There is no admin password setup flow; the password must be set directly in the database.
- **Issue 2 — autocomplete TypeError analysis:**
  - The stack trace points to an `isLogin` function inside `7.js:2` (a Nuxt-bundled third-party chunk). This function reads `element.autocomplete` where `element` is `null`.
  - The crash is triggered by a form autofill detection library (likely from Nuxt's built-in password-manager integration or a browser extension) that scans the DOM for input elements. When the input with `id="password"` is conditionally rendered (it disappears and reappears when `loginMode` toggles between `admin` and `ref`), the element reference becomes stale/null during re-render.
  - This crash does not prevent the login fetch from firing, but it produces an unhandled promise rejection.
- **Expected behavior:** Admin can log in; no JS exceptions in the console
- **Fix approach:**
  - Issue 1: Verify/seed the admin user in the database. Consider a first-time admin password setup endpoint or a more descriptive error message distinguishing "user not found" from "wrong password".
  - Issue 2: Ensure the `<input id="password">` is always mounted (never conditionally hidden via `v-if`; use `v-show` or keep both inputs always rendered with `type="hidden"` for the inactive one). Alternatively, a unique `id` per mode avoids stale DOM references.

---

### Bug #7: Score Save — 400 "Invalid match ID" Due to Nuxt Route Conflict — DONE AND RESOLVED

- **Location:** `server/api/ref/matches.[id].patch.ts` (dot-notation legacy), `server/api/ref/matches/[id].patch.ts` (directory notation)
- **Observed error:** `PATCH http://localhost:3000/api/ref/matches/3a161cde-3c4b-408f-858e-9d07fa6bc8c5 400 (Invalid match ID)`
- **Root cause:** Two files co-exist that both intend to handle `PATCH /api/ref/matches/:id`:
  - `server/api/ref/matches.[id].patch.ts` — dot-notation (legacy Nuxt file naming)
  - `server/api/ref/matches/[id].patch.ts` — directory-notation (current convention)
  - When both files are registered, Nuxt's H3 router may resolve the request to the dot-notation file. In that context, `getRouterParam(event, "id")` returns `null` or `undefined` because the parameter name bound by the dot-notation route may differ, or the route is registered twice and the wrong handler wins.
  - `server/api/ref/matches/[id].patch.ts:7` throws `{ code: 400, reason: "Invalid match ID" }` when `!id` — this is the observed 400.
- **Same pattern present in admin routes:** `server/api/admin/schedule/matches.[id].patch.ts` and `server/api/admin/schedule/matches/[id].patch.ts` both exist; `server/api/admin/pools.[id].put.ts` also uses dot-notation.
- **Expected behavior:** Scores save successfully; PATCH routes resolve to a single handler.
- **Fix approach:** Delete all dot-notation legacy files (`*.[ id].*.ts`) where a corresponding directory-notation version exists. Keep only the directory-style routes as the single source of truth.

---

### Bug #8: Logout Button Non-Functional — DONE AND RESOLVED

- **Location:** `composables/useAuth.ts:30–35`, admin/ref layout files
- **Issue:** The logout button does not perform the logout or navigate away. The user remains on the same page after clicking.
- **Root cause analysis:**
  - `useAuth.ts:30–35` calls `$fetch('/api/auth/logout', { method: 'POST' })` then `navigateTo(...)`. The server handler `logout.post.ts` calls `clearUserSession(event)` — the session clearing logic is sound.
  - The most likely cause is that the logout function is not imported or wired in the layout component that renders the button. If the button's `@click` handler calls `logout()` but `logout` is not in scope (e.g., `useAuth()` was not called in that component's setup), the call is silently a no-op in Vue.
  - A secondary possibility: `useUserSession()` called inside `logout()` at line 31 may throw if called outside a Nuxt plugin context, causing an unhandled error that stops execution before `navigateTo`.
  - There is no `try-catch` around the logout fetch, so a network error would leave the user stuck.
- **Expected behavior:** Clicking logout clears the session and redirects to the appropriate login page.
- **Fix approach:** Ensure the layout component calls `const { logout } = useAuth()` in `<script setup>` and passes it to the button as `@click="logout"`. Add a `try-catch` around the fetch in the composable.

---

### Bug #9: Referee Password Reset — 404 URL Mismatch — DONE AND RESOLVED

- **Location:** `pages/admin/referees.vue:52–53`, `server/api/admin/referees/[id].reset-password.post.ts`
- **Observed error:** `404 (Page not found: /api/admin/referees/ab724a69-48cf-4033-99a6-1a8064115277/reset-password)`
- **Root cause:** URL path mismatch between frontend and backend:
  - **Frontend** (`referees.vue:52`) calls: `` $fetch(`/api/admin/referees/${id}/reset-password`, { method: 'POST' }) `` — uses a slash before `reset-password`
  - **Backend file:** `server/api/admin/referees/[id].reset-password.post.ts` — the dot before `reset-password` in the filename creates a Nuxt route of `/api/admin/referees/:id` with `.reset-password` as a literal suffix, resulting in `/api/admin/referees/:id.reset-password`, not `/api/admin/referees/:id/reset-password`
  - Nuxt has no handler for the slash-separated URL, returning 404.
- **Expected behavior:** POST to `/api/admin/referees/{id}/reset-password` succeeds and clears the referee's password.
- **Fix approach:** Rename the file to `server/api/admin/referees/[id]/reset-password.post.ts` (add a subdirectory `[id]/`) so that Nuxt maps it to the correct `/api/admin/referees/:id/reset-password` route. Alternatively, align the frontend to use the dot-notation URL, but the directory approach is consistent with the rest of the codebase.

---

### Bug #10: Stale `/login` Route Remains Accessible — DONE AND RESOLVED

- **Location:** `pages/login.vue`
- **Issue:** The route `/login` still exists and is accessible. Login was split into role-specific pages: `/admin/admin-login` and `/ref/login`. The shared `/login` page now causes confusion because it is not linked from anywhere but can still be reached by URL.
- **Current behavior:** The page renders and allows login attempts. It uses `useAuth()` which navigates to `/admin` or `/ref` on success, so the functional path works, but its existence is unintended.
- **Expected behavior:** `/login` should redirect to `/` or return a 404. The role-specific login pages are the intended entry points.
- **Fix approach:** Delete `pages/login.vue` or add a `definePageMeta` redirect to `/`.

---

## Category 4: High Priority Bugs (New — reported 2026-04-01)

### Bug #11: Tournament Wizard — Datetime Input Renders as 12h Clock and Accepts 6-Digit Year — DONE AND RESOLVED

- **Location:** `pages/admin/tournament.vue:283–287`
- **Issue:** The `startTime` input uses `type="datetime-local"` (native HTML input). On Windows with en-US or nl-BE locale settings, Chrome/Edge render this as a 12h clock (AM/PM) rather than 24h. Additionally, the year field accepts up to 6 digits, allowing nonsense values like `202600`.
- **Root cause:** Native `datetime-local` inputs delegate rendering entirely to the browser. There is no attribute to force 24h display or constrain year digit length.
- **Impact:** Admins may inadvertently enter a wrong time (e.g., 9:00 PM instead of 9:00 AM) or an invalid year. The stored value in the DB would reflect the wrong datetime, breaking the entire schedule.
- **Expected behavior:** Time picker always shows 24h format; year is constrained to 4 digits; display format is `dd/mm/yyyy hh:mm`.
- **Note:** The schedule generation page already uses `VueDatePicker` with `:is24="true"` and `formats: { input: 'dd/MM/yyyy HH:mm' }`. The tournament wizard should use the same component for consistency.
- **Fix approach:** Replace the native `<input type="datetime-local">` with `<VueDatePicker :is24="true" :format="'dd/MM/yyyy HH:mm'" />` in the wizard, matching the pattern in `pages/admin/schedule.vue:253–262`.

---

### Bug #12: Tournament Wizard — Points Fields Allow Negative Values via Keyboard — DONE AND RESOLVED

- **Location:** `pages/admin/tournament.vue:318–328`
- **Issue:** The `pointsWin`, `pointsDraw`, and `pointsLoss` inputs have `min="0"` and the backend Zod schema uses `.int().min(0)` — however, HTML `min` only prevents the browser spinner from going below 0. A user can type `-3` directly into the field and the frontend does not catch this before sending. The backend will reject it with `400 "Ongeldige invoer"` but no field-level error is shown.
- **Root cause:** No frontend validation before the wizard proceeds to step 2 or submits.
- **Expected behavior:** Fields show a validation error immediately when a negative value is typed; the "Next" / "Create" button is disabled while invalid.
- **Fix approach:** Add reactive validation that checks `form.value.pointsWin >= 0`, etc., to the existing `step1Valid` computed property (currently only checks name, startTime, matchDuration).

---

### Bug #13: Tournament Wizard — No Per-Field Validation Feedback; Duplicate Name Error Unclear — DONE AND RESOLVED

- **Location:** `pages/admin/tournament.vue:64–71`, `server/api/admin/tournament.post.ts`
- **Issue (two parts):**
  1. **Frontend:** `step1Valid` disables the "Next" button silently. When invalid, there is no message explaining which field is missing or out of range. Users do not know why the button is greyed out.
  2. **Duplicate name:** The backend does not check for duplicate tournament names at all. Creating two tournaments with the same name succeeds silently (the first becomes inactive, the second becomes active). If a duplicate-name check is ever added, the current error surfacing path (`createError.value = fetchErr?.data?.data?.error`) would show the raw Dutch error string without identifying which field caused it.
- **Expected behavior:**
  - Frontend shows field-level error messages below each invalid field as the user fills in the form.
  - Backend validates name uniqueness (or at least active-name uniqueness) and returns a clear error identifying the name field.
  - The frontend routes the name-specific error to the name field rather than a generic error banner.
- **Fix approach:**
  - Add a `touched` state per field and show error messages reactively.
  - Add a unique-name check in `tournament.post.ts` before creating.
  - Pass `field: "name"` in the error response so the frontend can highlight the correct input.

---

### Bug #14: Schedule — Match Swap Performs No Conflict Check; No Visual Overlap Preview — DONE AND RESOLVED

- **Location:** `server/api/admin/schedule/matches/swap.post.ts`, `pages/admin/schedule.vue:140–173`
- **Issue (two parts):**
  1. **Post-swap conflicts not detected:** `swap.post.ts` exchanges `fieldId` and `startTime` between two matches unconditionally. After the swap, a team could play two matches simultaneously, or a field could host two matches at the same time. The `conflict-check.get.ts` endpoint exists but is never called during or after a swap.
  2. **No pre-swap visual feedback:** When a user selects the first match (entering "switch mode"), no highlighting is shown to indicate which other matches share a team or field with the selected match. The user has no way to foresee conflicts before confirming the swap.
- **Expected behavior:**
  - Swapping should always be possible (no hard block), but any resulting conflicts should be persisted as "flagged" and displayed clearly in all three schedule tabs (per-field, per-team, per-slot).
  - While in switch-mode (first match selected), all rows that share a team or field with the selected match should be highlighted in a distinct color across all view tabs.
- **Current conflict-check capability:** `conflict-check.get.ts` already detects field and team conflicts for a given `matchId` + proposed `fieldId`/`startTime`. It can be reused post-swap to detect and store conflict flags.
- **Fix approach:**
  - After the swap, call the conflict logic for both swapped matches and store any conflicts (e.g., a `hasConflict: boolean` flag or a `conflicts` JSON field on the match record, or a separate conflict table).
  - In `schedule.vue`, when `switchMatchId` is set, compute the set of team IDs and field ID from the selected match and apply a highlight class to all rows sharing those identifiers.
  - Show a persistent warning banner per conflict in all three view tabs.

---

## Category 5: Medium Priority Bugs (New — reported 2026-04-01)

### Bug #15: Public Page — Phase and Sub-Tab Buttons Are Not Styled as Button Groups — DONE AND RESOLVED

- **Location:** `pages/index.vue:289–314`, `pages/index.vue:318–329`
- **Issue:** "Poule" / "KO" (main tabs) and "Wedstrijden" / "Standen" (sub-tabs) are rendered as individual underline-style tab buttons. The user expects them to be connected button groups (pill or segmented control style) and to be positioned as two parallel horizontal groups at the top of the content area simultaneously — not one disappearing when the other is active.
- **Current behavior:**
  - The main tab bar (`multipleMainTabs`) only renders when there are more than one applicable tab.
  - Sub-tabs (Wedstrijden/Standen) are nested inside their parent tab's template, so they only appear after the parent tab is active.
  - Both use underline-active styling (`border-b-2 border-primary`) rather than filled/group styling.
- **Expected behavior:**
  - Both button groups are always visible at the top (assuming the tournament type has both pool and KO phases).
  - They use a connected group style: outer buttons have rounded corners on one side, middle buttons have none; active state is a filled background.
  - The two groups sit side by side horizontally (e.g., flex row with gap).
- **Fix approach:** Refactor the tab area in `pages/index.vue` into two always-visible `ButtonGroup` components rendered in a single flex row. The phase group and the sub-tab group are independent state. Changing the phase group (Poule/KO) changes which data is shown while keeping the same sub-tab (Wedstrijden or Standen) active.

---

### Bug #16: Public Page — "Mijn Team" Has No Pink Theme and Incomplete Filtering/Highlighting — DONE AND RESOLVED

- **Location:** `pages/index.vue:245–267`, `pages/index.vue:172–189`
- **Issue:** The "Mijn Team" / favorite-team feature is partially implemented:
  - The toggle button and filter logic (`applyFilters`) exist and work.
  - However, the button is not pink — it uses `bg-primary` (which is blue/brand color) when active.
  - Filtering and highlighting behavior is incomplete per view:
    - **Wedstrijden-Poule:** Filter works (shows only the team's matches). Highlight of the team name within match cards is absent.
    - **Standen-Poule:** No filtering by pool (should show only the team's pool) and no pink highlight on the team's row.
    - **Wedstrijden-KO:** Filter works. Highlight absent.
    - **Standen-KO (KO-tree):** No KO tree view exists; current KO "standings" is a flat round list. Highlighting is absent.
- **Expected behavior per view:**
  - Mijn Team button always uses pink color scheme (e.g., Tailwind `bg-pink-500`, `text-pink-700`).
  - **Wedstrijden-Poule:** Matches filtered to the team; team name highlighted pink in each row.
  - **Standen-Poule:** Table filtered to show only the pool(s) containing the team; team's row highlighted pink.
  - **Wedstrijden-KO:** Matches filtered to the team; team name highlighted pink.
  - **Standen-KO:** All matches are shown; the team's entry in each round is lightly highlighted; the team name is bold/pink where it appears.
- **Fix approach:** Add a `favTeam` CSS class utility; apply it conditionally using `m.teamA.id === favTeamId || m.teamB.id === favTeamId`. For standings, filter `pool.standings` to the pool(s) containing `favTeamId`. For KO, apply a highlight to rows where `match.teamAId === favTeamId || match.teamBId === favTeamId`.

---

### Bug #17: Public Page — Status Filter Buttons Not Styled as Button Group — DONE AND RESOLVED

- **Location:** `pages/index.vue:270–286`
- **Issue:** "Alle wedstrijden", "Gespeeld", and "Te spelen" are rendered as three separate `<button>` elements with individual rounded corners. They should form a single connected segmented control (button group), consistent with the desired treatment for the phase/sub-tab buttons (Bug #15).
- **Current style:** `class="rounded px-3 py-1.5 text-sm"` — each button is fully rounded independently.
- **Expected behavior:** Buttons are visually joined; left button has left-rounded corners only, right button has right-rounded corners only, middle button has none.
- **Fix approach:** Apply `rounded-l` / `rounded-none` / `rounded-r` conditionally, and remove the `gap-2` between them (use `border-r` dividers instead), or use a utility class approach.

---

### Bug #18: Schedule Generation — Tournament `startTime` May Carry Date-Only Value, Ignoring Time Component — DONE AND RESOLVED

- **Location:** `server/api/admin/schedule/generate.post.ts:44`, `server/api/admin/tournament.post.ts:8,47`
- **Issue:** The user reports "each match should be after the starting dateTime, not after the starting date AND after the starting time" — suggesting that in practice, matches are being scheduled from midnight (00:00) of the start date, not from the actual start time.
- **Root cause analysis:**
  - `tournament.post.ts:8` accepts `startTime` as a string and validates it with `!isNaN(new Date(s).getTime())`. If the wizard sends a partial datetime string (e.g., `"2026-06-15"` with no time component), `new Date("2026-06-15")` parses to `2026-06-15T00:00:00.000Z` (UTC midnight). When stored and later retrieved as `tournament.startTime`, the time is midnight.
  - `generate.post.ts:44`: `const baseTime = body.startDateTime ? new Date(body.startDateTime) : tournament.startTime;` — if no `startDateTime` override is given, it falls back to `tournament.startTime`, which may be midnight.
  - Bug #11 (native `datetime-local` rendering issue) is a contributing factor: if the user cannot correctly enter the time, the stored value will be wrong.
- **Expected behavior:** `tournament.startTime` stores the full datetime including the time component; schedule generation uses this exact datetime as the base for all match slots.
- **Fix approach:** Ensure the tournament wizard sends a full ISO datetime string including time (fix tied to Bug #11). Add a backend validation in `tournament.post.ts` that rejects date-only strings without a time component.

---

## Category 6: Algorithm / Logic Bugs (New — reported 2026-04-01)

### Bug #19: Schedule Generation — Greedy Algorithm Does Not Balance Poule Load or Spread Team Matches — DONE AND RESOLVED

- **Location:** `server/api/admin/schedule/generate.post.ts:91–156`
- **Issue (three sub-problems):**

  **19a — Field utilisation: free fields not used for behind-schedule pools**
  - Current algorithm (`allMatches` built in round-order per pool, then greedy earliest-field): if pools have different sizes, smaller pools run out of rounds earlier. When a timeslot has a free field, the algorithm fills it with whatever match is next in the sorted list, regardless of which pool is "behind". The desired behaviour is: when a field is free in a timeslot, prefer matches from the pool that has the most remaining unscheduled rounds relative to its total rounds.

  **19b — Pool balance: matches per poule not spread evenly across time**
  - The current round-mixing in `allMatches` interleaves pool rounds in order (round 1 of all pools, then round 2 of all pools, etc.). For pools of unequal size this produces uneven distribution: a 6-team pool (5 rounds) has later rounds bunched at the end while a 4-team pool (3 rounds) finishes early, leaving its fields empty.
  - Desired: at any point in the day, the ratio of matches-played-to-total-matches should be roughly equal across all pools.

  **19c — Team spacing: team matches not spread across the day**
  - The current `teamNextSlot` constraint only prevents overlaps; it does not enforce a minimum gap between a team's consecutive matches. Teams with many opponents may end up playing back-to-back matches in the first half of the day with nothing in the second half.
  - Desired: enforce a minimum rest gap between a team's matches (e.g., at least one slot gap). This is explicitly marked as lower priority by the user.

- **Expected behaviour:**
  - Fields are never left idle in a timeslot if there are still unscheduled matches.
  - At any given timeslot, the fraction of scheduled matches per pool is roughly equal.
  - (Lower priority) Each team's matches are spread across the full schedule window.
- **Current algorithm summary:** `O(M)` greedy: for each match in round-interleaved order, pick the field with the earliest available slot respecting only team conflicts. No pool-balance heuristic.
- **Fix approach:**
  - Replace the flat ordered `allMatches` with a priority-queue ordered by `pool.scheduledCount / pool.totalMatches` (ascending) so the pool furthest behind is always scheduled next.
  - Track `poolMatchesInSlot[slotIndex]` to avoid assigning too many matches of the same pool in a single slot.
  - For team spacing: add `minRestSlots` (e.g., 1) to the `teamNextSlot` calculation: `teamNextSlot.set(id, bestSlot + 1 + minRestSlots)`.

---

## Recommended Fix Order

### Previously resolved (reference only)
1. **Bug #3** (DateTime parameter) — DONE
2. **Bug #1** (Loading state) — DONE
3. **Bug #2** (Button state per match) — DONE
4. **Bug #4** (Match pre-generation) — DONE
5. **Bug #5** (Dynamic next match creation) — DONE

### New bugs — suggested order

6. **Bug #7** (Route conflict → 400 on score save) — Blocking core referee workflow; delete the legacy dot-notation files first
7. **Bug #9** (Referee reset-password 404) — Simple file rename; unblocks admin workflow
8. **Bug #8** (Logout non-functional) — Blocking session management; investigate layout wiring
9. **Bug #6** (Admin login 401 + JS crash) — Requires DB verification + input rendering fix; two independent sub-fixes
10. **Bug #10** (Stale /login route) — Trivial cleanup; delete `pages/login.vue`
11. **Bug #11** (Datetime picker) — Prerequisite for Bug #18; replace native input with VueDatePicker
12. **Bug #18** (startTime loses time component) — Depends on Bug #11 being fixed first
13. **Bug #12** (Negative points frontend) — Minor; add reactive validation to existing computed
14. **Bug #13** (Wizard validation feedback + duplicate name) — UX polish + missing backend check
15. **Bug #14** (Swap conflict detection + visual preview) — Important for schedule integrity; two sub-tasks
16. **Bug #19** (Schedule generation algorithm) — Complex; tackle sub-problems 19a, 19b, then 19c
17. **Bug #15** (Button group layout) — Pure UI; no logic changes
18. **Bug #16** (Mijn Team theming + filtering) — UI + filter logic per view
19. **Bug #17** (Status filter button group) — Trivial CSS change

---

## Files to Inspect

### Frontend (Vue components)
- [pages/login.vue](pages/login.vue) — Bug #10 (remove)
- [pages/admin/tournament.vue](pages/admin/tournament.vue) — Bug #11, #12, #13
- [pages/admin/referees.vue](pages/admin/referees.vue) — Bug #9 (URL mismatch)
- [pages/admin/schedule.vue](pages/admin/schedule.vue) — Bug #14 (swap UI + conflict highlight)
- [pages/ref/index.vue](pages/ref/index.vue) — Bug #7 (verify route resolves correctly after fix)
- [pages/index.vue](pages/index.vue) — Bug #15, #16, #17
- Admin/ref layout files — Bug #8 (logout button wiring)
- [composables/useAuth.ts](composables/useAuth.ts) — Bug #6, #8

### Backend (Nitro API)
- `server/api/ref/matches.[id].patch.ts` — Bug #7 (delete this legacy file)
- `server/api/admin/schedule/matches.[id].patch.ts` — Bug #7 (delete this legacy file)
- `server/api/admin/pools.[id].put.ts` — Bug #7 (verify/delete if directory-notation version exists)
- [server/api/admin/referees/[id].reset-password.post.ts](server/api/admin/referees/[id].reset-password.post.ts) — Bug #9 (move to `[id]/reset-password.post.ts`)
- [server/api/auth/login.post.ts](server/api/auth/login.post.ts) — Bug #6 (error message clarity)
- [server/api/auth/logout.post.ts](server/api/auth/logout.post.ts) — Bug #8 (sound; check layout caller)
- [server/api/admin/tournament.post.ts](server/api/admin/tournament.post.ts) — Bug #13 (duplicate name), #18 (startTime validation)
- [server/api/admin/schedule/matches/swap.post.ts](server/api/admin/schedule/matches/swap.post.ts) — Bug #14 (add conflict detection)
- [server/api/admin/schedule/conflict-check.get.ts](server/api/admin/schedule/conflict-check.get.ts) — Bug #14 (reuse logic)
- [server/api/admin/schedule/generate.post.ts](server/api/admin/schedule/generate.post.ts) — Bug #18, #19

---

## Testing Strategy

After each fix:
1. Run `npx vitest run` — no regressions
2. Run `npm run typecheck` — no type errors
3. Run `npm run lint` — no lint errors

### Per-bug verification
- **Bug #7:** PATCH `/api/ref/matches/{uuid}` returns 200 with updated score; no 400 errors
- **Bug #9:** POST `/api/admin/referees/{uuid}/reset-password` returns `{ success: true }`
- **Bug #8:** Clicking logout clears session and redirects; no console errors
- **Bug #6:** Admin login with correct password succeeds; no JS exceptions in console
- **Bug #10:** `/login` returns 404 or redirects; no orphaned page accessible
- **Bug #11:** Tournament wizard datetime picker shows 24h; year field is 4 digits; format is `dd/mm/yyyy hh:mm`
- **Bug #12:** Typing `-1` in any points field shows inline validation error; submit is blocked
- **Bug #13:** Invalid fields show error messages below them; duplicate name returns a field-specific error
- **Bug #14:** After swapping two matches that create a conflict, the conflict is visible in all three schedule tabs; during selection mode, shared teams/fields are highlighted
- **Bug #18:** Creating a tournament at 09:30 and generating a schedule produces first match at 09:30, not 00:00
- **Bug #19:** With 3 pools of different sizes, matches are distributed evenly across the day per pool; no idle fields while matches remain unscheduled

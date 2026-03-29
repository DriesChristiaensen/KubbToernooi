# Bug Report — Kubb Tournament WebApp

**Generated:** 2026-03-28
**Total Bugs:** 5
**Critical:** 3
**High:** 2

---

## Summary

Bugs focused on referee match page loading states, score save button state persistence, schema generation, and KO bracket match pre-generation with nullable team slots and dynamic winner linking. Core issues involve component state management, schema design, and match tree structure generation.

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

## Recommended Fix Order

1. **Bug #3** (DateTime parameter) — Prerequisite for tournament setup; must be in place before other generation bugs
2. **Bug #1** (Loading state) — Quick UX fix affecting ref experience
3. **Bug #2** (Button state per match) — Blocking referee workflow; must fix for tournament scoring
4. **Bug #4** (Match pre-generation) — Foundational schema design; must be in place before score entry works correctly
5. **Bug #5** (Dynamic next match creation) — Depends on Bug #4; score entry logic

---

## Files to Inspect

### Frontend (Vue components)
- `pages/ref/index.vue` — Bug #1 (loading state), Bug #2 (button state per match)
- KO bracket match scoring component — Bug #5 (verify winner → next match logic)

### Backend (Nitro API)
- `server/api/admin/[tournament-type]/generate.post.ts` — Bug #3 (datetime parameter), Bug #4 (match tree generation)
- `server/api/ref/matches/[id].patch.ts` — Bug #5 (score entry → next match creation)

### Database Schema
- `prisma/schema.prisma` — KoMatch model
  - Add `nextMatchId` (FK to KoMatch)
  - Make `teamB` nullable (change from required to optional)

### Utilities
- Match generation logic (separate utility file or API handler)
- Winner determination logic

---

## Testing Strategy

After each fix:
1. Run `npx vitest run` to ensure no test regressions
2. For Bug #3: Verify generated matches have correct `scheduledAt` times
3. For Bug #4: Test with edge cases (1 team, 3 teams, 5 teams, 10 teams, 16 teams); verify bracket tree structure
4. For Bug #5: Enter scores in order; verify next match is created with single team and correct team slot; verify opponent populated when other preceding match completes
5. Verify database state and match linking
6. Move to next bug

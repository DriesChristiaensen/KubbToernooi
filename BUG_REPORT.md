# Bug Report — Kubb Tournament WebApp

**Generated:** 2026-03-28
**Total Bugs:** 4
**Critical:** 2
**High:** 1
**Medium:** 1

---

## Summary

Bugs focused on referee dashboard loading states, score save button logic, and KO bracket UI/generation logic. Core issues involve state management, conditional rendering, and tournament schema generation complexity.

---

## Category 1: Critical Bugs

### Bug #1: Incorrect Loading State Messages on Referee & Public Match Pages — DONE AND RESOLVED

- **Location:**
  - Referee dashboard: `pages/ref/index.vue`
  - Public page: `pages/index.vue` (or public match viewing page)
- **Issue:**
  - Referee page shows error message "Er is een fout opgetreden" (An error has occurred) instead of loading state
  - Public page shows "Geen wedstrijden gevonden" (No matches found) instead of loading state
- **Expected behavior:** Both pages should display "Laden..." (Loading...) spinner while fetching tournament/matches data
- **Likely cause:** Conditional rendering checks for data before `isLoading` flag is checked; error displayed prematurely
- **Affected states:** Initial page load, page refresh, data polling
- **Fix approach:** Reorder conditional logic: `if (isLoading) show Loading... else if (error) show Error else if (data) show Data else show EmptyState`
- **Resolution:** Added `isLoading = ref(true)` to both pages. `pages/ref/index.vue`: `finally { isLoading.value = false }` in `fetchMatches`, template wraps error/empty in `<template v-else>`. `pages/index.vue`: `isLoading.value = false` after fetch, `v-else-if` guards "no matches" message.

---

### Bug #2: Score Save Button Logic — Multi-Save Capability — DONE AND RESOLVED

- **Location:** Referee dashboard — `pages/ref/index.vue`
- **Issue:** Save button can only save a score once; after first save, button becomes permanently disabled even when score values change
- **Current behavior:** After first save, disabled state never re-enables
- **Expected behavior:** Button state should toggle based on:
  1. **Enabled** — if no score has been saved yet (initial state)
  2. **Enabled** — if user-entered score differs from last saved database value
  3. **Disabled** — if user-entered score equals last saved database value
- **Formula for button state:** `isDisabled = (savedScore !== null) && (currentInput === savedScore)`
- **Data to track:**
  - `savedScore` — value stored in database
  - `currentInput` — value currently in form field
- **Likely cause:** State not reset after save; comparison logic missing or inverted
- **Implementation approach:** On successful save, store returned `savedScore` and re-evaluate button enable condition
- **Resolution:** Changed `savedScores` type to `string | null`. Initial fetch stores `null` when DB score is null. `isDirty()` now returns `true` (enabled) when either saved score is `null`. After a save, stores the actual string values so subsequent edits re-enable only if changed.

---

## Category 2: High Priority Bug

### Bug #3: KO Bracket Dashboard — Tree Structure UI & Generation Logic — DONE AND RESOLVED (Sub-issue A)

- **Location:** `pages/admin/ko-bracket.vue` (or similar) + `server/api/admin/ko-bracket/generate.post.ts`
- **Issue:** Multiple sub-issues with KO bracket representation and generation:

#### Sub-issue A: Visual Tree Structure
- **Problem:** Current UI does not clearly display bracket tree structure
- **Expected format:** Table-based bracket view where:
  - First row: One cell per match (1st round matches)
  - Each subsequent row: Cells double the width of previous row (containing winners matches)
  - Structure converges toward the final (champion row)
- **First round match count:** Must always be a power of 2 (1, 2, 4, 8, 16, 32, 64, etc.)
- **Empty matches:** If fewer teams than match slots, matches remain empty or contain only 1 team
- **Bye rounds:** Teams without opponents advance automatically (they "win" the empty match) to next round
- **Key constraint:** A match can NEVER have 0 teams; every match has ≥1 team

#### Sub-issue B: KO Tournament Generation (Pure KO)
- **Trigger:** User clicks generate/refresh button on KO tournament
- **Logic:**
  - Calculate: `firstRoundMatches = 2^ceil(log2(teamCount))`
  - Maximum total matches: `(teamCount * 2) - 1`
  - Example: 10 teams → 4 matches in round 1 (power of 2), total 7 matches max
- **Match assignment algorithm:**
  1. First, fill all matches with ≥1 team each (distribute `teamCount` teams across `firstRoundMatches` slots)
  2. Then assign remaining teams as opponents (pair up available teams)
  3. Unpaired teams advance with a bye (auto-win)
  4. Winners bracket toward final
- **Expected result:** Balanced bracket where every team gets a match position

#### Sub-issue C: Combination Tournament Generation (Pools + KO)
- **Trigger:** Two-step process
  - **Step 1 (Generate button):** Create empty KO bracket structure
  - **Step 2 (Assign Teams button):** Populate bracket with qualified teams
- **Step 1 constraints:**
  - Calculate advancing teams: `totalAdvancing = sum(pool.teamsThrough for all pools)`
  - First round matches: `2^ceil(log2(totalAdvancing))`
  - Does NOT require pool phase to be complete
- **Step 2 constraints:**
  - **Disabled state** with warning message: "Poulefase is nog niet afgerond" (Pool phase not yet completed) until ALL pool matches are played
  - Once enabled, populate bracket with qualified teams
- **Team seeding/sorting** (if too few teams for first round slots):
  - Sort by: Pool finish position → Points → Goal difference → Goals scored → Head-to-head → Random tiebreak
  - Assign best teams to fill slots, allowing excess teams to fill remaining first-round slots
  - Format second row (and beyond): cells are double width of round 1, one match per cell
- **Likely causes:**
  - Missing tree structure CSS/layout
  - Incorrect first-round match calculation (not enforcing power of 2)
  - No bye-handling logic
  - Pool completion check missing for "Assign Teams" button
  - Hardcoded match counts instead of dynamic calculation
- **Resolution (Sub-issue A):** Replaced flat per-round tables with a CSS Grid bracket tree. Each round occupies its own row; round R cells span `2^(R-1)` columns. Future rounds show "Nog te bepalen" placeholders. Sub-issues B/C (bye rounds + schema changes for nullable teamB) require schema migration and are tracked separately.

---

## Category 3: Medium Priority Bug

*(To be added when new bugs are identified)*

---

## Recommended Fix Order

1. **Bug #1** (Loading state messages) — Quick UX win; affects user perception of app
2. **Bug #2** (Score save button) — Blocking referee workflow; must fix for tournament scoring
3. **Bug #3-A** (KO bracket UI structure) — Prerequisite for understanding bracket generation
4. **Bug #3-B** (Pure KO generation) — Core logic; establish power-of-2 first-round rule
5. **Bug #3-C** (Combination KO generation) — Extends pure KO; pool integration + seeding logic

---

## Files to Inspect

### Frontend (Vue components)
- `pages/ref/index.vue` — Bug #1 (loading state), Bug #2 (button logic)
- `pages/admin/ko-bracket.vue` (or similar) — Bug #3-A (UI structure)
- KO bracket component (if separate) — bracket rendering, match layout

### Backend (Nitro API)
- `server/api/admin/ko-bracket/generate.post.ts` — Bug #3-B & #3-C (generation logic)
- `server/api/admin/ko-bracket/assign-teams.post.ts` (if exists) — Bug #3-C (team assignment, pool completion check)
- Pool-related endpoints — validate `teamsThrough` values

### Data/Logic
- KO match model — verify supports empty/bye matches
- Pool standings calculation — ensure seeding sort logic available
- Tournament type detection — distinguish KNOCKOUT vs COMBINATION vs POOLS

---

## Testing Strategy

After each fix:
1. Run `npx vitest run` to ensure no test regressions
2. Test in browser: reproduce original issue, verify fix works
3. For Bug #3: Test with edge cases (1 team, 3 teams, 5 teams, 10 teams, 16 teams, etc.)
4. Verify database state and bracket structure
5. Move to next bug

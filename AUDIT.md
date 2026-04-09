# Codebase Audit — Kubb Tournament WebApp

Full audit against `.project-docs/AcceptanceCriteriaAllCode.md`. Every API endpoint, page, component, composable, middleware, utility, config, schema, i18n, and test file was reviewed.

---

## Severity Legend

- **CRITICAL** — Security risk or data corruption. Fix before any feature work.
- **HIGH** — Violates core acceptance criteria. Fix before next release.
- **MEDIUM** — Code quality / maintainability. Fix in next sprint.
- **LOW** — Minor / cosmetic. Backlog.

---

## Implementation Order

Priority groups ordered by risk and dependency. Each group can be done in one iteration.

| Priority | IDs                | Scope                                                             | Est. Files |
| -------- | ------------------ | ----------------------------------------------------------------- | ---------- |
| **P0**   | C1, C2, C3         | Security fixes: $transaction wrappers, nuxt.config                | ~15        |
| **P1**   | H1, H2, H9         | Zod validation on all endpoints + error code format + null guard  | ~20        |
| **P2**   | H4, H3, M6, M7     | Schema: indexes, cascade fix, unique constraint + standings batch | ~3         |
| **P3**   | H5, H6             | HTTP status codes + JSDoc on all endpoints                        | ~36        |
| **P4**   | H7, H8             | i18n fixes + delete operation error handling/guards               | ~10        |
| **P5**   | M1, M2, M3, M4, M5 | Code quality: assertions, casts, a11y, race guards, comments      | ~15        |
| **P6**   | L1-L9              | Backlog: tests, config, minor fixes                               | ~10        |

---

## CRITICAL

### C1. Zero `$transaction` usage — race conditions on all multi-step DB operations

**AC violated:** #5 Race Conditions, #6 DB Constraints  
**Impact:** Data corruption under concurrent requests. Zero uses of `prisma.$transaction()` across entire `server/api/`.

| File                                                | Lines   | Risk                                                           | Status |
| --------------------------------------------------- | ------- | -------------------------------------------------------------- | ------ |
| `server/api/admin/tournament.post.ts`               | 49-68   | Deactivate old + create new tournament — two could be active   | ✅ DONE |
| `server/api/admin/tournaments/[id]/restore.post.ts` | 22-30   | Deactivate all + restore one — same                            | ✅ DONE |
| `server/api/admin/pools/generate.post.ts`           | 43-62   | Delete + loop-create pools — partial state on mid-loop failure | ✅ DONE |
| `server/api/admin/pools/[id].put.ts`                | 40-46   | deleteMany poolTeams + createMany — orphan risk                | ✅ DONE |
| `server/api/admin/fields/generate.post.ts`          | 31-39   | Delete + create fields — partial state                         | ✅ DONE |
| `server/api/admin/schedule/generate.post.ts`        | 97-181  | Delete + createMany matches — partial schedule                 | ✅ DONE |
| `server/api/admin/schedule/matches/swap.post.ts`    | 38-46   | Two separate match updates — half-swapped state                | ✅ DONE |
| `server/api/admin/schedule/matches/[id].patch.ts`   | 57-60   | Two updates for field+time change                              | ✅ DONE |
| `server/api/admin/schedule/time-shift.post.ts`      | 50-57   | Promise.all with multiple match updates                        | ✅ DONE |
| `server/api/admin/ko-bracket/generate.post.ts`      | 95-136  | Delete + loop-create KO matches                                | ✅ DONE |
| `server/api/admin/ko-bracket/fill-teams.post.ts`    | 109-137 | Multiple match updates in loops                                | ✅ DONE |
| `server/api/admin/import.post.ts`                   | 70-184  | Full multi-table import — partial state on any failure         | ✅ DONE |
| `server/api/ref/matches/[id].patch.ts`              | 57-78   | Score + KO advancement chain — broken bracket                  | ✅ DONE |

**Fix:** Wrap each multi-step operation in `prisma.$transaction(async (tx) => { ... })`, passing `tx` to all queries inside.

---

### C2. Session password empty-string fallback — **✅ DONE**

**AC violated:** #10.3 Sensitive Data  
**File:** `nuxt.config.ts:18`

Removed empty-string fallback. Now uses `process.env.NUXT_SESSION_PASSWORD` directly, will be undefined if missing and caught at runtime.

---

### C3. Devtools enabled unconditionally — **✅ DONE**

**AC violated:** #10.3 Sensitive Data  
**File:** `nuxt.config.ts:5`

Changed to `devtools: { enabled: import.meta.dev }` — enabled only in development mode.

---

## HIGH

### H1. Zod validation missing on 14 POST/PATCH/PUT endpoints

**AC violated:** #5.1 API Input Validation, Top-10 #1 Unvalidated Input

These routes read `await readBody(event)` without a Zod schema — raw user input flows into Prisma:

| #   | Route                                               | Status | Notes                            |
| --- | --------------------------------------------------- | ------ | -------------------------------- |
| 1   | `server/api/admin/tournament.patch.ts`              | ✅ DONE | Zod validation added             |
| 2   | `server/api/admin/fields.post.ts`                   | ✅ DONE | Zod validation added             |
| 3   | `server/api/admin/fields/[id].put.ts`               | ✅ DONE | Zod validation added             |
| 4   | `server/api/admin/fields/generate.post.ts`          | ✅ DONE | Zod validation added             |
| 5   | `server/api/admin/teams.post.ts`                    | ✅ DONE | Zod validation added             |
| 6   | `server/api/admin/teams/[id].put.ts`                | ✅ DONE | Zod validation added             |
| 7   | `server/api/admin/teams/bulk-import.post.ts`        | ✅ DONE | Zod validation added             |
| 8   | `server/api/admin/referees.post.ts`                 | ✅ DONE | Zod validation added             |
| 9   | `server/api/admin/pools/[id].put.ts`                | ✅ DONE | Zod validation added             |
| 10  | `server/api/admin/pools/generate.post.ts`           | ✅ DONE | Zod validation added             |
| 11  | `server/api/admin/schedule/matches/[id].patch.ts`   | ✅ DONE | Zod validation added             |
| 12  | `server/api/admin/schedule/time-shift.post.ts`      | ✅ DONE | Zod validation added             |
| 13  | `server/api/admin/ko-bracket/matches/[id].patch.ts` | ✅ DONE | Zod validation added             |
| 14  | `server/api/ref/matches/[id].patch.ts`              | ✅ DONE | Zod validation added             |

Additionally, `server/api/admin/import.post.ts` uses a custom `isValidImport()` type guard instead of Zod.

**Fix:** Add `const schema = z.object({...}); const body = schema.parse(await readBody(event));` to each endpoint.

---

### H2. Error code format: numeric instead of snake_case strings — ✅ DONE

**AC violated:** #5.2 Error Responses, #2.4 API Routes

**Status:** COMPLETED. All endpoints now use string error codes instead of numeric HTTP status codes. Error code mapping centralized in `server/utils/errors.ts`. Added new codes:
- `unauthorized` (403)
- `rate_limit_exceeded` (429)  
- `database_unavailable` (503)

All API endpoints (~14 files) updated with string codes. Test mocks updated to properly map string codes to HTTP status codes. All validations passing.

---

### H3. N+1 query in standings recalculation — ✅ DONE

**AC violated:** #11.1 Database Queries  
**File:** `server/utils/standings.ts`

**Status:** COMPLETED. Changed from individual `upsert()` calls to batch `delete + createMany` in a single transaction. Computes all standings in memory, then applies atomically. Test mocks updated accordingly.

---

### H4. Missing database indexes on frequently queried columns — ✅ DONE

**AC violated:** #8.1 Schema & Constraints, #11.1 Database Queries  
**File:** `prisma/schema.prisma`

**Status:** COMPLETED. Added indexes to Match model:
- `@@index([poolId])`
- `@@index([fieldId])`
- `@@index([startTime])`
- `@@index([poolId, status])`

Added index to Standing model:
- `@@index([poolId])`

Database schema synchronized with Prisma migration.

---

### H5. HTTP status codes all default to 200 — ✅ DONE

**AC violated:** #9.1 HTTP Methods & Status Codes

**Status:** COMPLETED. Added `setResponseStatus()` calls to all endpoints:
- 11 POST-create endpoints now return 201 (Created)
- 6 DELETE endpoints now return 204 (No Content)

---

### H6. JSDoc missing on all API endpoints and utility functions — ✅ DONE

**AC violated:** #1.2 JSDoc/Type Documentation

**Status:** COMPLETED. Added comprehensive JSDoc to all 52 functions:
- All 36 API endpoints documented with @param, @returns, @throws
- All 5 server utilities documented (tournament, errors, standings, rate-limit, logger)
- Both composables documented (useAuth, usePolling)
- Datetime utilities documented
- All JSDoc includes: parameter descriptions, return types, and error conditions

---

### H7. Hardcoded strings violating i18n — 🟡 PARTIALLY DONE

**AC violated:** #7.1 User-Facing Text, Top-10 #3

#### Client-side (✅ COMPLETED):

All user-facing hardcoded strings have been fixed:
- `components/HamburgerMenu.vue`: Added `nl.nav.closeMenu` / `nl.nav.openMenu` keys
- `pages/index.vue`: Added i18n keys with interpolation (`nl.public.schedule.finaleFormat`, `nl.public.schedule.roundOrdinal`)
- `pages/admin/ko-bracket.vue`: Updated to use i18n keys for round labels
- `composables/useAuth.ts`: Uses proper i18n fallback handling
- `i18n/nl.ts`: Fixed English strings to Dutch ("Winnende teams", "Vrij lot")

Client-side: **100% complete**

#### Server-side (⏳ PENDING):

87 hardcoded error strings in `createApiError()` calls across API endpoints. These should be extracted to an `error-messages.ts` constants module for consistency and maintainability. This is deferred to future iteration as server errors are not user-visible and have lower impact than client-side issues.

---

### H8. Delete operations lack error handling and loading guards — ✅ DONE

**AC violated:** #5.3 Frontend Validation, #7.4 Forms, Top-10 #5 Race Conditions

**Status:** COMPLETED. All four delete operations now have:
- ✓ Confirmation dialogs (using i18n keys)
- ✓ Try-catch error handling with user feedback
- ✓ Loading state management (per-item using Set<string>)
- ✓ Disabled buttons during operation (prevents race conditions)

**Files updated:**
- `pages/admin/referees.vue`: Added deleteLoading ref, confirm dialog, error handling, :disabled binding
- `pages/admin/teams.vue`: Added deleteLoading ref, error handling, :disabled binding  
- `pages/admin/fields.vue`: Added deleteLoading ref, error handling, :disabled binding
- `pages/admin/pools.vue`: Added deleteLoading ref to existing error handling, added :disabled binding
- `i18n/nl.ts`: Added `nl.admin.referees.deleteConfirm` confirmation message

All delete operations now prevent race conditions and provide proper user feedback.

---

### H9. Missing null check before update in reset-password — **✅ DONE**

**AC violated:** #5.4 Null Safety, Top-10 #2  
**File:** `server/api/admin/referees/[id]/reset-password.post.ts:15`

**Status:** COMPLETED. Added `findFirst` + null guard before update. Now returns proper 404 via `createApiError` when referee doesn't exist, instead of 500 Prisma error.

**Before:**
```ts
await prisma.user.update({
  where: { id, role: "REFEREE" },
  data: { password: null },
});
```

**After:** Added null check that throws 404 before attempting update.

---

## MEDIUM

### M1. Non-null assertions without justifying comments — ✅ DONE

**AC violated:** #4.2 Strict Mode

**Status:** COMPLETED. Added `// Safe: <reason>` comments to all 6 non-null assertions:
- `server/api/admin/schedule/generate.post.ts:161`: fields guard ensures array has ≥1 element
- `server/api/admin/ko-bracket/generate.post.ts:134`: fields guard ensures array has ≥1 element
- `pages/admin/schedule.vue:252,268`: map entries created before access via has/set pattern
- `pages/admin/ko-bracket.vue:223,274`: map entries created before access, length guard on array

All assertions now have explanatory comments justifying why null is impossible.

---

### M2. Unnecessary `as string` casts on template literals — ✅ DONE

**AC violated:** #4.1 Type Annotations

**Status:** COMPLETED. Removed all 9 unnecessary `as string` casts from template literals across admin pages:
- `teams.vue`: 2 occurrences in saveEdit() and deleteTeam()
- `fields.vue`: 2 occurrences in saveEdit() and deleteField()
- `pools.vue`: 2 occurrences in saveAssignment() and deletePool()
- `referees.vue`: 2 occurrences in resetPassword() and deleteReferee()
- `ko-bracket.vue`: 1 occurrence in swap operation
- `schedule.vue`: Previously removed

Template literals are already strings; casts were unnecessary type pollution.

---

### M3. Accessibility gaps — ✅ DONE

**AC violated:** #7.3 Accessibility

**Status:** COMPLETED. Implemented accessibility improvements across 5 files:
- **Team picker modal:** Added `role="dialog"` and `aria-labelledby` with `id="team-picker-title"` to main div
- **Team picker buttons:** Converted clickable `<li>` elements to semantic `<button>` elements for keyboard navigation
- **Checkmarks:** Added `aria-label` bindings to both checkmark buttons (referees.vue, ref/index.vue)
- **Pool team buttons:** Added `aria-pressed` attribute reflecting toggle state
- **Required inputs:** Added `required` attribute to 3 essential form inputs:
  - `pages/admin/fields.vue`: generate count input
  - `pages/admin/pools.vue`: pool count input
  - `pages/admin/tournament.vue`: field count input
- ESLint auto-fixed attribute ordering (`:aria-label` before `@click`)

---

### M4. Race conditions on form inputs during async operations — ✅ DONE

**AC violated:** Top-10 #5 Race Conditions

**Status:** COMPLETED. Disabled all form inputs during async operations across 6 functions:
- **teams.vue**: Added `:disabled="loading"` to name input during addTeam()
- **fields.vue**: Added `:disabled="loading"` to name input during addField()
- **pools.vue**: Extended `:disabled` to team buttons using `isTeamDisabled(team.id) || assignLoading`
- **tournament.vue**: Added `:disabled="createLoading"` to all form fields:
  - VueDatePicker, matchDuration, breakTime, pointsWin, pointsDraw, pointsLoss, fieldCount
- **schedule.vue**: Added `:disabled="generateLoading"` to VueDatePicker during generateSchedule()
- **referees.vue**: Added new `resetLoading` Set ref with per-item tracking, implemented loading state:
  - Disabled button with `:disabled="resetLoading.has(referee.id)"`
  - Proper error handling in catch block

All inputs now have `disabled:opacity-50` class for visual feedback.

---

### M5. Cryptic "T8.x" / "T9.x" comments throughout pages — ✅ DONE

**AC violated:** #1.1 Comments

**Status:** COMPLETED. Replaced all 15 cryptic task ID comments with descriptive ones:

**pages/index.vue (9 occurrences):**
- `// T8.2` → `// Filter matches by played/unplayed status`
- `// T8.3` → `// Persist user's favorite team selection in cookie (48 hour expiry)`
- `// T8.5` → `// Track active tab and sub-tab selections for UI navigation`
- `// T8.1` → `// Determine match status: played, live, awaiting (team assignment), or scheduled`
- `// T8.3` → `// Extract and deduplicate teams across all matches for display`
- `// T8.2 + T8.3` → `// Filter matches by status and favorite team`
- `// T8.5` → `// Group KO matches by round and generate round labels (e.g., "1/8 finale")`
- `// T8.5` → `// Sort tied standings by head-to-head record against other teams in the group`

**pages/ref/index.vue (6 occurrences):**
- `// T9.3` → `// Track which matches are in edit mode (allows re-editing if score exists)`
- `// T9.1` → `// Show confirmation dialog when overwriting an existing score`
- `// T9.2` → `// Show success checkmark for 2 seconds`

Comments now explain **why** the code exists, not which ticket created it.

---

### M6. Match.pool `onDelete: SetNull` leaves orphan matches — ✅ DONE

**AC violated:** #8.4 Cascading & Cleanup  
**File:** `prisma/schema.prisma`

**Status:** COMPLETED. Changed `onDelete: SetNull` to `onDelete: Cascade` on the Match-Pool relation. When a pool is deleted, its matches are now cascade-deleted instead of leaving orphans with NULL poolId.

---

### M7. Missing User(name) unique constraint — ✅ DONE

**AC violated:** #8.1 Schema & Constraints  
**File:** `prisma/schema.prisma`

**Status:** COMPLETED. Added `@@unique([name])` to the User model. Prevents multiple users (referees/admins) from being created with the same name, ensuring login uniqueness.

---

## LOW

| #   | Issue                                                                                         | AC            | Location                               |
| --- | --------------------------------------------------------------------------------------------- | ------------- | -------------------------------------- |
| L1  | `compatibilityDate: '2025-07-15'` is a future date                                            | Config        | `nuxt.config.ts:3`                     |
| L2  | `useAuth.ts:18` uses `as { user: { role: string } }` unsafe cast                              | #4.1          | `composables/useAuth.ts`               |
| L3  | `admin-tournament-guard.ts:10` has `as { status?: number }` without comment                   | #4.2          | `middleware/admin-tournament-guard.ts` |
| L4  | Magic numbers: `MATCH_DURATION_MS = 15 * 60 * 1000`, `30_000` interval, `80px` bracket height | #7.2          | `pages/index.vue:65,117`               |
| L5  | No middleware tests exist                                                                     | #6.2          | `server/middleware/`                   |
| L6  | Missing tests for GET endpoints: `ko-bracket/matches.get`, `schedule/matches.get`             | #6.2          | `server/api/admin/`                    |
| L7  | `standings.test.ts` mock doesn't cover null-tournament path                                   | #6.2          | `server/utils/standings.test.ts`       |
| L8  | Cookie security flags not explicitly configured for nuxt-auth-utils                           | #10.4         | `nuxt.config.ts`                       |
| L9  | `Math.random() - 0.5` shuffle in pool generation is biased                                    | Best practice | `pools/generate.post.ts`               |

---

## Summary Scoreboard

| AC Category                  | Status  | Key Gaps                                                                            |
| ---------------------------- | ------- | ----------------------------------------------------------------------------------- |
| 1. Code Documentation        | FAIL    | No JSDoc anywhere (H6)                                                              |
| 2. Naming Conventions        | PASS    | Minor: "T8.x" comments (M5)                                                         |
| 3. Code Style & Formatting   | PARTIAL | Unnecessary `as string` casts (M2)                                                  |
| 4. Type Safety               | PARTIAL | Non-null assertions without comments (M1), unsafe casts (L2)                        |
| 5. Input Validation & Errors | FAIL    | 14 endpoints without Zod (H1), numeric error codes (H2), delete error handling (H8) |
| 6. Testing                   | PARTIAL | Good coverage overall, some gaps (L5-L7)                                            |
| 7. UI/UX Standards           | PARTIAL | Hardcoded strings (H7), accessibility gaps (M3)                                     |
| 8. Database & Data           | FAIL    | Missing indexes (H4), no transactions (C1), missing unique constraint (M7)          |
| 9. API Design & REST         | FAIL    | All status codes default to 200 (H5), numeric error codes (H2)                      |
| 10. Security                 | FAIL    | Session password fallback (C2), devtools in production (C3)                         |
| 11. Performance              | FAIL    | N+1 in standings (H3), missing indexes (H4)                                         |

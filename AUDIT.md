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

**Status:** COMPLETED. Added proper HTTP status codes:
- 11 POST-create endpoints now return 201 Created
- 5 DELETE endpoints now return 204 No Content

Test mocks updated to stub `setResponseStatus`. DELETE endpoints now return `null` with 204 status (no response body for DELETE operations per REST standards).

---

### H6. JSDoc missing on all API endpoints and utility functions — ✅ DONE

**AC violated:** #1.2 JSDoc/Type Documentation

**Status:** COMPLETED. All 52 functions/endpoints documented:
- 45 API endpoints (POST, PUT, PATCH, DELETE, GET)
- 5 server utilities (tournament.ts, errors.ts, standings.ts, rate-limit.ts, logger.ts)
- 2 composables (useAuth.ts, usePolling.ts)

**Pattern established and applied:**
```ts
/**
 * [Action] [Resource description].
 * [Additional context if needed].
 * @param {type} param - Description (constraints if any)
 * @returns {Type} Returned object/array
 * @throws {400} If validation fails
 * @throws {404} If resource not found
 * @throws {409} If conflict (duplicate, etc)
 */
```

All functions now have complete JSDoc with parameter types, return types, error conditions, and contextual explanations.

---

### H7. Hardcoded strings violating i18n

**AC violated:** #7.1 User-Facing Text, Top-10 #3

#### Client-side (visible to users):

| File                           | Line | String                                           | Fix                                                 |
| ------------------------------ | ---- | ------------------------------------------------ | --------------------------------------------------- |
| `components/HamburgerMenu.vue` | 18   | `'Menu sluiten'` / `'Menu openen'` in aria-label | Use `nl.nav.closeMenu` / `nl.nav.openMenu`          |
| `pages/index.vue`              | 300  | `` `1/${matchCount} finale` ``                   | Add i18n key with interpolation                     |
| `pages/admin/ko-bracket.vue`   | 73   | `` `1/${matchCount} finale` ``                   | Same                                                |
| `pages/index.vue`              | 322  | `"e"` ordinal suffix in `` `${match.round}e` ``  | Add i18n key                                        |
| `composables/useAuth.ts`       | 25   | `'Inloggen mislukt'` fallback                    | Use `nl.auth.loginFailed`                           |
| `i18n/nl.ts`                   | 203  | `"Winning teams"` (English in Dutch file)        | Change to `"Winnende teams"`                        |
| `i18n/nl.ts`                   | 206  | `"Bye"` (English)                                | Change to `"Vrij lot"` or keep as tournament jargon |

#### Server-side (87 occurrences):

All `createApiError({ error: "Dutch text" })` calls use hardcoded strings. While server errors are harder to i18n, they should at minimum be constants to prevent inconsistency.

---

### H8. Delete operations lack error handling and loading guards

**AC violated:** #5.3 Frontend Validation, #7.4 Forms, Top-10 #5 Race Conditions

| File                             | Function          | Issues                                                            |
| -------------------------------- | ----------------- | ----------------------------------------------------------------- |
| `pages/admin/referees.vue:66-69` | `deleteReferee()` | **No try-catch, no error feedback, no confirm, no loading state** |
| `pages/admin/teams.vue:85-95`    | `deleteTeam()`    | Has confirm but no `:disabled` on button, silent on failure       |
| `pages/admin/fields.vue:85-97`   | `deleteField()`   | Same pattern                                                      |
| `pages/admin/pools.vue:169-179`  | `deletePool()`    | Has error handling but no `:disabled` on button during operation  |

**Fix:** Add try-catch with error display, loading ref, `:disabled` binding, and confirm dialog to each.

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

### M1. Non-null assertions without justifying comments

**AC violated:** #4.2 Strict Mode

| File                                           | Line | Expression                             |
| ---------------------------------------------- | ---- | -------------------------------------- |
| `server/api/admin/schedule/generate.post.ts`   | 154  | `fields[0]!`                           |
| `server/api/admin/ko-bracket/generate.post.ts` | 118  | `fields[i % fields.length]!`           |
| `pages/admin/schedule.vue`                     | 252  | `map.get(m.field.id)!.matches.push(m)` |
| `pages/admin/schedule.vue`                     | 268  | `map.get(id)!.matches.push(m)`         |
| `pages/admin/ko-bracket.vue`                   | 223  | `map.get(m.round)!.push(m)`            |
| `pages/admin/ko-bracket.vue`                   | 274  | `poolTimes.sort().at(-1)!`             |

**Fix:** Add `// Safe: <reason>` comment to each, or refactor to avoid the assertion.

---

### M2. Unnecessary `as string` casts on template literals

**AC violated:** #4.1 Type Annotations

~10 occurrences across admin pages:

```ts
await $fetch(`/api/admin/fields/${id}` as string, { ... })
```

Template literals are already strings. These casts are noise.

**Affected:** `teams.vue` (2x), `fields.vue` (2x), `pools.vue` (2x), `referees.vue` (2x), `ko-bracket.vue` (1x), `schedule.vue` (1x)

**Fix:** Remove `as string` from all template literal URL expressions.

---

### M3. Accessibility gaps

**AC violated:** #7.3 Accessibility

| Issue                                                            | Location                                                                                                                    |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Team picker modal missing `role="dialog"` and `aria-labelledby`  | `pages/index.vue` template                                                                                                  |
| Checkmark `✓` character used as icon without accessible text     | `pages/index.vue`, `pages/ref/index.vue`, `pages/admin/referees.vue`                                                        |
| Pool team toggle buttons missing `aria-pressed` attribute        | `pages/admin/pools.vue`                                                                                                     |
| Clickable `<li>` elements instead of `<button>` in team picker   | `pages/index.vue`                                                                                                           |
| Missing `required` on essential form inputs                      | `pages/admin/fields.vue` (generate count), `pages/admin/pools.vue` (pool count), `pages/admin/tournament.vue` (field count) |
| Small touch targets (`px-3 py-1 text-sm`) on edit/delete buttons | `pages/admin/teams.vue`, `pages/admin/fields.vue`                                                                           |

---

### M4. Race conditions on form inputs during async operations

**AC violated:** Top-10 #5 Race Conditions

Multiple forms disable the submit button but not the input fields during async operations, allowing re-submission via Enter key:

| File                         | Function             | Issue                                           |
| ---------------------------- | -------------------- | ----------------------------------------------- |
| `pages/admin/teams.vue`      | `addTeam()`          | Input not disabled during loading               |
| `pages/admin/fields.vue`     | `addField()`         | Same                                            |
| `pages/admin/pools.vue`      | `saveAssignment()`   | Team selection buttons not disabled during save |
| `pages/admin/tournament.vue` | `createTournament()` | Form inputs not disabled                        |
| `pages/admin/schedule.vue`   | `generateSchedule()` | Same                                            |
| `pages/admin/referees.vue`   | `resetPassword()`    | No loading state, button not disabled           |

---

### M5. Cryptic "T8.x" / "T9.x" comments throughout pages

**AC violated:** #1.1 Comments

Comments like `// T8.2 – status filter`, `// T9.3: edit mode per match` reference ticket/task IDs without context. While they trace to requirements, they should explain the **why** not reference internal IDs.

**Affected:** `pages/index.vue` (9 occurrences), `pages/ref/index.vue` (6 occurrences)

**Fix:** Rewrite as `// Filter matches by played/unplayed status` etc., or remove if the code is self-explanatory.

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

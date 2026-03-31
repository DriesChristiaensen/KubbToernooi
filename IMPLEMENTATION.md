# Implementation Notes — Kubb Tournament WebApp

## Current State (Iteration 2 complete)

**Branch:** `feature/7.1-ko-bracket-generation` (off `epic/7-ko-bracket` off `develop`)
**Tests:** 140 passing
**Next task:** Phase 7 — KO Bracket Generation

## Completed Phases

| Phase | Epic | Stories | Status |
|-------|------|---------|--------|
| 0–2 | Setup, Auth (7), Config (1) | 7.1/7.2/7.3, 1.1/1.2/1.3 | Done |
| 3 | Tournament Structure (5) | 5.1/5.2 | Done |
| 4 | Schedule Management (2) | 2.1/2.2/2.3/2.4 | Done |
| 5 | Results & Standings (4) | 4.1/4.2/4.3 | Done |
| 6 | Participants View (3) | 3.1/3.2/3.3/3.4 | Done |
| 7 (Phase 7) | KO Bracket | generation + adjustment | **IN PROGRESS** |
| 8 | Data Backup (6) | 6.1/6.2 | Done |

## Key Findings & Rules

### API Handler Pattern
- File naming: `server/api/admin/<resource>.<method>.ts` for top-level, or `server/api/admin/<resource>/<action>.<method>.ts` for sub-routes
- Nuxt auto-maps file names to routes: `schedule/generate.post.ts` → `POST /api/admin/schedule/generate`
- Every handler: `export default defineEventHandler(async (event) => { ... })`
- Error: `throw createApiError({ error: "Dutch text", code: 4xx, reason: "English technical cause" })`
- Non-GET requests must call `logRequest(event, "success"|"error", message)`
- `getActiveTournament()` from `~/server/utils/tournament` — throws 404 if none exists

### Test Pattern (Vitest)
- Test files live next to the handlers they test (or in the same subdirectory)
- All globals (`defineEventHandler`, `readBody`, `getRouterParam`, `getQuery`, `createApiError`) must be stubbed with `vi.stubGlobal`
- Prisma is mocked via `vi.mock("~/server/utils/prisma", () => ({ prisma: { ... } }))`
- Mock functions must be declared with `vi.hoisted(() => vi.fn())` so they are available before module imports
- Handlers are imported dynamically: `const { default: handler } = await import("./file")`
- TDD: write failing tests first, then implement
- For `bcrypt`: `vi.mock("bcrypt", () => ({ default: { compare: mockFn } }))`

### Design Tokens & i18n
- All Dutch strings from `i18n/nl.ts` — no hardcoded strings in templates
- Tailwind classes only, referencing tokens defined in `tailwind.config.ts`
- Design tokens: `bg-primary`, `bg-primary-dark`, `bg-surface`, `bg-background`, `bg-error`, `bg-success`, `bg-secondary`, `bg-warning`, `text-text`, `text-text-light`, `text-error`, `border-primary`, `max-w-content`

### Existing Prisma Utilities
- `server/utils/tournament.ts` — `getActiveTournament()` throws 404 if no tournament
- `server/utils/standings.ts` — `recalculatePoolStandings(poolId)` recalculates from all PLAYED matches
- `server/utils/logger.ts` — `logRequest(event, status, message)`
- `server/utils/prisma.ts` — `prisma` singleton

### Existing API Routes
- `GET/PATCH /api/admin/tournament` — get/update tournament settings (type, status, points, timing)
- `GET/POST/PUT/DELETE /api/admin/teams` and `/api/admin/teams/bulk-import`
- `GET/POST/PUT/DELETE /api/admin/fields` and `/api/admin/fields/generate`
- `GET/POST/PUT/DELETE /api/admin/pools` and `/api/admin/pools/generate`
- `GET /api/admin/referees`, `POST /api/admin/referees`, `DELETE /api/admin/referees/:id`
- `POST /api/admin/schedule/generate` — round-robin pool schedule generation
- `GET /api/admin/schedule/matches` — list all matches
- `PATCH /api/admin/schedule/matches/:id` — update match field/time with conflict check
- `GET /api/admin/schedule/conflict-check` — check for scheduling conflicts
- `POST /api/admin/schedule/time-shift` — shift all matches from a time by N minutes
- `GET /api/admin/export` — full JSON export
- `POST /api/admin/import` — full JSON import (password required if data exists)
- `GET /api/ref/matches` — list all matches (for referee dashboard)
- `PATCH /api/ref/matches/:id` — save score; recalculates standings for POOL matches
- `GET /api/public/schedule` — public schedule (empty if DRAFT)
- `GET /api/public/standings` — public standings (empty if DRAFT)
- `POST /api/auth/login`, `POST /api/auth/logout`

### Existing Pages
- `pages/index.vue` — public schedule with filter/status indicators/polling
- `pages/standings.vue` — public standings table
- `pages/login.vue` — login page
- `pages/admin/index.vue` — admin dashboard (with export/import)
- `pages/admin/tournament.vue` — tournament settings + pool management
- `pages/admin/teams.vue`, `pages/admin/fields.vue` — CRUD + bulk import/generate
- `pages/admin/referees.vue` — referee management
- `pages/admin/schedule.vue` — schedule generation + conflict check + time shift
- `pages/ref/index.vue` — referee score entry dashboard

### Key Patterns for Dynamic Routes
- Use `as string` cast for template literal URLs with dynamic segments in `$fetch`
- e.g. `$fetch(\`/api/admin/pools/${id}\` as string, { method: "DELETE" })`

### Standings Calculation
- `recalculatePoolStandings(poolId)` called automatically after POOL match score saved
- Recalculates from scratch using all PLAYED matches in the pool
- Uses tournament's pointsWin/pointsDraw/pointsLoss values

## Tweaks T1.1 / T1.2 / T1.3 — UUID migration, Soft-delete, Tournament uniqueness ✅ DONE

### UUID migration (T1.1)
- All model IDs changed from `Int @id @default(autoincrement())` → `String @id @default(uuid())`
- All FK fields changed from `Int` → `String`
- ID validation in handlers changed from `Number(id); if (isNaN(id))` → `const id = getRouterParam(...); if (!id)` (any non-empty string is valid)
- Invalid ID tests use `mockReturnValue("")` (empty string) rather than `"abc"`
- `BYE` sentinel in round-robin seed changed from `-1` to `""` (empty string constant)
- `auth.d.ts` must have `id: string` in the nuxt-auth-utils `User` interface
- Watch for **directory-based** handlers (`fields/[id].delete.ts`) vs **flat-file** handlers (`fields.[id].delete.ts`) — both must be updated
- `prisma/seed.ts` `ensureAdmin` uses `findFirst({ where: { role: "ADMIN" } }) + create` (no `upsert` with hardcoded id)
- `prisma generate --no-engine` regenerates TypeScript types without DLL (use when DLL is locked by another process)
- `prisma db push --accept-data-loss` applies destructive schema changes when migrate dev cannot run interactively

### Soft-delete (T1.2)
- `isActive Boolean @default(true)` on Tournament model
- `getActiveTournament()` filters `{ isActive: true }` — no other change needed in callers
- Import handler uses `tournament.updateMany({ data: { isActive: false } })` instead of `deleteMany()` before creating new tournament
- Import tests: `mockTournamentUpdateMany` (NOT `mockTournamentDeleteMany`)

### Tournament uniqueness (T1.3)
- `name String @unique` on Tournament model
- Uniqueness enforced at DB level (no additional API handler validation needed for MVP)

## Phase 7 — KO Bracket Generation (NEXT)

### Plan
Per implementation plan:
1. `POST /api/admin/ko-bracket/generate` — reads standings, picks advancing teams, creates KO Match records
   - Seeding: random team from top half vs random from bottom half of qualifiers
   - Only works if pool phase has enough PLAYED matches
   - Returns 409 if KO matches already exist (unless overwrite:true)
2. `PATCH /api/admin/ko-bracket/matches/:id` — admin swap/adjust before publishing
3. Admin page `/pages/admin/ko-bracket.vue` — show bracket, allow swap
4. Auto-advance: after a KO match is scored, generate next-round matches
   - This hooks into the existing `PATCH /api/ref/matches/:id` handler

### Key data model facts
- KO matches: `phase = "KO"`, `poolId = null`, `koWinnerId` for draws
- Pool standings ordered by: points desc → goalDifference desc → goalsFor desc
- `teamsAdvancing` on Pool controls how many teams go through per pool
- Standing model: `poolId`, `teamId`, `points`, `goalDifference`, `goalsFor`

### i18n keys already present
```
admin.schedule.title, generate, etc. — covers schedule
```
Need to add KO bracket specific keys to `i18n/nl.ts`.

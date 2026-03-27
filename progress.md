# Progress

## Completed

- **Phase 0.1 — Git Repository:** GitHub repo created with `.gitignore`, project docs
- **Phase 0.2 — Nuxt 3 Project Scaffolding:** Nuxt 3 initialized, all dependencies installed and configured
  - Nuxt 3 with Composition API (`<script setup>`)
  - Prisma 6 + PostgreSQL schema (all models: User, Tournament, Team, Field, Pool, PoolTeam, Match, Standing)
  - Nuxt Auth Utils for session-based auth (User type augmented with role)
  - Tailwind CSS with design tokens (colors, fonts, spacing, border-radius, max-width)
  - Vitest configured for `server/**/*.test.ts` with Prisma mock
  - ESLint via `@nuxt/eslint`
  - Zod installed for server-side validation
  - Directory structure per ProjectRules
  - i18n/nl.ts with full Dutch text structure
  - Server utilities: createApiError, logRequest, prisma singleton
  - usePolling composable with visibility API support
  - Seed script for admin account
- **Phase 1 — Authentication & Role Management (Epic 7):**
  - Story 7.1 — RBAC: Server middleware guards `/api/admin/*` (ADMIN only) and `/api/ref/*` (ADMIN + REFEREE). 8 unit tests.
  - Story 7.2 — Auth mechanism:
    - `POST /api/auth/login` — unified login for admin (password only) and referee (name + password). 7 unit tests.
    - `POST /api/auth/logout` — clears session. 1 unit test.
    - `GET /api/admin/referees` — list referees (no passwords exposed)
    - `POST /api/admin/referees` — create referee (name + password, duplicate check). 4 unit tests.
    - `DELETE /api/admin/referees/:id` — delete referee. 2 unit tests.
    - `/pages/login.vue` — login page with admin/referee toggle, Tailwind-styled
    - `/composables/useAuth.ts` — login/logout composable with error handling
    - `/scripts/reset-admin-password.ts` — CLI script for SSH password reset
    - `/middleware/auth.ts` — client-side route guard for `/admin` and `/ref` pages
  - Story 7.3 — Universal referee access:
    - `/pages/ref/index.vue` — referee dashboard shell (matches placeholder, logout)
    - `/pages/admin/index.vue` — admin dashboard shell with nav to referee management
    - `/pages/admin/referees.vue` — CRUD page for managing referee accounts
- **Phase 2 — Tournament Configuration (Epic 1):**
  - Story 1.2 — Bulk Import:
    - `POST /api/admin/teams/bulk-import` — accepts `names[]` or `csv`, validates within-list and DB duplicates, bulk creates via createMany. 8 unit tests.
    - `/pages/admin/teams.vue` — updated with textarea (one name per line) and CSV file upload sections
  - Story 1.3 — Field Generation:
    - `POST /api/admin/fields/generate` — generates Veld 1..N, returns 409 if fields exist (unless `overwrite:true`). 8 unit tests.
    - `/pages/admin/fields.vue` — updated with count input and overwrite confirmation UI
  - Story 1.1 — Individual Management:
    - `GET /api/admin/teams` — list teams for active tournament. 2 unit tests.
    - `POST /api/admin/teams` — create team (name required, duplicate check). 3 unit tests.
    - `PUT /api/admin/teams/:id` — rename team (duplicate check). 4 unit tests.
    - `DELETE /api/admin/teams/:id` — delete team. 2 unit tests.
    - `GET /api/admin/fields` — list fields for active tournament. 2 unit tests.
    - `POST /api/admin/fields` — create field (name required, duplicate check). 3 unit tests.
    - `PUT /api/admin/fields/:id` — rename field (duplicate check). 4 unit tests.
    - `DELETE /api/admin/fields/:id` — delete field. 2 unit tests.
    - `/pages/admin/teams.vue` — CRUD page with inline edit and delete confirmation
    - `/pages/admin/fields.vue` — CRUD page with inline edit and delete confirmation
    - Admin dashboard updated with Teams and Fields navigation cards
    - `server/utils/tournament.ts` — shared getActiveTournament utility

- **Phase 3 — Tournament Structure & Format (Epic 5):** Done
  - Story 5.1: Competition type selector, pool generation/management (92 tests total)
  - Story 5.2: Match score entry API and ref dashboard

- **Phase 4 — Assisted Schedule Management (Epic 2):** Done
  - Story 2.3: Status toggle PATCH (3 tests); Story 2.1: schedule generation (8 tests)
  - Story 2.2: conflict check + match PATCH (10 tests); Story 2.4: time shift (6 tests)
  - 119 tests total, all passing

- **Phase 5 — Results & Standings (Epic 4):** Done
  - Stories 4.1/4.2/4.3: Score entry already done in Story 5.2; standings utility added
  - server/utils/standings.ts: recalculatePoolStandings (5 tests)
  - Score corrections work automatically via full recalculation
  - 124 tests total, all passing

- **Phase 6 — Participants View (Epic 3):** Done
  - Stories 3.1-3.4: Public schedule with filter, status indicators, polling; standings page
  - GET /api/public/schedule and GET /api/public/standings
  - 131 tests total

- **Phase 8 — Data Integrity & Backup (Epic 6):** Done
  - Story 6.1: GET /api/admin/export returns full JSON dump (3 tests)
  - Story 6.2: POST /api/admin/import restores from JSON, requires password when data exists (6 tests)
  - 140 tests total

## Current Task

Phase 7 — KO Bracket Generation (extends Epic 5)

## Blockers

- Phase 0.3 (DigitalOcean Droplet Setup) is manual infrastructure work — not blocking code development
- Phase 0.4 requires a running PostgreSQL instance to run `npx prisma migrate dev`

## Session Log

| Iteration | Task                              | Status | Notes                                                |
| --------- | --------------------------------- | ------ | ---------------------------------------------------- |
| 0         | Phase 0.2 — Nuxt 3 Scaffolding    | Done   | All deps installed, lint/typecheck/vitest pass       |
| 1         | Phase 1 — Auth & Roles (Epic 7)   | Done   | 23 tests pass, lint clean, typecheck clean           |
| 2         | Story 1.1 — Individual Management | Done   | 22 new tests (45 total), lint clean, typecheck clean |
| 3         | Stories 1.2 & 1.3 — Bulk Import + Field Generation | Done   | 16 new tests (61 total), lint clean, typecheck clean |
| 4         | Phase 3 — Epic 5 Stories 5.1 & 5.2                 | Done   | Epic 5 merged into develop; 92 tests pass            |
| 5         | Phase 4 — Epic 2 Stories 2.3, 2.1, 2.2, 2.4        | Done   | Epic 2 merged into develop; 119 tests pass           |
| 6         | Phase 5 — Epic 4 Stories 4.1, 4.2, 4.3             | Done   | Standings utility added; 124 tests pass              |
| 7         | Phase 6 — Epic 3 Stories 3.1-3.4                   | Done   | Public schedule/standings pages; 131 tests pass      |
| 8         | Phase 8 — Epic 6 Stories 6.1 & 6.2                 | Done   | JSON export/import with password; 140 tests pass     |

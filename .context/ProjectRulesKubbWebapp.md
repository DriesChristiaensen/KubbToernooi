# Project Rules — Kubb Tournament WebApp

This document defines the conventions, standards, and guidelines that apply to every feature implemented in this project. All contributors (including AI assistants) must follow these rules.

---

## 1. Code Style & Conventions

### Naming
- Follow the conventions of the language and framework at all times:
  - **Vue components:** `PascalCase` (e.g. `MatchCard.vue`, `ScoreInput.vue`).
  - **Composables:** `camelCase` with `use` prefix (e.g. `usePolling.ts`, `useAuth.ts`).
  - **Files and directories:** `kebab-case` for pages and directories (e.g. `/pages/admin/team-management.vue`).
  - **Variables and functions:** `camelCase`.
  - **Database models (Prisma):** `PascalCase` singular (e.g. `Team`, `Match`, `Standing`).
  - **Database columns (Prisma):** `camelCase`.
  - **API routes:** `kebab-case` (e.g. `/api/admin/bulk-import`).
  - **CSS classes:** Tailwind utilities only; custom classes in `kebab-case` when unavoidable.
  - **Constants:** `UPPER_SNAKE_CASE`.

### Vue / Nuxt Style
- Use Composition API with `<script setup>` exclusively.
- Single File Components (`.vue`) with the order: `<script setup>`, `<template>`, `<style>`.

### Comments
- **No comments** when function names, variable names, and component names are self-explanatory.
- **One sentence maximum** for complex logic that is not obvious from the code itself.
- No JSDoc blocks, no commented-out code, no TODO comments left in committed code.

---

## 2. Styling & UI

### Framework
- **Tailwind CSS** is the only styling approach. No plain CSS files, no SCSS, no component libraries.
- Avoid `@apply` unless consolidating a pattern used in 3+ places.

### Design Tokens (Global Configuration)
All visual identity values must be defined in a single global configuration file (`tailwind.config.ts` via `theme.extend`) so the entire look-and-feel can be changed from one place:
- **Colors:** primary, secondary, accent, success, warning, error, background, surface, text shades.
- **Fonts:** font family, fallback stack.
- **Font sizes:** all custom sizes beyond Tailwind defaults.
- **Spacing & gaps:** consistent spacing scale for padding, margin, and gaps.
- **Border radius:** default rounding values.

No hardcoded color hex values, font sizes, or spacing values in templates — always reference the Tailwind config tokens.

### Responsive Design
- **Mobile-first** approach: base styles target smartphones.
- **One breakpoint** (`md` — 768px) separating mobile from desktop.
- Desktop layout is optimized for **medium-sized laptops** (~1366px wide).
- Beyond large laptop widths, the content area has a **max-width with centered whitespace** on wider screens. No full-bleed layouts on ultrawide monitors.

---

## 3. API Design

### Route Structure
Routes are namespaced by role:

| Prefix | Access | Purpose |
|---|---|---|
| `/api/public/*` | Everyone | Schedule, standings, match status |
| `/api/ref/*` | Referee + Admin | Score entry, match list |
| `/api/admin/*` | Admin only | Configuration, teams, fields, schedule management, user management, export/import |

### Request Origin
- API routes must **only accept requests from localhost**. Nginx handles external traffic and proxies it to the Nuxt server on `127.0.0.1:3000`. Direct external access to port 3000 is blocked by the firewall.

### Error Response Format
Every API error response must follow this exact structure:

```json
{
  "error": "Nederlandstalige gebruikerstekst",
  "code": 400,
  "reason": "Technical cause in English",
  "stacktrace": {}
}
```

- `error` — A human-readable message **in Dutch** suitable for display to the user.
- `code` — HTTP status code (400, 401, 403, 404, 409, 500, etc.).
- `reason` — A short technical description in English for debugging.
- `stacktrace` — The raw error object. **Only included in development mode.** Stripped in production.

### Request Methods
- `GET` — Read data (never mutates state).
- `POST` — Create new resources.
- `PUT` — Full update of an existing resource.
- `PATCH` — Partial update (e.g. score entry, status toggle).
- `DELETE` — Remove a resource.

---

## 4. Validation

### Approach
- **Server-side validation only.** No client-side validation logic beyond basic HTML input attributes (e.g. `type="number"`, `required`).
- Validation must be simple and practical — not overly strict. Participants cannot submit any data; only admin and referees interact with forms.
- Use **Zod** for schema validation on API routes where input parsing is needed. Keep schemas simple.

### Validation Scope
- Validate required fields, data types, and reasonable bounds (e.g. score ≥ 0, team name not empty).
- Validate business rules server-side (e.g. no duplicate team names, no schedule conflicts).
- Do not over-engineer validation for edge cases that are unlikely in a single-day tournament context.

---

## 5. State Management

- **No Pinia.** Use local component state (`ref`, `reactive`, `computed`) and composables for shared logic.
- Data fetched from the API lives in the component that needs it or in a composable if shared across pages.
- No global store pattern.

---

## 6. Git Workflow

### Branching
- `main` branch = production. Always deployable.
- Feature branches per story: `feature/1.1-team-management`, `feature/2.4-time-shift`, etc.
- Merge feature branches into `main` when complete and tested.
- Single developer — no pull requests, no reviews. Direct merge after local verification.

### Commit Messages
Follow **Conventional Commits**:

```
feat(teams): add bulk import via text field
fix(schedule): resolve double-booking in conflict check
refactor(auth): simplify session middleware
test(standings): add unit tests for ranking calculation
chore(prisma): update schema with ko_winner field
```

Format: `type(scope): short description in lowercase`

Allowed types: `feat`, `fix`, `refactor`, `test`, `chore`, `docs`, `style`.

---

## 7. Error Handling & Logging

### Server-Side Logging
- **Log all non-GET requests** (POST, PUT, PATCH, DELETE) — timestamp, route, user role, and outcome (success/failure).
- **Log all errors** — full error object with stack trace to server console/log file.
- GET requests are not logged unless they result in an error.

### User-Facing Errors
- On unrecoverable errors (404, 500), show a simple Dutch message and offer a link/redirect back to the homepage.
- No detailed error pages needed. A clean, minimal message suffices.

---

## 8. Security

### Authentication
- Session-based auth via Nuxt Auth Utils.
- Passwords hashed with bcrypt.
- Sessions expire after ~12 hours.
- Rate limiting on `/api/admin/login` and `/api/ref/login` to prevent brute-force attacks.

### Network
- Nginx is the only entry point for external traffic (ports 80/443).
- Nuxt listens on `127.0.0.1:3000` — not exposed externally.
- API routes only accept requests originating from localhost (enforced by Nginx proxy setup and firewall).
- PostgreSQL accepts only local connections (no TCP over network).

### Input
- All user input is validated server-side before database interaction.
- Prisma's parameterized queries prevent SQL injection by default.
- Sanitize any user-provided strings rendered in HTML to prevent XSS.

---

## 9. Internationalization (i18n)

- The UI is **Dutch only**. No multi-language support needed.
- All user-facing text strings must be stored in a **centralized i18n file** (e.g. `/i18n/nl.ts` or a JSON equivalent), not hardcoded in templates.
- This keeps templates clean and makes text changes manageable from one location.
- Keys should be organized by feature area (e.g. `admin.teams.addButton`, `public.schedule.liveLabel`).

---

## 10. Testing

### Methodology
- **Test-Driven Development (TDD):** Write tests before implementing the feature logic. The cycle is: write a failing test → implement the minimum code to pass → refactor.

### Test Level
- **Unit tests on API logic** — this is the highest and only required test level.
- Test all Nitro API route handlers: input validation, business logic, error responses.
- Focus on critical business logic: schedule conflict detection, standings calculation, KO bracket seeding, time shift recalculation, score validation per phase.
- No end-to-end tests, no component tests, no snapshot tests.

### Test Framework
- Use **Vitest** (native Nuxt 3 / Vite integration).
- Test files live next to the code they test (e.g. `/server/api/admin/teams.post.test.ts`).

---

## 11. Polling

### Configuration
- Public pages poll the API every **60 seconds** for updated data.
- Polling **pauses when the browser tab is not active** (use `document.visibilityState` or the Page Visibility API).
- Polling **resumes immediately when the tab becomes active again**, with an instant fetch before restarting the interval.
- Polling logic is centralized in a `usePolling` composable to avoid duplication.

---

## 12. Database

### Prisma Conventions
- Models in `PascalCase`, fields in `camelCase`.
- Use `@default` values where sensible (e.g. `status` defaults to `SCHEDULED`, point values default to `3/1/0`).
- Use enums for fixed value sets (`Role`, `TournamentStatus`, `MatchStatus`, `MatchPhase`).
- Every model has `createdAt` and `updatedAt` timestamps.

### Migrations
- Run `npx prisma migrate dev --name descriptive-name` during development.
- Run `npx prisma migrate deploy` on the droplet (production).
- Never edit migration files after they have been committed.

### Timezone
- All timestamps are stored and processed in **Europe/Brussels** timezone.
- The server's system timezone should be set to `Europe/Brussels`.
- No timezone conversion logic in the application — everything assumes Belgian time.

---

## 13. File & Directory Conventions

```
kubb-toernooi/
├── components/          → Reusable Vue components
│   ├── admin/           → Admin-specific components
│   ├── ref/             → Referee-specific components
│   └── public/          → Participant-facing components
├── composables/         → Shared logic (useAuth, usePolling, etc.)
├── i18n/                → Dutch text strings (nl.ts)
├── pages/               → File-based routing
│   ├── index.vue        → Public schedule
│   ├── standings.vue    → Public standings
│   ├── login.vue        → Login page
│   ├── admin/           → Admin pages
│   └── ref/             → Referee pages
├── server/
│   ├── api/
│   │   ├── public/      → Public endpoints
│   │   ├── ref/         → Referee endpoints
│   │   └── admin/       → Admin endpoints
│   ├── middleware/       → Auth middleware
│   └── utils/           → Server helpers
├── prisma/
│   ├── schema.prisma    → Database schema
│   ├── migrations/      → Migration history
│   └── seed.ts          → Seed script
├── tailwind.config.ts   → Design tokens
├── nuxt.config.ts       → Nuxt configuration
└── vitest.config.ts     → Test configuration
```

---

## Summary Checklist (per feature)

Before considering any feature complete, verify:

- [ ] Naming follows framework/language conventions.
- [ ] No unnecessary comments — code is self-documenting.
- [ ] Styling uses only Tailwind classes referencing design tokens.
- [ ] Responsive: works on mobile and medium laptop, max-width on wider screens.
- [ ] API route is under the correct role prefix (`/api/public|ref|admin/`).
- [ ] API errors follow the standard response format (error, code, reason, stacktrace).
- [ ] Server-side validation is in place for all inputs.
- [ ] All user-facing text comes from the i18n file, not hardcoded.
- [ ] Unit tests were written first (TDD) and pass.
- [ ] Non-GET requests and errors are logged.
- [ ] Commit message follows Conventional Commits format.

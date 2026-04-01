# Acceptance Criteria — All Code & Functionalities

This document defines the baseline quality standards for **every commit** to the Kubb Tournament WebApp. Use this as a checklist before marking work as done.

---

## 1. Code Documentation & Comments

### 1.1 Comments
- ✅ Comments only when logic is **non-obvious** (not on every line).
- ✅ Comments are **one sentence maximum**, explaining the **why**, not the what.
- ✅ No commented-out code — delete or use version control.
- ✅ No TODO/FIXME comments without context or ownership.

### 1.2 JSDoc/Type Documentation
- ✅ **API routes:** Document parameters, return type, and errors:
  ```ts
  /**
   * Fetch tournament teams.
   * @param tournamentId — The tournament ID (UUID)
   * @returns Array of Team objects, or error if tournament not found
   */
  ```
- ✅ **Complex composables:** Document purpose and reactive state.
- ✅ **Utility functions:** Document parameters, return type, side effects.
- ✅ **No JSDoc for simple getters/setters** — type signature is sufficient.

### 1.3 README & Setup Docs
- ✅ Project README is current (if one exists).
- ✅ Non-obvious dependencies are documented.
- ✅ Local setup instructions work end-to-end.

---

## 2. Naming Conventions

### 2.1 Variables & Functions
- ✅ **camelCase** for variables, functions, and methods.
- ✅ **UPPERCASE_SNAKE_CASE** for constants (e.g., `MAX_TEAMS`, `API_TIMEOUT_MS`).
- ✅ **Boolean variables** start with `is`, `has`, `can`, `should`:
  ```ts
  const isActive = true;
  const hasTeams = teams.length > 0;
  ```
- ✅ **Avoid single-letter variables** except in tight loops (`for (let i = 0; ...)`).
- ✅ **Avoid abbreviations** (use `tournament` not `trn`, `referee` not `ref` in most contexts).

### 2.2 Components & Files
- ✅ **Vue components:** `PascalCase` file names (e.g., `TournamentCard.vue`).
- ✅ **Composables:** `camelCase` with `use` prefix (e.g., `usePolling.ts`).
- ✅ **Utils/helpers:** `camelCase`, descriptive (e.g., `formatDate.ts`, not `utils.ts`).
- ✅ **API routes:** Lowercase kebab-case matching REST paths (e.g., `admin/tournament.post.ts`).

### 2.3 Database & Types
- ✅ **Prisma models:** `PascalCase` singular (e.g., `Tournament`, not `Tournaments`).
- ✅ **Enum names:** `PascalCase` (e.g., `MatchStatus`).
- ✅ **Enum values:** `UPPERCASE_SNAKE_CASE` (e.g., `MatchStatus.NOT_STARTED`).
- ✅ **Foreign keys:** Plural with `Id` suffix (e.g., `teamIds: string[]`).

### 2.4 API & Routes
- ✅ **Route parameters:** UUIDs in path, not sequential IDs.
- ✅ **Request/response DTOs:** Explicit interface (e.g., `CreateTournamentRequest`).
- ✅ **Error codes:** Lowercase snake_case (e.g., `tournament_not_found`).

---

## 3. Code Style & Formatting

### 3.1 Linting & Format
- ✅ `npm run lint` passes with **zero errors** (warnings allowed, but fix them).
- ✅ `npm run typecheck` passes with **zero errors**.
- ✅ Code follows ESLint config (auto-format with editor integration if available).
- ✅ Line length reasonable (~100 chars, no hard rule, but avoid 200+ char lines).

### 3.2 Imports & Organization
- ✅ Imports grouped in this order:
  1. External libraries (e.g., `vue`, `zod`)
  2. Internal modules (e.g., `~/composables`, `~/utils`)
  3. Relative imports (e.g., `./sibling.ts`)
  4. Type imports use `import type` (not mixed with values).
- ✅ **No unused imports** (linter catches this).
- ✅ **No circular dependencies** (check during code review).

### 3.3 Indentation & Spacing
- ✅ 2 spaces for indentation (configured in `.editorconfig`).
- ✅ 1 blank line between logical blocks (functions, classes, etc.).
- ✅ 2 blank lines between top-level declarations (rare; usually 1).
- ✅ No trailing whitespace.

---

## 4. Type Safety & TypeScript

### 4.1 Type Annotations
- ✅ **All parameters and returns** have explicit types (no `any`).
- ✅ **No implicit `any`** — use `unknown` if type is truly unknown, then narrow.
- ✅ **Function signatures are explicit:**
  ```ts
  function getTournament(id: string): Promise<Tournament | null> {
    // ...
  }
  ```
- ✅ **Generic types are constrained:**
  ```ts
  function filter<T extends { id: string }>(items: T[], predicate: (item: T) => boolean): T[] {
    // ...
  }
  ```

### 4.2 Strict Mode
- ✅ `tsconfig.json` has `strict: true`.
- ✅ `strictNullChecks` enforced — all nullable values are explicit.
- ✅ No non-null assertions (`!`) unless absolutely justified with a comment.

### 4.3 Type Correctness
- ✅ **Union types** used instead of broad types:
  ```ts
  type MatchStatus = "not_started" | "in_progress" | "finished";
  ```
- ✅ **Discriminated unions** for complex shapes (not optional fields everywhere).
- ✅ **Branded types** for unique identifiers (optional but recommended):
  ```ts
  type TournamentId = string & { readonly __brand: "TournamentId" };
  ```

---

## 5. Input Validation & Error Handling

### 5.1 API Input Validation
- ✅ **Every API route validates input** using Zod schema:
  ```ts
  const schema = z.object({
    name: z.string().min(1),
    teamCount: z.number().int().positive(),
  });
  const body = schema.parse(request.body);
  ```
- ✅ **Validation errors return 400** with clear message.
- ✅ **No raw `request.body`** — always parsed and validated.

### 5.2 Error Responses
- ✅ **All API errors use standard format:**
  ```ts
  {
    error: "Tournament niet gevonden",  // Dutch user message
    code: "tournament_not_found",        // English code for frontend
    reason: "No tournament exists in database",  // English technical reason
    stacktrace?: "..." // dev only
  }
  ```
- ✅ **Error codes are consistent** across all routes.
- ✅ **No generic "Something went wrong"** — always specific error message.

### 5.3 Frontend Input Validation
- ✅ **Form inputs** are validated before submission.
- ✅ **User feedback** on validation errors (inline or toast).
- ✅ **No silent failures** — if a mutation fails, the user is informed.

### 5.4 Null & Undefined Safety
- ✅ **Null checks before accessing properties:**
  ```ts
  if (tournament && tournament.teams) {
    // use tournament.teams
  }
  ```
- ✅ **Optional chaining** used where appropriate:
  ```ts
  const teamCount = tournament?.teams?.length ?? 0;
  ```
- ✅ **No assumptions** that data exists after async calls — always check.

---

## 6. Testing & Verification

### 6.1 Unit Tests
- ✅ **API routes have tests** covering:
  - ✅ Happy path (valid input → correct output)
  - ✅ Error cases (invalid input, missing data, auth failures)
  - ✅ Edge cases (empty arrays, zero values, boundary conditions)
- ✅ **Tests are deterministic** (no flaky timing dependencies).
- ✅ **Test data is isolated** (no shared state between tests).
- ✅ **Tests run in CI** — `npx vitest run` passes.

### 6.2 Test Coverage
- ✅ **API handlers:** Minimum 80% line coverage.
- ✅ **Complex business logic:** 100% coverage.
- ✅ **Simple getters/setters:** Coverage > 0% (at least used once).
- ✅ **Coverage gaps documented** if intentional.

### 6.3 Integration Tests (if applicable)
- ✅ **Database tests** use real or in-memory database (not mocks).
- ✅ **Tests clean up after themselves** (no data leakage between runs).

### 6.4 Pre-Commit Verification
- ✅ Before committing:
  ```bash
  npx vitest run    # All tests pass
  npm run lint      # Zero errors
  npm run typecheck # Zero errors
  ```
- ✅ **No commits with failing tests.**
- ✅ **No commented-out tests** — delete or fix.

---

## 7. UI/UX Standards

### 7.1 User-Facing Text
- ✅ **All text in Dutch** from `/i18n/nl.ts` (no hardcoded strings).
- ✅ **Consistent terminology** across app (e.g., always "Poule", never "Pool").
- ✅ **Button labels are action verbs** (e.g., "Team toevoegen", not "Actie").
- ✅ **Error messages are user-friendly** and actionable.

### 7.2 Styling
- ✅ **Only Tailwind CSS** (no plain CSS, SCSS, or component libraries).
- ✅ **Design tokens used consistently** (colors from `tailwind.config.ts`).
- ✅ **Responsive design** tested on mobile, tablet, desktop.
- ✅ **No magic numbers** for spacing/sizing — use Tailwind scale (`p-4`, `w-1/2`, etc.).

### 7.3 Accessibility
- ✅ **Semantic HTML** (`<button>`, `<a>`, `<form>`, not `<div>` for clickables).
- ✅ **Alt text on images** (or decorative images marked `role="presentation"`).
- ✅ **Form labels** associated with inputs (`<label for="id">`).
- ✅ **Color contrast** meets WCAG AA standard (not color-only cues).
- ✅ **Keyboard navigation** works (Tab, Enter, Escape where applicable).
- ✅ **ARIA labels** for icons and dynamic content (if needed).

### 7.4 Forms & UX Flow
- ✅ **Form validation** happens client-side AND server-side.
- ✅ **Submission feedback** (loading state, success/error toast).
- ✅ **Required fields** are marked visually and in HTML (`required` attribute).
- ✅ **Error messages display near the field** that failed.
- ✅ **No data loss on validation error** (form values preserved).

### 7.5 Mobile UX
- ✅ **Mobile breakpoints** tested (sm, md, lg per Tailwind).
- ✅ **Touch targets** at least 44×44px (WCAG mobile standard).
- ✅ **Hamburger menu** implemented for mobile nav (per T3.2).
- ✅ **Bottom padding** on mobile pages to avoid hamburger overlap.

---

## 8. Database & Data Consistency

### 8.1 Schema & Constraints
- ✅ **Primary keys are UUIDs** (no sequential integers, per T1.1).
- ✅ **Foreign key constraints** enforced in Prisma:
  ```prisma
  model Team {
    id        String @id @default(uuid())
    tournament Tournament @relation(fields: [tournamentId], references: [id])
    tournamentId String
  }
  ```
- ✅ **NOT NULL constraints** on required fields.
- ✅ **Unique constraints** where applicable (e.g., tournament name per T1.3).
- ✅ **Indexes** on frequently queried columns (`tournamentId`, `userId`, etc.).

### 8.2 Migrations
- ✅ **Schema changes use Prisma migrations** (`npx prisma migrate dev`).
- ✅ **Migrations are reversible** (production uses `migrate deploy`).
- ✅ **Migration names are descriptive** (e.g., `add_tournament_name_field`).
- ✅ **Data migrations tested locally** before deploy.

### 8.3 Data Validation in Code
- ✅ **Business logic matches database constraints:**
  - If DB says `teamCount > 0`, code never tries to create tournament with 0 teams.
  - If DB says email is unique, code checks uniqueness before INSERT.
- ✅ **No data can reach a state** that violates the schema.
- ✅ **Soft-deletes** respect the `isActive` flag (queries filter accordingly, per T1.2).

### 8.4 Cascading & Cleanup
- ✅ **Cascading deletes configured** where appropriate (or explicitly forbidden).
- ✅ **Foreign key orphans prevented** (can't delete parent if children exist, or children are deleted).
- ✅ **Cleanup logic is tested** (delete tournament → teams/matches also deleted or soft-deleted).

---

## 9. API Design & REST Conventions

### 9.1 HTTP Methods & Status Codes
- ✅ **GET** — retrieve data (200, 404).
- ✅ **POST** — create resource (201 or 200, 400, 401, 409).
- ✅ **PATCH** — partial update (200, 400, 404).
- ✅ **DELETE** — delete resource (204 or 200, 404).
- ✅ **PUT** — full replace (rare; use POST or PATCH instead).
- ✅ **Status codes correct** (not always 200).

### 9.2 Request/Response Structure
- ✅ **Request body** is JSON with clear field names.
- ✅ **Response body** is either:
  - Success: `{ data: {...} }` or the resource directly
  - Error: `{ error, code, reason }` (per 5.2)
- ✅ **Array responses** are wrapped: `{ data: [...] }` or paginated.
- ✅ **Pagination includes** `total`, `page`, `limit` (if applicable).

### 9.3 Route Organization
- ✅ **Routes organized by domain:**
  - `/api/public/*` — public data endpoints
  - `/api/ref/*` — referee-only endpoints
  - `/api/admin/*` — admin-only endpoints
- ✅ **Resource-oriented URLs** (e.g., `/api/admin/teams/[id]`, not `/api/admin/getTeamById`).
- ✅ **No query strings for filtering** (use request body for complex filters).

---

## 10. Security

### 10.1 Authentication & Authorization
- ✅ **Session-based auth** with Nuxt Auth Utils.
- ✅ **Role-based checks** on every protected route:
  ```ts
  const { user } = await requireAuth();
  if (user.role !== "admin") {
    return sendError(createError({ statusCode: 401 }));
  }
  ```
- ✅ **No direct role checks in frontend** (always validate server-side).
- ✅ **Password hashing** with bcrypt (never store plaintext).

### 10.2 Input Sanitization
- ✅ **SQL injection prevention:** Prisma parameterized queries (not raw SQL).
- ✅ **XSS prevention:** No `v-html` with user input (use `{{ }}` instead).
- ✅ **CSRF protection:** Handled by Nuxt (no manual tokens needed).

### 10.3 Sensitive Data
- ✅ **Passwords not in logs** or error messages.
- ✅ **API keys/secrets** in environment variables (`.env.local`, never committed).
- ✅ **Database passwords** never in code.
- ✅ **PII minimized** — only collect what's needed.

### 10.4 HTTPS & Transport
- ✅ **Local dev on HTTP** is fine (127.0.0.1).
- ✅ **Production enforces HTTPS** (reverse proxy/Nginx).
- ✅ **Cookies have Secure flag** in production.

---

## 11. Performance

### 11.1 Database Queries
- ✅ **Queries are efficient** (indexed lookups, not full table scans).
- ✅ **N+1 query problem avoided** (use Prisma relations, not separate queries).
- ✅ **Pagination used** for large result sets.
- ✅ **Query performance monitored** (especially on `/api/public`).

### 11.2 Frontend Performance
- ✅ **Components lazy-loaded** if they're heavy.
- ✅ **Images optimized** (use `<NuxtImg>` or webp).
- ✅ **Bundle size monitored** (no bloat).
- ✅ **Polling interval** is 60s (per CLAUDE.md, not more frequent).

### 11.3 API Response Times
- ✅ **API routes respond in < 500ms** (except heavy operations).
- ✅ **No synchronous heavy operations** in request handlers (use jobs if needed).

---

## 12. Code Review Checklist

Before every commit, verify:

- [ ] **Tests pass:** `npx vitest run`
- [ ] **Lint passes:** `npm run lint`
- [ ] **Types pass:** `npm run typecheck`
- [ ] **Naming consistent** with conventions (Section 2)
- [ ] **Error handling complete** (Section 5)
- [ ] **No hardcoded Dutch strings** (all in i18n)
- [ ] **API routes validated** with Zod
- [ ] **Database constraints match code logic**
- [ ] **Accessibility considered** (Section 7.3)
- [ ] **Responsive design tested** (mobile/tablet/desktop)
- [ ] **Security checks passed** (Section 10)
- [ ] **No commented-out code**
- [ ] **No TODO/FIXME comments** without context
- [ ] **No `any` types** (use `unknown` + narrowing)
- [ ] **No non-null assertions** without comment

---

---

# TOP 10 BAD HABITS & CODE FLAWS — Extra Wary

These patterns are **easy to miss, hard to debug**, and cause cascading failures. Watch for them ruthlessly.

---

## #1 — Unvalidated API Input (Silent Data Corruption)

**The Problem:**
```ts
// WRONG ❌
export default defineEventHandler(async (event) => {
  const { name, count } = await readBody(event);
  // If count is negative, NaN, or string, code breaks unpredictably
  const tournament = await db.tournament.create({ data: { name, count } });
  return tournament;
});
```

**Why It's Hard to Debug:**
- Invalid data may be saved, then fail in unexpected places later.
- Frontend error happens at time of use, not at time of bad save.
- Debugger shows a valid-looking tournament with `count: "abc"`.

**The Fix:**
```ts
// CORRECT ✅
const schema = z.object({
  name: z.string().min(1).max(100),
  count: z.number().int().positive(),
});

const body = schema.parse(await readBody(event));
const tournament = await db.tournament.create({ data: body });
```

**Watch for:** POST/PATCH routes without Zod validation, direct `request.body` usage, trusting frontend types in backend.

---

## #2 — Missing Null Checks (NullPointerException Style)

**The Problem:**
```ts
// WRONG ❌
const teams = tournament.teams; // What if tournament is null?
const firstTeam = teams[0];     // What if teams is empty?
const name = firstTeam.name;    // What if firstTeam is undefined?
```

**Why It's Hard to Debug:**
- Crash happens on one line, but root cause is three lines up.
- Works fine in happy path, fails on edge case (empty tournaments, null relations).
- TypeScript error only if `strict: true` and types are correct (which they often aren't).

**The Fix:**
```ts
// CORRECT ✅
const tournament = await getTournament(id);
if (!tournament) return null;

const firstTeam = tournament.teams?.[0];
if (!firstTeam) return null;

const name = firstTeam.name;
```

**Watch for:** Accessing `.length`, `.[index]`, or `.prop` without null/undefined check. Direct relation access without await.

---

## #3 — Hardcoded Strings Instead of i18n (Silent Locale Breaks)

**The Problem:**
```ts
// WRONG ❌
const message = tournament.isActive ? "Tournament is live" : "Tournament is draft";
// Now you need to translate, but the string is scattered in 5 places
// Someone changes it to "Tournament is active" and the other places don't match
```

**Why It's Hard to Debug:**
- Works fine in dev (you speak English).
- Translations get out of sync.
- Search/replace is error-prone (changes right place, breaks wrong one).
- Users see English on Dutch app.

**The Fix:**
```ts
// CORRECT ✅
// in /i18n/nl.ts
export const nl = {
  tournament: {
    statusLive: "Toernooi is live",
    statusDraft: "Toernooi concept nog niet gepubliceerd",
  },
};

// in component
const message = tournament.isActive ? nl.tournament.statusLive : nl.tournament.statusDraft;
```

**Watch for:** Any string in templates/code that would appear to users. Especially error messages, labels, status text.

---

## #4 — Mixing Validation Logic with Business Logic (Unmaintainable Code)

**The Problem:**
```ts
// WRONG ❌
export async function createTournament(data: any) {
  // Validation buried in business logic
  if (!data.name || data.name.length < 1) throw new Error("Invalid name");
  if (data.count < 1 || data.count > 100) throw new Error("Invalid count");
  if (typeof data.startTime !== "string") throw new Error("Invalid time");

  // Business logic
  const existing = await db.tournament.findFirst();
  if (existing) {
    existing.isActive = false;
    await db.tournament.update({ where: { id: existing.id }, data: existing });
  }

  const tournament = await db.tournament.create({ data });
  return tournament;
}

// In API route:
try {
  const result = await createTournament(body);
} catch (e) {
  // Which error? Validation or DB?
}
```

**Why It's Hard to Debug:**
- Error handling is unclear (validation error vs. business error).
- Validation rules live in multiple places (frontend, route, function).
- Hard to reuse — if another route calls `createTournament`, it might not validate the same way.
- Changes to one break the other.

**The Fix:**
```ts
// CORRECT ✅
// 1. Validation layer (Zod schema)
const createTournamentSchema = z.object({
  name: z.string().min(1).max(100),
  count: z.number().int().positive().max(100),
  startTime: z.string().datetime(),
});

// 2. Business logic (no validation)
async function createTournament(data: z.infer<typeof createTournamentSchema>) {
  const existing = await db.tournament.findFirst();
  if (existing) {
    await db.tournament.update({
      where: { id: existing.id },
      data: { isActive: false },
    });
  }
  return db.tournament.create({ data });
}

// 3. Route (separate validation)
export default defineEventHandler(async (event) => {
  const body = createTournamentSchema.parse(await readBody(event));
  const result = await createTournament(body);
  return { data: result };
});
```

**Watch for:** Validation inside domain functions, error handling that can't distinguish validation from business errors, duplicate validation logic.

---

## #5 — Race Conditions in Async Code (Intermittent Failures)

**The Problem:**
```ts
// WRONG ❌
const tournament = ref(null);

onMounted(async () => {
  tournament.value = await fetchTournament();
  // Component unmounted before fetch completes, now setting state on unmounted component
});

const handleUpdate = async () => {
  const current = tournament.value;
  // What if another request changed it?
  current.name = "New Name";
  await updateTournament(current);
  // Race: if two updates happen, one overwrites the other silently
};
```

**Why It's Hard to Debug:**
- Only happens under specific timing (user clicks quickly, network is slow).
- Works fine in tests (they run serially).
- Works fine in fast networks.
- Fails in production with real latency.
- Data silently gets overwritten — you don't see an error, just wrong state.

**The Fix:**
```ts
// CORRECT ✅
const tournament = ref(null);
const isLoading = ref(false);

onMounted(async () => {
  isLoading.value = true;
  try {
    tournament.value = await fetchTournament();
  } finally {
    isLoading.value = false;
  }
});

// Option 1: Prevent double-clicks
const isUpdating = ref(false);
const handleUpdate = async () => {
  if (isUpdating.value) return; // Guard
  isUpdating.value = true;

  try {
    const result = await updateTournament(tournament.value.id, {
      name: "New Name",
    });
    tournament.value = result; // Update with server response
  } finally {
    isUpdating.value = false;
  }
};

// Option 2: Optimistic updates with rollback
const handleUpdate = async () => {
  const previous = { ...tournament.value };
  tournament.value.name = "New Name";

  try {
    const result = await updateTournament(tournament.value.id, {
      name: "New Name",
    });
    tournament.value = result;
  } catch (e) {
    tournament.value = previous; // Rollback on error
    throw e;
  }
};
```

**Watch for:** Multiple async calls that share state, missing loading/disabled states, updates that don't confirm server response, no guards against double-submit.

---

## #6 — Database Constraints Not Matching Code Logic (Corrupted State)

**The Problem:**
```ts
// In code:
if (!tournament.isActive) {
  // Don't show matches
}

// In database: NO constraint on isActive + teams relationship
// What if admin:
// 1. Deactivates tournament (isActive = false)
// 2. But teams are still there, matches still reference the tournament
// Now: code thinks tournament is inactive, but matches exist and are referenced
// Subsequent queries get confused: is this tournament active or not?

// Worse: if code tries to delete deactivated tournament, it cascades wrong
```

**Why It's Hard to Debug:**
- Database allows invalid state (soft-deleted tournament with active matches).
- Tests pass because they start fresh (no stale data).
- Production has old data that violates the assumption.
- Bug manifests weeks later in weird ways (orphaned matches, standings don't refresh).

**The Fix:**
```prisma
// CORRECT ✅
model Tournament {
  id        String @id @default(uuid())
  name      String @unique
  isActive  Boolean @default(true)
  teams     Team[]
  matches   Match[]
  // Add CHECK constraint (if DB supports) or enforce in code:
  // CHECK (isActive = true OR (SELECT COUNT(*) FROM matches WHERE tournamentId = id) = 0)
}

// In code, enforce the contract:
async function deactivateTournament(tournamentId: string) {
  // Either:
  // A) Keep all data (soft-delete): just set isActive = false
  // B) Or delete everything: hard-delete teams, matches, etc.
  // But DON'T do both — decide once

  await db.tournament.update({
    where: { id: tournamentId },
    data: { isActive: false },
  });

  // Subsequent queries ALWAYS filter:
  const active = await db.tournament.findFirst({
    where: { isActive: true },
  });
}
```

**Watch for:** Code logic that depends on DB state, but DB has no constraints. Soft-deletes that don't filter queries. Foreign key relationships that don't cascade.

---

## #7 — API Error Responses Inconsistent (Frontend Can't Handle Errors)

**The Problem:**
```ts
// Route 1: Returns error object
if (!tournament) {
  return { error: "Not found", code: "tournament_not_found" };
}

// Route 2: Returns error status
if (!tournament) {
  throw createError({ statusCode: 404, message: "Tournament not found" });
}

// Route 3: Returns different format
if (!tournament) {
  return { message: "Tournament not found" };
}

// Frontend: Which format? How do I check for error?
const response = await $fetch("/api/admin/tournament");
if (response.error) { /* */ }        // Works for route 1
if (response.statusCode === 404) { /* */ }  // Works for route 2
if (response.message) { /* */ }     // Works for route 3
// But each route uses different code!
```

**Why It's Hard to Debug:**
- Frontend has try/catch for HTTP errors, but some routes return 200 with error object inside.
- Developers add error handling per-route instead of once globally.
- New features copy-paste wrong pattern.
- Error codes don't match, so frontend can't distinguish between errors.

**The Fix:**
```ts
// CORRECT ✅
// 1. Define ONE error format (in ProjectRulesKubbWebapp.md):
interface ApiError {
  error: string;        // Dutch user message
  code: string;         // English code
  reason: string;       // English technical reason
  statusCode?: number;
}

// 2. Use consistent HTTP status codes + body:
// Route 1:
if (!tournament) {
  throw createError({
    statusCode: 404,
    data: {
      error: "Toernooi niet gevonden",
      code: "tournament_not_found",
      reason: "No tournament found in database",
    },
  });
}

// Route 2 (same pattern):
if (user.role !== "admin") {
  throw createError({
    statusCode: 401,
    data: {
      error: "Onbevoegd",
      code: "unauthorized",
      reason: "User is not an admin",
    },
  });
}

// 3. Frontend handles ONE way:
try {
  const tournament = await $fetch("/api/admin/tournament");
} catch (e) {
  const error = e.data; // Always { error, code, reason }
  const code = error.code;
  if (code === "tournament_not_found") { /* */ }
  if (code === "unauthorized") { /* */ }
}
```

**Watch for:** Multiple error formats across routes, 200 status with error in body, missing error codes, inconsistent status codes.

---

## #8 — Missing Verification Before Commit (False Confidence)

**The Problem:**
```bash
# Developer commits without running checks
git commit -m "feat(admin): add tournament creation"
# Tests? Not checked.
# Lint? Not checked.
# Types? Not checked.

# Later, CI fails or prod breaks
# But developer has already moved on
```

**Why It's Hard to Debug:**
- Breaks appear after code is merged.
- Blame points to committer who didn't actually verify.
- Other developers waste time fixing someone else's mistakes.
- Momentum lost.

**The Fix:**
```bash
# CORRECT ✅
# Before EVERY commit:
npx vitest run        # All tests pass
npm run lint          # Zero errors
npm run typecheck     # Zero errors
git add .
git commit -m "feat(admin): add tournament creation"

# Or use a pre-commit hook (configured in CLAUDE.md):
# Pre-commit runs these checks automatically
```

**Watch for:** Skipped test runs, ignored linter warnings, "I'll fix it later", uncommitted test failures.

---

## #9 — State Mutations Without Triggering Re-Renders (UI Out of Sync)

**The Problem:**
```ts
// WRONG ❌
const state = {
  tournaments: [
    { id: "1", name: "T1", teams: [] },
  ],
};

// Direct mutation — Vue doesn't detect this
const tournament = state.tournaments[0];
tournament.teams.push(newTeam); // Vue doesn't re-render!

// Or worse:
state.tournaments[0].name = "Updated";
// If this is before a re-render, UI shows old name
```

**Why It's Hard to Debug:**
- Code looks right (state changed).
- DevTools shows the state changed.
- But UI doesn't update.
- Works fine sometimes (depends on timing).
- Looks like async/race condition, but actually just Vue change detection.

**The Fix:**
```ts
// CORRECT ✅
// Use ref/reactive for Vue reactivity
const state = reactive({
  tournaments: [
    { id: "1", name: "T1", teams: [] },
  ],
});

// Vue detects these:
state.tournaments[0].name = "Updated"; // Vue sees this
state.tournaments[0].teams.push(newTeam); // Vue sees this

// Or create new array/object (safer):
const addTeam = (tournamentId: string, team: Team) => {
  const index = state.tournaments.findIndex(t => t.id === tournamentId);
  state.tournaments[index] = {
    ...state.tournaments[index],
    teams: [...state.tournaments[index].teams, team],
  };
};

// Or use update assignment:
const tournament = state.tournaments[0];
Object.assign(tournament, { name: "Updated" });
// or
state.tournaments[0] = { ...state.tournaments[0], name: "Updated" };
```

**Watch for:** Direct mutations on plain objects, `.push()`/`.pop()` on arrays without re-assigning, mutations that don't trigger watchers.

---

## #10 — Circular Dependencies & Over-Coupling (Unmaintainable Code)

**The Problem:**
```ts
// teamService.ts
import { tournamentService } from "./tournamentService";

export async function getTeamsForTournament(tournamentId: string) {
  const tournament = await tournamentService.getTournament(tournamentId);
  return tournament.teams;
}

// tournamentService.ts
import { teamService } from "./teamService";

export async function getTournament(id: string) {
  const tournament = await db.tournament.findUnique({ where: { id } });
  tournament.teams = await teamService.getTeamsForTournament(id);
  return tournament;
}

// Circular dependency! Changes to one break the other.
// Tests become impossible without mocking.
// Refactoring one requires refactoring both.
```

**Why It's Hard to Debug:**
- Module loading fails mysteriously.
- Tests require complex mocking.
- Adding a new feature requires touching both services.
- Coupling spreads — soon half the codebase is coupled.

**The Fix:**
```ts
// CORRECT ✅
// 1. Clear dependency direction:
// db.ts (lowest level)
//   ↓
// tournamentRepository.ts (query builder)
//   ↓
// tournamentService.ts (business logic, calls repo)
//   ↓
// tournaments.get.ts (API route, calls service)

// 2. Repositories only query data
export async function getTournamentWithTeams(tournamentId: string) {
  return db.tournament.findUnique({
    where: { id: tournamentId },
    include: { teams: true },
  });
}

// 3. Services use repositories (no back-references)
export async function getTournamentForAdmin(tournamentId: string) {
  return getTournamentWithTeams(tournamentId);
}

// 4. Routes use services (no direct repo access)
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  const tournament = await getTournamentForAdmin(id);
  return { data: tournament };
});
```

**Watch for:** Circular imports (check `npm run typecheck`), services that import from routes, tight coupling across domains, hard-to-test functions.

---

## Summary: The Debugging Tax

These 10 flaws cost the most in debugging time:

| # | Flaw | Debug Cost | Prevention |
|---|---|---|---|
| 1 | Unvalidated input | High | Zod validation on every route |
| 2 | Missing null checks | High | TypeScript strict mode + review |
| 3 | Hardcoded strings | Medium | Enforce i18n in linter |
| 4 | Mixed validation | High | Separate concerns (Zod + services) |
| 5 | Race conditions | **Very High** | Guards, optimistic updates, tests |
| 6 | DB constraints ≠ code | **Very High** | Schema review before coding |
| 7 | Inconsistent errors | High | Enforce error format in linter |
| 8 | No pre-commit verification | High | Git hooks + PROMPT.md checklist |
| 9 | State mutations | High | Use `ref`/`reactive`, avoid direct mutations |
| 10 | Circular dependencies | High | Clear layering, code review |

**Golden rule:** Bugs that are easiest to introduce are hardest to debug. Catch them at the source (typing, validation, schema) not downstream (debugging, testing).


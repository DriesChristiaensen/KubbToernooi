# CLAUDE.md — Kubb Tournament WebApp

## WHY
A full-stack Dutch-language web app for managing and displaying a single-day Kubb tournament, used by Chiro Sint-Antonius, with role-based access for admin, referees, and public participants.

## WHAT

**Tech stack** (decided; not yet scaffolded as of Phase 0):
- **Nuxt 3** — full-stack framework (frontend + Nitro API routes)
- **Prisma** + **PostgreSQL** — ORM and database
- **Nuxt Auth Utils** — session-based auth (bcrypt, ~12 h sessions)
- **Tailwind CSS** — only styling approach; design tokens in `tailwind.config.ts`
- **Vitest** — unit tests on Nitro API handlers (TDD)
- **Zod** — server-side input validation

**Architecture:**
- Single monorepo; Nuxt server routes replace Express.
- Three API namespaces: `/api/public/*`, `/api/ref/*`, `/api/admin/*`.
- Nginx reverse proxy → Nuxt on `127.0.0.1:3000`; PostgreSQL local only.
- No Pinia; state via `ref`/`reactive`/composables.
- Polling every 60 s on public pages via `usePolling` composable.

## HOW — Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | Vue/TS type check |
| `npx vitest run` | Run all unit tests |
| `npx prisma migrate dev` | Apply schema changes (dev) |
| `npx prisma migrate deploy` | Apply migrations (production) |

## HOW — External tools

| Command | Purpose |
|---|---|
| `docker compose up -d` | Start PostgreSQL (dev) |
| `docker compose down` | Stop PostgreSQL (dev) |
| `docker ps` | List running containers |

## HOW — Conventions

- **Branch strategy:** `main` (production) → `develop` (integration) → `epic/*` → `feature/*`
  - Epic branches: `epic/[epic-number]-[name]` — e.g. `epic/1-tournament-config` (branched from `develop`)
  - Feature branches: `feature/[story-number]-[description]` — e.g. `feature/1.1-team-management` (branched from its epic branch)
  - Merge flow: feature → epic → develop → main
  - When a feature branch is complete (tests pass, committed), merge it into its epic branch and delete the feature branch
  - When all stories in an epic are merged, merge the epic branch into `develop` and delete the epic branch
- **Local only:** Never push to a remote repository. All development happens locally.
- **Commit messages:** Conventional Commits — `type(scope): short description in lowercase`
  - Allowed types: `feat`, `fix`, `refactor`, `test`, `chore`, `docs`, `style`
- **Vue components:** `PascalCase`; composables: `camelCase` with `use` prefix
- **API errors:** always return `{ error (Dutch), code, reason (English), stacktrace }`
- **i18n:** all user-facing text in `/i18n/nl.ts`; no hardcoded strings in templates
- **No comments** unless logic is non-obvious; one sentence max

## SOURCE OF TRUTH — Read these before every task

Read in this order (later files depend on earlier ones):

- `.project-docs/ProjectRulesKubbWebapp.md` → All coding conventions, naming, API design, testing rules, security, i18n, DB rules
- `.project-docs/ImplementationPlanKubbWebapp.md` → Phased implementation plan with DB schema, story details, and deploy process
- `.project-docs/EpicsStories.txt` → Backlog in Dutch — full list of epics and stories
- `.project-docs/EpicsStories_AcceptanceCriteria.txt` → Acceptance criteria per story

## TASK WORKFLOW (Ralph Loop)

```
1. Read progress.md for current state
2. Read .project-docs/ files for requirements and rules (see order above)
3. Pick the next incomplete task from the backlog/implementation plan
4. Implement it following ProjectRulesKubbWebapp.md
5. Verify: run `npx vitest run` (tests), `npm run lint` (lint), `npm run typecheck` (types)
6. Fix any failures before proceeding
7. Git commit: "feat|fix|refactor|test|chore(scope): description"
8. Update progress.md — mark task done, note blockers, set next task
9. If all tasks complete, output EXIT_SIGNAL
```

## GUARDRAILS — Never do these

- Never delete or skip tests
- Never modify DB schema without an explicit task requiring it
- Never skip verification (steps 5–6) — if tests fail, fix before committing
- Never proceed to the next task if the current one has failing tests
- Never install new dependencies without a clear requirement for them
- Never modify files in `.project-docs/`
- Never hardcode Dutch strings in templates — always use `/i18n/nl.ts`
- Never use plain CSS, SCSS, or component libraries — Tailwind only

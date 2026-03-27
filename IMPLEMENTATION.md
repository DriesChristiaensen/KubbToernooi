# Implementation Notes — Kubb Tournament WebApp

## Key Findings & Rules

### API Handler Pattern
- File naming: `server/api/admin/<resource>.<method>.ts` for top-level, or `server/api/admin/<resource>/<action>.<method>.ts` for sub-routes
- Nuxt auto-maps file names to routes: `teams/bulk-import.post.ts` → `POST /api/admin/teams/bulk-import`
- Every handler: `export default defineEventHandler(async (event) => { ... })`
- Error: `throw createApiError({ error: "Dutch text", code: 4xx, reason: "English technical cause" })`
- Non-GET requests must call `logRequest(event, "success"|"error", message)`

### Test Pattern (Vitest)
- Test files live next to the handlers they test (or in the same subdirectory)
- All globals (`defineEventHandler`, `readBody`, `getRouterParam`, `getQuery`, `createApiError`) must be stubbed with `vi.stubGlobal`
- Prisma is mocked via `vi.mock("~/server/utils/prisma", () => ({ prisma: { ... } }))`
- Mock functions must be declared with `vi.hoisted(() => vi.fn())` so they are available before module imports
- Handlers are imported dynamically: `const { default: handler } = await import("./file")`
- TDD: write failing tests first, then implement

### Design Tokens & i18n
- All Dutch strings from `i18n/nl.ts` — no hardcoded strings in templates
- Tailwind classes only, referencing tokens defined in `tailwind.config.ts`
- Design tokens: `bg-primary`, `bg-primary-dark`, `bg-surface`, `bg-background`, `bg-error`, `bg-success`, `bg-secondary`, `text-text`, `text-text-light`, `text-error`, `border-primary`, `max-w-content`

### Story 1.2 — Bulk Import (POST /api/admin/teams/bulk-import)
- Accepts `{ names: string[] }` OR `{ csv: string }` (first column parsed server-side)
- Validates: at least one name, no within-list duplicates, no DB duplicates
- Creates all via `prisma.team.createMany`
- i18n keys: `admin.teams.bulkImport`, `bulkPlaceholder`, `bulkEmpty`, `bulkDuplicatesInList`, `bulkDuplicatesInDb`, `csvUpload`, `csvInvalid`, `imported`

### Story 1.3 — Field Generation (POST /api/admin/fields/generate)
- Accepts `{ count: number, overwrite?: boolean }`
- Generates "Veld 1" through "Veld N"
- If existing fields exist and `overwrite` is falsy → 409 with warning
- If `overwrite: true` → delete all existing fields for tournament first, then createMany
- i18n keys: `admin.fields.generateTitle`, `countLabel`, `countRequired`, `generateButton`, `existingWarning`, `generated`

### Prisma Operations Used
- `prisma.team.createMany({ data: [...], skipDuplicates: false })` — bulk insert
- `prisma.field.createMany({ data: [...] })` — bulk insert
- `prisma.field.deleteMany({ where: { tournamentId } })` — clear before overwrite regeneration

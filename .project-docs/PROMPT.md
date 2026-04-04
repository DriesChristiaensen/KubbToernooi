Execute an audit-fix iteration for the Kubb Tournament WebApp.

## Source of truth

- **`AUDIT.md`** (project root) — full codebase audit with prioritized findings (C1-C3, H1-H9, M1-M7, L1-L9)
- **Implementation Order table** at the bottom of AUDIT.md defines priority groups P0–P6

## Process

1. Read `AUDIT.md` — identify the first priority group (P0–P6) where **none of the IDs are marked as DONE**
2. Read ALL details for those IDs from the rest of AUDIT.md
3. Read `.project-docs/AcceptanceCriteriaAllCode.md` for the acceptance criteria each fix must satisfy
4. Read `.project-docs/` files for project rules as specified in CLAUDE.md
5. Tackle the selected priority group thoroughly:
   - Create a branch: `fix/[audit-group]-[description]` from develop
   - Implement following project rules strictly:
     - Write/update tests where the fix changes behavior (TDD where applicable)
     - All user-facing text from i18n/nl.ts
     - Tailwind only, design tokens only
     - API errors in standard format
   - For each fix, verify it actually resolves the specific AC violation cited in AUDIT.md
6. Verify — ALL THREE must pass before committing:
   - npx vitest run
   - npm run lint
   - npm run typecheck
7. Fix any failures before proceeding
8. Git commit with Conventional Commits: `fix(scope): description`
9. Merge the feature branch into develop and delete the feature branch
10. Update AUDIT.md — mark all completed IDs in that priority group as **DONE**
11. Run full verification on develop:
    - npx vitest run
    - npm run lint
    - npm run typecheck
12. Perform the /clear tool to restart with a fresh context window

## Success criteria per iteration

- All findings for the selected priority group are fully resolved
- The specific acceptance criteria violations cited in AUDIT.md are satisfied
- Tests passing
- No linter errors
- No type errors
- Code committed and merged into develop
- AUDIT.md updated with DONE markers

## Completion rule

Do NOT output the completion signal until EVERY ID in the Implementation Order table is marked as DONE. Before outputting, you MUST:

1. Check AUDIT.md — every ID (C1-C3, H1-H9, M1-M7, L1-L9) must be marked DONE
2. Switch to develop branch
3. Run `npx vitest run` — all tests pass
4. Run `npm run lint` — zero errors
5. Run `npm run typecheck` — zero errors

Only if all of the above succeed, output <promise>RALPH_DONE</promise>. Otherwise, continue to the next unfinished priority group.

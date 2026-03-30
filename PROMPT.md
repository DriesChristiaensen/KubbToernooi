Execute a Ralph Loop iteration for the Kubb Tournament WebApp.

## Process
1. Read progress.md for current state
2. Read ALL .project-docs/ files for requirements and rules
3. Pick the next incomplete task from the implementation plan
4. Create the appropriate branch:
   - Epic branch: epic/[number]-[name] from develop (create if it doesn't exist yet)
   - Feature branch: feature/[story]-[description] from the epic branch
   - Each story MUST have its own feature branch
   - Only ONE feature branch may be open at a time — finish, merge, and delete the current feature branch before creating the next one
5. Implement following ProjectRulesKubbWebapp.md strictly:
   - TDD: write failing tests first, then implement
   - All user-facing text from i18n/nl.ts
   - Tailwind only, design tokens only
   - API errors in standard format
6. Verify — ALL THREE must pass before committing:
   - npx vitest run
   - npm run lint
   - npm run typecheck
7. Fix any failures before proceeding
8. Git commit with Conventional Commits: type(scope): description
9. After committing, merge the feature branch into its epic branch and delete the feature branch
10. If all stories in the epic are done, merge the epic branch into develop and delete the epic branch
11. Update progress.md — mark task done, note blockers, set next task

## Success criteria per iteration
- All acceptance criteria for the current story are met
- Tests passing
- No linter errors
- No type errors
- Code committed
- progress.md updated

## Completion rule
Do NOT output the completion signal until EVERY phase and EVERY story in the implementation plan is fully implemented, committed, and merged into develop. Before outputting, you MUST:
1. Check progress.md — every task must be marked Done
2. Switch to develop branch
3. Run `npx vitest run` — all tests pass
4. Run `npm run lint` — zero errors
5. Run `npm run typecheck` — zero errors

Only if all of the above succeed, output <promise>RALPH_DONE</promise>. Otherwise, continue to the next incomplete task.

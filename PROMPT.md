Execute a Ralph Loop iteration for the Kubb Tournament WebApp.

## Process
1. Read progress.md for current state
2. Read ALL .project-docs/ files for requirements and rules
3. Pick the next incomplete task from the implementation plan
4. Create the appropriate branch if needed:
   - Epic branch: epic/[number]-[name] from develop
   - Feature branch: feature/[story]-[description] from the epic branch
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
9. Update progress.md — mark task done, note blockers, set next task

## Success criteria
- All acceptance criteria for the current story are met
- Tests passing
- No linter errors
- No type errors
- Code committed
- progress.md updated

Output <promise>RALPH_DONE</promise> when all tasks in the implementation plan are complete.

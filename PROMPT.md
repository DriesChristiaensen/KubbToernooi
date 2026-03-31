Execute a tweak/addition iteration for the Kubb Tournament WebApp.

## Process
1. Read `.project-docs/TweaksAndAdditionsKubbWebapp.md` — this is the source of truth
2. Look at the **Implementation Order table** and identify the first row where **none of the IDs are marked as DONE**
3. Read ALL specification details for those IDs from the rest of the document
4. Read ALL other `.project-docs/` files for requirements and rules (ProjectRulesKubbWebapp.md, etc.)
5. Tackle the selected issue(s) thoroughly and well-considered:
   - Create a feature branch: `feature/[tweak-id]-[description]` from develop
   - Implement following ProjectRulesKubbWebapp.md strictly:
     - Write tests first (TDD where applicable)
     - All user-facing text from i18n/nl.ts
     - Tailwind only, design tokens only
     - API errors in standard format
6. Verify — ALL THREE must pass before committing:
   - npx vitest run
   - npm run lint
   - npm run typecheck
7. Fix any failures before proceeding
8. Git commit with Conventional Commits: type(scope): description
9. Merge the feature branch into develop and delete the feature branch
10. Update TweaksAndAdditionsKubbWebapp.md — mark all completed IDs in that priority group as **DONE**
11. Run full verification on develop:
    - npx vitest run
    - npm run lint
    - npm run typecheck

## Success criteria per iteration
- All specification requirements for the selected IDs are fully implemented
- Tests passing
- No linter errors
- No type errors
- Code committed and merged into develop
- TweaksAndAdditionsKubbWebapp.md updated with DONE markers

## Completion rule
Do NOT output the completion signal until EVERY ID in the Implementation Order table is marked as DONE. Before outputting, you MUST:
1. Check TweaksAndAdditionsKubbWebapp.md — every ID must be marked DONE
2. Switch to develop branch
3. Run `npx vitest run` — all tests pass
4. Run `npm run lint` — zero errors
5. Run `npm run typecheck` — zero errors

Only if all of the above succeed, output <promise>RALPH_DONE</promise>. Otherwise, continue to the next unfinished priority group.

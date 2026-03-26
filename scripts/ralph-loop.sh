#!/usr/bin/env bash
set -euo pipefail

# ─── Colors ───
BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# ─── Show current progress ───
echo ""
echo -e "${BLUE}═══════════════════════════════════════${NC}"
echo -e "${BLUE}         🏗️  Ralph Loop — Kubb         ${NC}"
echo -e "${BLUE}═══════════════════════════════════════${NC}"
echo ""

if [ -f progress.md ]; then
  echo -e "${CYAN}Current state (progress.md):${NC}"
  echo "---"
  grep -A2 "## Current Task" progress.md 2>/dev/null || echo "(no current task found)"
  echo "---"
  echo ""
fi

# ─── Show current branch ───
BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
echo -e "${GREEN}Branch:${NC} $BRANCH"
echo ""

# ─── Prompt for instructions ───
echo -e "${YELLOW}Enter task instructions for Claude (or press Enter to auto-pick from backlog):${NC}"
read -r USER_PROMPT

if [ -z "$USER_PROMPT" ]; then
  USER_PROMPT="Pick the next incomplete task from the implementation plan and backlog."
fi

# ─── Build the Ralph Loop prompt ───
RALPH_PROMPT="You are executing a Ralph Loop iteration. Follow these steps exactly:

## Instructions from user
${USER_PROMPT}

## Ralph Loop Steps
1. Read progress.md for current state
2. Read ALL .project-docs/ files for requirements and rules (ProjectRulesKubbWebapp.md first, then ImplementationPlanKubbWebapp.md, then EpicsStories.txt, then EpicsStories_AcceptanceCriteria.txt)
3. Based on the user instructions above (or if empty, pick the next incomplete task from the implementation plan)
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
10. If all tasks in the current story/epic are complete, summarize what was done

IMPORTANT: Do NOT proceed to the next task if tests, lint, or typecheck fail. Fix first."

# ─── Run Claude ───
echo ""
echo -e "${BLUE}═══════════════════════════════════════${NC}"
echo -e "${BLUE}  Launching Claude agent...             ${NC}"
echo -e "${BLUE}═══════════════════════════════════════${NC}"
echo ""

claude --print-cost "$RALPH_PROMPT"

# Implementation Plan — Kubb Tournament WebApp (Final)

## Decisions Summary

| Topic | Decision |
|---|---|
| Framework | Nuxt 3 (full-stack via Nitro server routes) |
| ORM | Prisma |
| Database | PostgreSQL |
| Auth | Nuxt Auth Utils (session-based) |
| Admin login | Password only, resettable via terminal on the droplet |
| Referee login | Name + password, managed by admin |
| Participants | Fully public, no login required |
| Hosting | DigitalOcean Droplet — 2 GB RAM / 1 vCPU / $12/month |
| Domain | Subdomain of chirosint-antonius.be |
| Repo | Monorepo (single Nuxt project) |
| CI/CD | None — manual deploy via SSH |
| Points system | Configurable by admin, default 3-1-0 (win/draw/loss) |
| Pool allocation | Automatic + manually adjustable (before and after going live) |
| KO tiebreaker | Referee manually designates the winner |
| KO bracket seeding | Random team from the top half of qualifiers vs. random team from the bottom half |
| Break time | Configurable per tournament and per round |
| Real-time updates | Polling |
| Multiple tournaments | No — single tournament at a time |
| Public standings | Yes — separate public page with pool tables and KO bracket |
| KO bracket generation | Automatic based on pool standings, then manually adjustable |
| JSON export | Full tournament export as backup/archive |
| JSON import | Full tournament restore; requires admin password confirmation if data already exists |
| Timezone | Fixed to Europe/Brussels (Belgian time) |
| UI language | Dutch (Nederlandstalig) |

---

## Phase 0: Project Foundation & Infrastructure
**Estimated duration: 2–3 days**

### 0.1 Git Repository
- Local git repository with `.gitignore`, `README.md`.
- Simple branching strategy: `main` (production) + feature branches per story (e.g. `feature/1.1-team-management`).
- All development is local only — never push to a remote repository.

### 0.2 Nuxt 3 Project Scaffolding
- `npx nuxi init kubb-toernooi` — monorepo with everything in a single project.
- Install and configure Prisma (`prisma init`, datasource PostgreSQL).
- Install and configure Nuxt Auth Utils for session-based authentication.
- Set up linter (ESLint) and formatter (Prettier).
- Directory structure:
  ```
  /pages            → Frontend pages (participants, admin, referee)
  /components       → Reusable Vue components
  /composables      → Shared logic (useAuth, usePolling, etc.)
  /server/api       → Nitro API routes (replaces Express)
  /server/utils     → Server-side helpers (auth checks, conflict checks)
  /server/middleware → Auth middleware
  /prisma           → Schema, migrations, seed
  ```

### 0.3 DigitalOcean Droplet Setup
- Create droplet: **Basic — 2 GB RAM / 1 vCPU / 50 GB SSD** ($12/month).
- Ubuntu 22.04 LTS, secured with:
  - SSH key only (disable password login).
  - UFW firewall: only ports 22, 80, 443 open.
  - Fail2ban for brute-force protection.
  - Non-root user.
- Install software:
  - **Node.js** (LTS via nvm).
  - **PostgreSQL** (local on the same droplet).
  - **Nginx** as reverse proxy (proxy_pass to Nuxt on port 3000).
  - **PM2** as process manager for the Nuxt server.
  - **Certbot** for SSL certificate on the subdomain.
- DNS: Create an A record for the subdomain (e.g. `kubb.chirosint-antonius.be`) pointing to the droplet IP.

### 0.4 Database Design & Initial Migration
Design the Prisma schema with the following models:

| Model | Purpose |
|---|---|
| `User` | Admin and referee accounts (role, name, password hash) |
| `Tournament` | Settings: name, status (draft/live), type (pool/KO/combination), start time, match duration, break time per round, point values (W/D/L) |
| `Team` | Team name, linked to tournament |
| `Field` | Field name/number, linked to tournament |
| `Pool` | Pool name, linked to tournament, number of teams advancing |
| `PoolTeam` | Join table team ↔ pool |
| `Match` | Phase (pool/KO), round, time slot, field, team_a, team_b, score_a, score_b, status (scheduled/live/awaiting_result/played), ko_winner (nullable, for KO tiebreaker) |
| `Standing` | Cached pool standing per team: points, won, drawn, lost, goal difference |

- Run `npx prisma migrate dev`.
- Write a seed script with test data (admin account, sample teams).

---

## Phase 1: Authentication & Role Management *(Epic 7)*
**Estimated duration: 3–4 days**

### Story 7.1 — Role-Based Access Control
- Roles in the `User` model: `ADMIN` and `REFEREE`.
- Participants have no account — public routes are unprotected.
- Server middleware that checks for `ADMIN` role on every `/api/admin/**` route.
- Server middleware that checks for `ADMIN` or `REFEREE` role on every `/api/ref/**` route.

### Story 7.2 — Authentication Mechanism
- **Admin login:** `/login` page with a password field. Nuxt Auth Utils validates against a bcrypt hash in the database.
- **Admin password reset:** CLI script (standalone Node script) that can be run via SSH on the droplet to reset the admin password.
- **Referee login:** `/login` page with name + password fields. Referee accounts are created and managed by the admin via the dashboard.
- Session duration: ~12 hours (one tournament day).

### Story 7.3 — Universal Referee Access
- Referee dashboard (`/ref`): overview of all matches, grouped by field or time slot.
- Referee clicks a match → score entry screen. No specific match assignment required.

---

## Phase 2: Tournament Configuration *(Epic 1)*
**Estimated duration: 3–4 days**

### Story 1.1 — Individual Management
- Admin page (`/admin/teams`) with CRUD form: add team (name required), edit, delete.
- Admin page (`/admin/fields`) with CRUD form: add field, rename, delete.
- Confirmation dialog on delete.

### Story 1.2 — Bulk Import
- Text field accepting one team name per line.
- Server-side validation for duplicates (within the bulk list and existing teams in the DB).
- CSV upload option: parse file, recognize first column as team name, apply same validation.

### Story 1.3 — Field Generation
- Numeric input field "Number of fields".
- On confirmation: generate `Field 1` through `Field N`.
- Check: do not overwrite existing fields unless the admin explicitly confirms.

---

## Phase 3: Tournament Structure & Format *(Epic 5)*
**Estimated duration: 2–3 days**

### Story 5.1 — Competition Type
- Dropdown in tournament settings: Pools / Knockout / Combination.
- For Pools or Combination:
  - Automatic pool allocation (random, balanced by team count).
  - Manual adjustment: move teams between pools.
  - For Combination: set per pool how many teams advance (top 1, 2, etc.).
- Pool allocation remains editable both before and after going live.

### Story 5.2 — Match Logic per Phase
- Pool matches: draws are allowed (e.g. 1-1 is accepted).
- Knockout matches: draws are allowed, but the referee must designate a winner via a separate field (`ko_winner`).
- Point values: admin configures W/D/L points (default 3/1/0).

---

## Phase 4: Assisted Schedule Management *(Epic 2)*
**Estimated duration: 5–6 days**

### Story 2.1 — Automatic Scheduling
- Input: tournament start time, average match duration, break time per round.
- Algorithm:
  1. Generate all internal matchups per pool (round-robin).
  2. Distribute matches across time slots and fields.
  3. Constraint: no team plays twice in the same time slot; no field double-booked.
- Output: complete schedule with times, fields, and teams.

### Story 2.2 — Conflict Check
- On manual modification of a match (time or field): live validation via API call.
- Clear error message if team or field is already occupied at that time.

### Story 2.3 — Publication Management
- Toggle button "Draft" ↔ "Live" in the admin dashboard.
- Draft: schedule visible only to admin/referee.
- Live: schedule visible on the public participants URL.

### Story 2.4 — Bulk Time Shift
- Dropdown to select a starting time slot ("shift everything from …").
- Input field: number of minutes (positive = later, negative = earlier).
- All matches from that slot onward are automatically recalculated.
- Conflict check runs after the shift.

---

## Phase 5: Results & Standings *(Epic 4)*
**Estimated duration: 4–5 days**

### Story 4.1 — Score Entry
- List view of matches (Admin: all, Referee: all via universal access).
- Per match: numeric input fields for team A and team B scores.
- "Save" → status changes to `played`.
- In KO phase with a draw: additional field appears for the referee to designate the winner.

### Story 4.2 — Real-Time Points Calculation
- After saving: server recalculates the pool standing.
- Ranking order: Points → Goal difference → Head-to-head result.
- Standings table is updated in the database (cached `Standing` records).

### Story 4.3 — Correction Mode
- Admin/Referee can overwrite previously entered scores.
- After correction: standings are immediately recalculated.
- In KO: winner designation can also be corrected.

---

## Phase 6: Participants View *(Epic 3)*
**Estimated duration: 3–4 days**

### Story 3.1 — Mobile Overview
- Public page (`/` or `/schedule`), mobile-first design.
- Chronological match list: time, team A vs. team B, field.
- Polling: fetch data every 30 seconds for updates.

### Story 3.2 — Personal Filter
- Search field at the top with fuzzy search on team name.
- Last searched team name stored in `localStorage`.
- On reload: automatically filter by stored name.

### Story 3.3 — Automatic Status Indicator
- **Live:** current time ≥ start time AND < start time + match duration, no score entered.
- **Played:** score has been entered.
- **Awaiting result:** start time + match duration has passed, no score.
- Status is calculated client-side based on fetched data + system clock.

### Story 3.4 — Public Standings Page *(new)*
- Public page (`/standings`) showing:
  - Pool tables with ranking (points, won, drawn, lost, goal difference).
  - KO bracket visualization showing matchups and results.
- Same polling interval as the schedule page.
- Accessible without login.

---

## Phase 7: KO Bracket Generation *(new — extends Epic 5)*
**Estimated duration: 2–3 days**

### Automatic Bracket Generation
- Triggered by admin when pool phase is complete (or when enough results are in).
- System reads the standings and the configured number of advancing teams per pool.
- Seeding logic: a random team from the **top half** of all qualifiers is matched against a random team from the **bottom half** of all qualifiers.
- Generated bracket is presented to the admin for review.

### Manual Bracket Adjustment
- Admin can swap teams or change matchups before publishing.
- Once published, bracket matches appear in the schedule and are assignable to fields/time slots.
- Further KO rounds (semis, finals) are generated automatically as results come in.

---

## Phase 8: Data Integrity & Backup *(Epic 6)*
**Estimated duration: 2 days**

### Story 6.1 — JSON Export
- Button in the admin dashboard: "Export tournament".
- Downloads a `.json` file containing: tournament settings, teams, fields, pools, full schedule, and all results.
- Serves as backup and archive.

### Story 6.2 — JSON Import *(new)*
- Button in the admin dashboard: "Import tournament".
- Accepts a `.json` file in the same format as the export.
- **If the database is empty:** import runs directly, no confirmation needed.
- **If data already exists:** admin must confirm by entering the admin password. Existing data is fully replaced by the imported data.
- Validation: file structure is checked before import; clear error on invalid format.

---

## Phase 9: Integration, Testing & Go-Live
**Estimated duration: 3–5 days**

### 9.1 End-to-End Testing
- Walk through the complete flow:
  1. Admin logs in → creates tournament → imports teams → generates fields.
  2. Configures pools → generates schedule → checks conflicts → publishes.
  3. Referee logs in → enters scores → standings update.
  4. Pool phase ends → admin generates KO bracket → reviews/adjusts → publishes.
  5. KO matches are played → referee enters scores → bracket advances.
  6. Participant opens site → searches team → sees live status → views standings.
  7. Admin exports JSON → wipes data → imports JSON → verifies restored state.
- Test on smartphone, tablet, and desktop.

### 9.2 Security & Hardening
- Input validation on all API routes (Zod or similar).
- Rate limiting on login endpoints.
- Nginx configuration: security headers, gzip compression.
- PostgreSQL: allow only local connections.

### 9.3 First Deploy
- On the droplet: clone repo, `npm install`, `npx prisma migrate deploy`, `npm run build`.
- Start PM2: `pm2 start .output/server/index.mjs --name kubb`.
- Configure Nginx as reverse proxy → Certbot SSL.
- Create admin seed account via the reset script.
- Smoke test on the live subdomain.

### 9.4 Documentation
- Update `README.md`: installation, environment variables, deploy steps.
- Short user guide for admin and referees.
- Instructions for password reset via SSH.

---

## Timeline Overview

| Phase | Content | Estimated Duration |
|---|---|---|
| 0 | Project Foundation & Infrastructure | 2–3 days |
| 1 | Authentication & Roles (Epic 7) | 3–4 days |
| 2 | Tournament Configuration (Epic 1) | 3–4 days |
| 3 | Structure & Format (Epic 5) | 2–3 days |
| 4 | Schedule Management (Epic 2) | 5–6 days |
| 5 | Results & Standings (Epic 4) | 4–5 days |
| 6 | Participants View (Epic 3) | 3–4 days |
| 7 | KO Bracket Generation (new) | 2–3 days |
| 8 | Data Integrity & Backup (Epic 6) | 2 days |
| 9 | Testing & Go-Live | 3–5 days |
| | **Total** | **~29–37 working days** |

---

## Deploy Process

Deployment strategy is TBD. All development is local only — code is never pushed to a remote repository.

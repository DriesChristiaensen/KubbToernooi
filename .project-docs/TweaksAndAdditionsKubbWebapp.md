# Tweaks & Additions — Kubb Tournament WebApp

This document describes all changes and additions to the existing implementation. Each item is grouped by domain, given a unique ID, and written as an actionable instruction. Items are ordered by dependency — implement from top to bottom.

---

## Implementation Order (Suggested)

The following order respects dependencies:

| Priority | IDs                                  | Description                                                                       |
| -------- | ------------------------------------ | --------------------------------------------------------------------------------- |
| 1        | T1.1 ✅ DONE, T1.2 ✅ DONE, T1.3 ✅ DONE | Database schema changes (GUID, soft-delete, tournament name) — impacts everything |
| 2        | T3.1, T3.2, T3.3, T3.4               | UI shell (header, footer, mobile nav, banner) — used by all pages                 |
| 3        | T2.1, T2.2, T2.3, T2.4, T2.5         | Auth flow changes (separate logins, ref password flow, navigation)                |
| 4        | T4.1, T4.2, T4.3, T4.4, T10.1, T10.2 | Tournament config (wizard, restore, redirect, ref management)                     |
| 5        | T5.1, T5.2                           | Pool management (separate page, team assignment UI)                               |
| 6        | T6.1, T6.2, T6.3                     | KO bracket management (separate page, two-step generation, labels)                |
| 7        | T7.1, T7.2, T7.3, T7.4, T7.5, T7.6   | Schedule management (views, editing, conflicts, per-phase live status)            |
| 8        | T9.1, T9.2, T9.3, T9.4               | Referee features (score UX improvements)                                          |
| 9        | T8.1, T8.2, T8.3, T8.4, T8.5         | Public view (labels, filters, favorite team, tabs)                                |

---

## 1. Database & Architecture

### T1.1 ✅ DONE — Replace Sequential IDs with GUIDs

- Replace all auto-increment integer primary keys with UUIDs (`@default(uuid())` in Prisma) across every model.
- Update all foreign key references accordingly.
- Update all API route parameters and frontend references to use string-based IDs.

### T1.2 ✅ DONE — Soft-Delete for Tournaments

- Add an `isActive` boolean field (default `true`) to the `Tournament` model.
- When a new tournament is created while one already exists: set the current tournament's `isActive` to `false`. Do **not** delete any related data (teams, matches, standings, pools, etc.).
- Soft-delete only applies when an entire tournament is replaced. Individual entity deletions (e.g. removing a single team) remain hard deletes.
- Related data (matches, pools, standings, teams linked to the tournament) must be preserved when a tournament is soft-deleted.

### T1.3 ✅ DONE — Tournament Naming

- Add a `name` field (string, required, unique) to the `Tournament` model.
- The tournament name is for admin purposes only — it does not appear on public pages.
- Enforce uniqueness at the database level and in the API validation.

---

## 2. Authentication & Login Flow

### T2.1 — Separate Login Screens

- **Admin login:** Dedicated page at `/admin/admin-login`. This is the only way to access admin routes.
- **Referee login:** Dedicated page at `/ref/login`.
- **Redirects:**
  - `/ref` → redirect to `/ref/login` if not authenticated.
  - `/admin` → return an Unauthorized error if not authenticated (do **not** redirect to login — the admin login page is at a separate, non-obvious URL).

### T2.2 — Referee Password Flow

- Admin creates referee accounts **without a password** (name only).
- On first login, the referee enters a chosen password. The system prompts: "Nog geen wachtwoord ingesteld. Wilt u het ingevoerde wachtwoord opslaan?" with confirm/cancel.
- On confirmation, the password is hashed and stored.
- Admin has a "Reset wachtwoord" button per referee in the referee management screen. After reset, the referee goes through the first-login flow again.

### T2.3 — Password Visibility Toggle

- On both login screens (admin and referee), add an eye icon button next to the password field to toggle between hidden and visible password.

### T2.4 — Logged-In User Display

- Show the logged-in user's name in the top-right corner of the header bar.

### T2.5 — Logged-In User Navigation

- Logged-in users get a navigation menu matching their role:
  - **Referee:** links to `/ref` and `/` (public pages).
  - **Admin:** links to `/admin`, `/ref`, and `/` (public pages).
- Navigation follows the same structure and component as the public navbar.

---

## 3. UI Shell & Layout

### T3.1 — Reusable Header Bar Component

- The header/navigation bar must be a single reusable component shared across all pages (public, referee, admin).
- Content adapts based on authentication state and role.

### T3.2 — Mobile Navigation

- On mobile: the navbar collapses into a hamburger menu.
- The hamburger button is positioned in the **bottom-right corner** of the screen (floating).
- Every page on mobile must have whitespace/padding at the bottom slightly larger than the hamburger button to prevent content overlap.

### T3.3 — Footer

- Minimal footer on all pages.
- Content: "Chiro Sint-Antonius" with a link to `https://www.chirosint-antonius.be`.

### T3.4 — Admin Tournament Status Banner

- On every admin page: a persistent banner below the header.
- **Orange:** "Toernooi concept nog niet gepubliceerd" — when the tournament is in draft mode.
- **Green:** "Toernooi is live" — when the tournament is published.
- The banner must also reflect the publication status of individual schedules (see T7.6).

---

## 4. Tournament Configuration

### T4.1 — Tournament Creation Wizard

- When no tournament exists, all admin subroutes redirect to `/admin/tournament`.
- The `/admin/tournament` page presents a wizard-style workflow with sequential steps:
  1. **Tournament settings:** Type (poule/KO/combination), start time, match duration, break time, points for win/draw/loss.
  2. **Fields:** Number of fields to generate.
  3. **If poule or combination:** Number of poules **and** number of teams per poule (these are connected/linked fields — changing one recalculates the other based on total team count).
  4. **If KO or combination:** Number of teams in the first KO round.
- The wizard must include a start day and start time selector for schedule generation.

### T4.2 — Tournament Replacement Confirmation

- If a tournament already exists, the tournament settings page must be behind a confirmation prompt: "Een nieuw toernooi aanmaken zal het huidige toernooi archiveren. Weet u het zeker?"
- A tournament cannot be edited — only replaced by creating a new one (which soft-deletes the current one per T1.2).

### T4.3 — Tournament Restore & Cleanup

- Add a "Herstellen" (Restore) screen accessible from the admin tournament page.
- Lists all inactive (soft-deleted) tournaments by name.
- **Restore action:** Sets the current active tournament to inactive, and reactivates the selected old tournament.
- **Delete action:** Permanently deletes an inactive tournament and all its related data (hard delete).

### T4.4 — Remove CSV Upload for Teams

- Remove the CSV upload option from the team bulk import. Keep only the text field (one name per line).

---

## 5. Pool Management

### T5.1 — Separate Pool Management Page

- Pools are managed on a dedicated admin page (`/admin/pools`), **not** within the tournament settings page.
- This page is only accessible when the tournament type is "poule" or "combination".
- When the tournament type is "KO only", pool management is not available.

### T5.2 — Pool Team Assignment UI

- The pool editing screen shows:
  - A list of all pools with their assigned teams.
  - A full list of all teams in the tournament for selection.
  - Teams already assigned to **another** pool are shown as **greyed out** (not selectable).
  - Teams not assigned to **any** pool trigger a **warning** displayed below the "Poules" title: "Let op: [n] team(s) zijn nog niet ingedeeld in een poule."
- The admin selects which teams belong to each pool from this interface.

---

## 6. KO Bracket Management

### T6.1 — Separate KO Management Page

- KO bracket management lives on a dedicated admin page (`/admin/ko`), **not** within the tournament settings page.
- Only accessible when the tournament type is "KO" or "combination".

### T6.2 — Two-Step KO Bracket Generation

- **Step 1 — Generate structure:** Create the KO bracket without teams. Configure only fields and time slots. Each match gets a descriptive name (e.g. "1/8 finale A", "1/8 finale B", "Kwartfinale C").
- **Step 2 — Fill teams:** A separate "Teams invullen" button populates the bracket with teams based on pool standings and seeding logic (top half vs. bottom half, random within halves).
- Step 2 can only be triggered after step 1 is complete.

### T6.3 — KO Match Round Labels

- Every KO match must display a round label: "1/16 finale", "1/8 finale", "Kwartfinale", "Halve finale", "Finale".
- These labels appear in all views: admin, referee, and public.

---

## 7. Schedule Management

### T7.1 — Schedule Generation: Day and Time Picker

- When generating a schedule, the admin must select both a **start day** (date picker) and a **start time** (time picker).

### T7.2 — Mixed Rounds in Pool Phase

- When generating the pool phase schedule, different rounds may overlap. For example: the last matches of round 1 may run simultaneously with the first matches of round 2, to optimize field usage.
- **Hard constraint:** No team may have overlapping matches, regardless of round mixing.

### T7.3 — Schedule Viewing: Three Views

The admin schedule page must offer three view modes (tabs or toggle):

1. **Per field:** Table with columns: start time, team A, team B. One table per field.
2. **Per team:** Table with columns: start time, field, opponent. One table per team.
3. **Per time slot:** Large grid. Rows = start times. Columns = fields. Cells = "Team A vs. Team B".

### T7.4 — Schedule Editing: Switch Mode

- A draft schedule is created first (not immediately live).
- The admin edits the schedule by swapping matches:
  1. Click on a match → it enters **switch mode** (visually highlighted, e.g. colored border or background).
  2. Click on another match → the two matches swap their time slot and field.
  3. Click on the same match again → cancel switch mode.
- While in switch mode, fields are color-coded: **green** = available (no conflict), **red** = unavailable (conflict exists).
- **Teams within a match are not editable.** Only time slots and fields can be swapped.
- Overlaps/conflicts are allowed during editing but clearly displayed with an error message.

### T7.5 — Conflict Error Messages

- When a schedule conflict is detected, the error message must include: **field name** and **both team names** involved in the conflict.

### T7.6 — Separate Live Status per Schedule Phase

- Pool schedule and KO schedule can be published ("Live" gezet) independently.
- The admin can keep one in draft while the other is live.
- The admin dashboard banner (T3.4) must reflect this. Examples:
  - "Poule-schema is live — KO-schema is nog niet gepubliceerd"
  - "Alle schema's zijn live"
  - "Geen schema's gepubliceerd"

---

## 8. Public View

### T8.1 — Match Status Labels

- Every match in the public overview displays one of three labels:
  - **"Niet begonnen"** — match has not started yet.
  - **"Wordt gespeeld"** — match is currently in progress.
  - **"Beëindigd"** — match is finished (score entered).

### T8.2 — Match Status Filter

- Add a filter bar to the public match overview with three options:
  - **"Alle wedstrijden"** — show all matches.
  - **"Gespeeld"** — show only matches with a score.
  - **"Te spelen"** — show all matches without a score (includes "Niet begonnen" and "Wordt gespeeld").

### T8.3 — Favorite Team Selection

- Replace the "Zoek op teamnaam" search field with a "Kies favoriete team" button.
- Clicking the button opens a **modal popup** with:
  - A search field for filtering teams.
  - A full list of teams to choose from.
- The selected team is saved in a **browser cookie** valid for 48 hours.
- Every match overview screen has a filter toggle: **"Mijn team"** — filters to show only matches involving the favorite team.

### T8.4 — Standings in Navbar

- Move the "Standen" (standings) link into the main navigation bar.
- On mobile: it appears inside the hamburger menu.

### T8.5 — Public View: Phase Tabs and Sub-Tabs

The public match and standings view must use a tabbed structure:

**Main tabs (horizontal):**

- **Poule-only tournament:** One main tab showing all pool matches.
- **KO-only tournament:** One main tab showing the KO bracket as a horizontal tree structure.
- **Combination tournament:** Two main tabs — "Poule" and "KO".

**Sub-tabs per main tab:**

- **"Wedstrijden"** — shows the match list/bracket.
- **"Standen"** — shows the standings/ranking.

**Final standings tab:**

- When **all matches of a phase** are completed, an additional main tab **"Eindstand"** appears.
- This tab is placed **first** (leftmost) when it becomes available.
- Content by tournament type:
  - **Poule:** Ranked list of all teams by: points → goal difference → number of wins → head-to-head → ex aequo.
  - **KO:** Horizontal tree/bracket with the winner at the top.
  - **Combination:** Two sub-tabs — first the KO final standings (bracket), then the pool standings per pool.

---

## 9. Referee Features

### T9.1 — Score Update Confirmation

- When a referee tries to update a score that has already been entered, show a confirmation dialog: "Er is al een score genoteerd. Wilt u deze overschrijven?"
- Options: "Zeker" (confirm) / "Annuleren" (cancel).

### T9.2 — Score Save Success Feedback

- After a successful score save (database call confirmed), the save button:
  - Turns **green**.
  - Shows a **check icon** instead of the default text/icon.
  - Returns to normal after **2 seconds**.

### T9.3 — Score Display: Read Mode vs. Edit Mode

- When a match already has a score, display the score as **plain text**.
- Next to it, show an **edit icon button**.
- Clicking the edit button switches to input mode, allowing the score to be modified.

### T9.4 — Score Deletion

- Referees must have the ability to **delete** a previously entered score (e.g. when a match is still in progress and was scored prematurely).
- This resets the match status back to "Wordt gespeeld" or "Niet begonnen" depending on the current time.

---

## 10. Admin Dashboard

### T10.1 — Redirect to Tournament Page When No Tournament Exists

- If no active tournament is found in the database, **all** admin subroutes redirect to `/admin/tournament`.
- The tournament page must provide the wizard to create a new tournament (T4.1).

### T10.2 — Referee Management Without Password

- In the referee management screen, the admin adds referees by **name only** — no password field.
- A "Reset wachtwoord" button is available per referee (see T2.2).

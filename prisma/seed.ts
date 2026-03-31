import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

const TEAM_NAMES = [
  "De Kubbkoningen",
  "Team Vollgas",
  "Blokkeers",
  "Zweedse Meesters",
  "De Hoppers",
  "Vikingen FC",
  "Kubbclash",
  "De Houten Reuzen",
];

const TOURNAMENT_START = new Date("2025-08-15T09:00:00Z");
const MATCH_DURATION = 15;
const BREAK_TIME = 5;
const SLOT_MS = (MATCH_DURATION + BREAK_TIME) * 60 * 1000;

function slotTime(slot: number): Date {
  return new Date(TOURNAMENT_START.getTime() + slot * SLOT_MS);
}

const BYE = "";

function generateRoundRobin(teamIds: string[]): Array<Array<[string, string]>> {
  const ids = [...teamIds];
  if (ids.length % 2 !== 0) ids.push(BYE);
  const n = ids.length;
  const rounds: Array<Array<[string, string]>> = [];
  for (let r = 0; r < n - 1; r++) {
    const pairs: Array<[string, string]> = [];
    for (let i = 0; i < n / 2; i++) {
      const a = ids[i]!;
      const b = ids[n - 1 - i]!;
      if (a !== BYE && b !== BYE) pairs.push([a, b]);
    }
    rounds.push(pairs);
    ids.splice(1, 0, ids.pop()!);
  }
  return rounds;
}

async function clearData() {
  await prisma.tournament.deleteMany();
  console.log("  Cleared tournament data (cascade)");
}

async function ensureAdmin() {
  const adminPassword = await bcrypt.hash("admin!", 12);
  const existing = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  if (!existing) {
    await prisma.user.create({ data: { name: "Admin", password: adminPassword, role: "ADMIN" } });
  }
  console.log("  Admin account ready (password: admin!)");
}

async function createBase(type: "POOLS" | "KNOCKOUT" | "COMBINATION", name: string, fieldCount: number) {
  const tournament = await prisma.tournament.create({
    data: {
      name,
      type,
      status: "DRAFT",
      startTime: TOURNAMENT_START,
      matchDuration: MATCH_DURATION,
      breakTime: BREAK_TIME,
      pointsWin: 3,
      pointsDraw: 1,
      pointsLoss: 0,
    },
  });

  const teams = await Promise.all(
    TEAM_NAMES.map((n) => prisma.team.create({ data: { name: n, tournamentId: tournament.id } })),
  );

  const fields = await Promise.all(
    Array.from({ length: fieldCount }, (_, i) =>
      prisma.field.create({ data: { name: `Veld ${i + 1}`, tournamentId: tournament.id } }),
    ),
  );

  return { tournament, teams, fields };
}

async function createPools(
  tournamentId: string,
  teams: { id: string }[],
  fields: { id: string }[],
  teamsAdvancing: number,
  slotOffset: number,
) {
  const half = Math.floor(teams.length / 2);
  const pools = [
    { name: "Poule A", teamSlice: teams.slice(0, half) },
    { name: "Poule B", teamSlice: teams.slice(half) },
  ];

  let slot = slotOffset;

  for (const { name, teamSlice } of pools) {
    const pool = await prisma.pool.create({
      data: { name, tournamentId, teamsAdvancing },
    });

    await Promise.all(
      teamSlice.map((t) => prisma.poolTeam.create({ data: { poolId: pool.id, teamId: t.id } })),
    );
    await Promise.all(
      teamSlice.map((t) => prisma.standing.create({ data: { poolId: pool.id, teamId: t.id } })),
    );

    const rounds = generateRoundRobin(teamSlice.map((t) => t.id));
    for (const [roundIdx, pairs] of rounds.entries()) {
      for (let i = 0; i < pairs.length; i++) {
        const [teamAId, teamBId] = pairs[i]!;
        await prisma.match.create({
          data: {
            phase: "POOL",
            round: roundIdx + 1,
            startTime: slotTime(slot),
            fieldId: fields[i % fields.length]!.id,
            poolId: pool.id,
            teamAId,
            teamBId,
            status: "SCHEDULED",
          },
        });
      }
      slot++;
    }
  }

  return slot;
}

// ─── SEED: POOL ────────────────────────────────────────────────────────────────

async function seedPool() {
  console.log("\nSeeding POOL tournament...");
  await clearData();
  await ensureAdmin();

  const { tournament, teams, fields } = await createBase(
    "POOLS",
    "Kubb Pouletoernooi 2025",
    3,
  );

  const totalSlots = await createPools(tournament.id, teams, fields, 2, 0);

  console.log(`  Created: 8 teams, 3 velden, 2 poules, ${totalSlots} tijdslots`);
  console.log("Done: POOL tournament seeded.");
}

// ─── SEED: KO ──────────────────────────────────────────────────────────────────

async function seedKo() {
  console.log("\nSeeding KO tournament...");
  await clearData();
  await ensureAdmin();

  const { teams, fields } = await createBase(
    "KNOCKOUT",
    "Kubb Knock-out Toernooi 2025",
    4,
  );

  // Round 1: seed 1v8, 2v7, 3v6, 4v5
  const r1Pairs: Array<[string, string]> = [
    [teams[0]!.id, teams[7]!.id],
    [teams[1]!.id, teams[6]!.id],
    [teams[2]!.id, teams[5]!.id],
    [teams[3]!.id, teams[4]!.id],
  ];

  for (let i = 0; i < r1Pairs.length; i++) {
    const [teamAId, teamBId] = r1Pairs[i]!;
    await prisma.match.create({
      data: {
        phase: "KO",
        round: 1,
        startTime: slotTime(i % fields.length === 0 && i > 0 ? 1 : 0),
        fieldId: fields[i % fields.length]!.id,
        teamAId,
        teamBId,
        status: "SCHEDULED",
      },
    });
  }

  // Round 2 placeholders: winners of match 1v2 and 3v4 (teams TBD after round 1)
  // Use first two teams as placeholder — admin will generate these after round 1
  console.log("  Created: 8 teams, 4 velden, 4 KO wedstrijden (ronde 1)");
  console.log("  Ronde 2 en finale worden automatisch aangemaakt na invoer uitslagen.");
  console.log("Done: KO tournament seeded.");
}

// ─── SEED: COMBINED ────────────────────────────────────────────────────────────

async function seedCombined() {
  console.log("\nSeeding COMBINED tournament...");
  await clearData();
  await ensureAdmin();

  const { tournament, teams, fields } = await createBase(
    "COMBINATION",
    "Kubb Combinatietoernooi 2025",
    3,
  );

  const totalSlots = await createPools(tournament.id, teams, fields, 2, 0);

  console.log(`  Created: 8 teams, 3 velden, 2 poules (top 2 door), ${totalSlots} poolwedstrijden`);
  console.log("  Na de poule-fase: gebruik admin > KO-schema om het KO-bracket te genereren.");
  console.log("Done: COMBINED tournament seeded.");
}

// ─── SEED: EMPTY ───────────────────────────────────────────────────────────────

async function seedEmpty() {
  console.log("\nSeeding EMPTY tournament...");
  await clearData();
  await ensureAdmin();

  await prisma.tournament.create({
    data: {
      name: "Kubb Toernooi",
      type: "COMBINATION",
      status: "DRAFT",
      startTime: TOURNAMENT_START,
      matchDuration: MATCH_DURATION,
      breakTime: BREAK_TIME,
      pointsWin: 3,
      pointsDraw: 1,
      pointsLoss: 0,
    },
  });

  console.log("  Created: 1 tournament (geen teams, geen velden)");
  console.log("Done: EMPTY tournament seeded.");
}

// ─── ENTRY POINT ───────────────────────────────────────────────────────────────

const type = process.argv[2] ?? "combined";

async function seedClear() {
  console.log("\nClearing all tournament data...");
  await clearData();
  console.log("Done: all tournament data cleared.");
}

const runners: Record<string, () => Promise<void>> = {
  pool: seedPool,
  ko: seedKo,
  combined: seedCombined,
  empty: seedEmpty,
  clear: seedClear,
};

const run = runners[type];
if (!run) {
  console.error(`Unknown seed type: "${type}". Use: pool | ko | combined | clear`);
  process.exit(1);
}

run()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

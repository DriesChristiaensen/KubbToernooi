import bcrypt from "bcrypt";
import type { TournamentStatus, TournamentType, MatchStatus, MatchPhase } from "@prisma/client";
import { prisma } from "~/server/utils/prisma";
import { logRequest } from "~/server/utils/logger";

function isValidImport(data: unknown): data is {
  tournament: Record<string, unknown>;
  teams: unknown[];
  fields: unknown[];
  pools: unknown[];
  matches: unknown[];
  standings: unknown[];
} {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  return (
    !!d.tournament &&
    typeof d.tournament === "object" &&
    Array.isArray(d.teams) &&
    Array.isArray(d.fields) &&
    Array.isArray(d.pools) &&
    Array.isArray(d.matches) &&
    Array.isArray(d.standings)
  );
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  if (!isValidImport(body?.data)) {
    throw createApiError({
      error: "Ongeldig importformaat. Controleer het JSON-bestand.",
      code: 400,
      reason: "Invalid import format",
    });
  }

  const { data, password } = body;
  const { tournament: t, teams, fields, pools, matches, standings } = data;

  const existing = await prisma.tournament.findFirst();

  if (existing) {
    if (!password) {
      throw createApiError({
        error: "Er zijn al gegevens aanwezig. Voer het admin-wachtwoord in om te bevestigen.",
        code: 409,
        reason: "Password required to overwrite existing data",
      });
    }
    const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
    if (!admin) {
      throw createApiError({
        error: "Admin-account niet gevonden",
        code: 404,
        reason: "Admin user not found",
      });
    }
    if (!admin.password) {
      throw createApiError({ error: "Admin-account heeft geen wachtwoord ingesteld", code: 500, reason: "Admin has no password" });
    }
    const valid = await bcrypt.compare(password, admin.password);
    if (!valid) {
      throw createApiError({
        error: "Onjuist wachtwoord",
        code: 401,
        reason: "Invalid password",
      });
    }
    await prisma.tournament.updateMany({ data: { isActive: false } });
  }

  const newTournament = await prisma.tournament.create({
    data: {
      name: String(t.name),
      status: ((t.status as string) || "DRAFT") as TournamentStatus,
      type: ((t.type as string) || "COMBINATION") as TournamentType,
      startTime: new Date((t.startTime as string) || new Date()),
      matchDuration: Number(t.matchDuration) || 15,
      breakTime: Number(t.breakTime) || 5,
      pointsWin: t.pointsWin !== undefined ? Number(t.pointsWin) : 3,
      pointsDraw: t.pointsDraw !== undefined ? Number(t.pointsDraw) : 1,
      pointsLoss: t.pointsLoss !== undefined ? Number(t.pointsLoss) : 0,
    },
  });

  const teamMap = new Map<string, string>();
  for (const team of teams as Array<Record<string, unknown>>) {
    const created = await prisma.team.create({
      data: { name: String(team.name), tournamentId: newTournament.id },
    });
    teamMap.set(String(team.id), created.id);
  }

  const fieldMap = new Map<string, string>();
  for (const field of fields as Array<Record<string, unknown>>) {
    const created = await prisma.field.create({
      data: { name: String(field.name), tournamentId: newTournament.id },
    });
    fieldMap.set(String(field.id), created.id);
  }

  const poolMap = new Map<string, string>();
  for (const pool of pools as Array<Record<string, unknown>>) {
    const created = await prisma.pool.create({
      data: {
        name: String(pool.name),
        tournamentId: newTournament.id,
        teamsAdvancing: Number(pool.teamsAdvancing) || 2,
      },
    });
    poolMap.set(String(pool.id), created.id);
    for (const pt of (pool.poolTeams as Array<Record<string, unknown>>) || []) {
      const mappedTeamId = teamMap.get(String(pt.teamId));
      if (mappedTeamId) {
        await prisma.poolTeam.create({
          data: { poolId: created.id, teamId: mappedTeamId },
        });
      }
    }
  }

  for (const match of matches as Array<Record<string, unknown>>) {
    const mappedFieldId = fieldMap.get(String(match.fieldId));
    const mappedTeamAId = teamMap.get(String(match.teamAId));
    const mappedTeamBId = teamMap.get(String(match.teamBId));
    const mappedPoolId = match.poolId ? poolMap.get(String(match.poolId)) : null;
    if (mappedFieldId && mappedTeamAId && mappedTeamBId) {
      await prisma.match.create({
        data: {
          phase: ((match.phase as string) || "POOL") as MatchPhase,
          round: Number(match.round) || 1,
          startTime: new Date(match.startTime as string),
          fieldId: mappedFieldId,
          poolId: mappedPoolId ?? null,
          teamAId: mappedTeamAId,
          teamBId: mappedTeamBId,
          scoreA: match.scoreA !== null ? Number(match.scoreA) : null,
          scoreB: match.scoreB !== null ? Number(match.scoreB) : null,
          status: ((match.status as string) || "SCHEDULED") as MatchStatus,
          koWinnerId: match.koWinnerId ? teamMap.get(String(match.koWinnerId)) ?? null : null,
        },
      });
    }
  }

  for (const standing of standings as Array<Record<string, unknown>>) {
    const mappedPoolId = poolMap.get(String(standing.poolId));
    const mappedTeamId = teamMap.get(String(standing.teamId));
    if (mappedPoolId && mappedTeamId) {
      await prisma.standing.create({
        data: {
          poolId: mappedPoolId,
          teamId: mappedTeamId,
          played: Number(standing.played) || 0,
          won: Number(standing.won) || 0,
          drawn: Number(standing.drawn) || 0,
          lost: Number(standing.lost) || 0,
          goalsFor: Number(standing.goalsFor) || 0,
          goalsAgainst: Number(standing.goalsAgainst) || 0,
          goalDifference: Number(standing.goalDifference) || 0,
          points: Number(standing.points) || 0,
        },
      });
    }
  }

  logRequest(event, "success", "Tournament imported successfully");
  return { imported: true };
});

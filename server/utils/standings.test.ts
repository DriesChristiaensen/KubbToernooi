import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPoolTeamFindMany = vi.hoisted(() => vi.fn());
const mockMatchFindMany = vi.hoisted(() => vi.fn());
const mockTournamentFindFirst = vi.hoisted(() => vi.fn());
const mockStandingUpsert = vi.hoisted(() => vi.fn());

vi.mock("~/server/utils/prisma", () => ({
  prisma: {
    poolTeam: { findMany: mockPoolTeamFindMany },
    match: { findMany: mockMatchFindMany },
    tournament: { findFirst: mockTournamentFindFirst },
    standing: { upsert: mockStandingUpsert },
  },
}));

const { recalculatePoolStandings } = await import("./standings");

const poolId = 10;
const tournament = { id: 1, pointsWin: 3, pointsDraw: 1, pointsLoss: 0 };

describe("recalculatePoolStandings", () => {
  beforeEach(() => vi.clearAllMocks());

  it("does nothing when pool has no teams", async () => {
    mockPoolTeamFindMany.mockResolvedValue([]);
    mockMatchFindMany.mockResolvedValue([]);
    mockTournamentFindFirst.mockResolvedValue(tournament);

    await recalculatePoolStandings(poolId);

    expect(mockStandingUpsert).not.toHaveBeenCalled();
  });

  it("calculates 0 stats when no played matches", async () => {
    mockPoolTeamFindMany.mockResolvedValue([{ teamId: 1 }, { teamId: 2 }]);
    mockMatchFindMany.mockResolvedValue([]);
    mockTournamentFindFirst.mockResolvedValue(tournament);
    mockStandingUpsert.mockResolvedValue({});

    await recalculatePoolStandings(poolId);

    expect(mockStandingUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ played: 0, won: 0, points: 0 }),
      }),
    );
  });

  it("awards 3 points for a win and 0 for a loss", async () => {
    mockPoolTeamFindMany.mockResolvedValue([{ teamId: 1 }, { teamId: 2 }]);
    mockMatchFindMany.mockResolvedValue([
      { id: 1, teamAId: 1, teamBId: 2, scoreA: 3, scoreB: 1 },
    ]);
    mockTournamentFindFirst.mockResolvedValue(tournament);
    mockStandingUpsert.mockResolvedValue({});

    await recalculatePoolStandings(poolId);

    const team1Call = mockStandingUpsert.mock.calls.find(
      (c) => c[0].where.poolId_teamId.teamId === 1,
    )!;
    const team2Call = mockStandingUpsert.mock.calls.find(
      (c) => c[0].where.poolId_teamId.teamId === 2,
    )!;

    expect(team1Call[0].update).toMatchObject({ won: 1, lost: 0, points: 3 });
    expect(team2Call[0].update).toMatchObject({ won: 0, lost: 1, points: 0 });
  });

  it("awards 1 point each for a draw", async () => {
    mockPoolTeamFindMany.mockResolvedValue([{ teamId: 1 }, { teamId: 2 }]);
    mockMatchFindMany.mockResolvedValue([
      { id: 1, teamAId: 1, teamBId: 2, scoreA: 2, scoreB: 2 },
    ]);
    mockTournamentFindFirst.mockResolvedValue(tournament);
    mockStandingUpsert.mockResolvedValue({});

    await recalculatePoolStandings(poolId);

    const team1Call = mockStandingUpsert.mock.calls.find(
      (c) => c[0].where.poolId_teamId.teamId === 1,
    )!;
    expect(team1Call[0].update).toMatchObject({ drawn: 1, points: 1 });
  });

  it("calculates goal difference correctly", async () => {
    mockPoolTeamFindMany.mockResolvedValue([{ teamId: 1 }]);
    mockMatchFindMany.mockResolvedValue([
      { id: 1, teamAId: 1, teamBId: 2, scoreA: 5, scoreB: 2 },
      { id: 2, teamAId: 3, teamBId: 1, scoreA: 1, scoreB: 3 },
    ]);
    mockTournamentFindFirst.mockResolvedValue(tournament);
    mockStandingUpsert.mockResolvedValue({});

    await recalculatePoolStandings(poolId);

    const call = mockStandingUpsert.mock.calls[0];
    expect(call[0].update).toMatchObject({
      goalsFor: 8,
      goalsAgainst: 3,
      goalDifference: 5,
      played: 2,
    });
  });
});

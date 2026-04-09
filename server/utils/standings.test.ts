import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPoolTeamFindMany = vi.hoisted(() => vi.fn());
const mockMatchFindMany = vi.hoisted(() => vi.fn());
const mockTournamentFindFirst = vi.hoisted(() => vi.fn());
const mockStandingDeleteMany = vi.hoisted(() => vi.fn());
const mockStandingCreateMany = vi.hoisted(() => vi.fn());
const mockTransaction = vi.hoisted(() => vi.fn());

vi.mock("~/server/utils/prisma", () => ({
  prisma: {
    poolTeam: { findMany: mockPoolTeamFindMany },
    match: { findMany: mockMatchFindMany },
    tournament: { findFirst: mockTournamentFindFirst },
    standing: { deleteMany: mockStandingDeleteMany, createMany: mockStandingCreateMany },
    $transaction: mockTransaction,
  },
}));

const { recalculatePoolStandings } = await import("./standings");

const poolId = "p10";
const tournament = { id: "t1", pointsWin: 3, pointsDraw: 1, pointsLoss: 0 };

describe("recalculatePoolStandings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock transaction to pass the callback through
    mockTransaction.mockImplementation(async (callback: any) => {
      const tx = {
        standing: {
          deleteMany: mockStandingDeleteMany,
          createMany: mockStandingCreateMany,
        },
      };
      return callback(tx);
    });
  });

  it("does nothing when pool has no teams", async () => {
    mockPoolTeamFindMany.mockResolvedValue([]);
    mockMatchFindMany.mockResolvedValue([]);
    mockTournamentFindFirst.mockResolvedValue(tournament);
    mockStandingDeleteMany.mockResolvedValue({ count: 0 });
    mockStandingCreateMany.mockResolvedValue({ count: 0 });

    await recalculatePoolStandings(poolId);

    expect(mockStandingCreateMany).toHaveBeenCalledWith({ data: [] });
  });

  it("calculates 0 stats when no played matches", async () => {
    mockPoolTeamFindMany.mockResolvedValue([{ teamId: "t1" }, { teamId: "t2" }]);
    mockMatchFindMany.mockResolvedValue([]);
    mockTournamentFindFirst.mockResolvedValue(tournament);
    mockStandingDeleteMany.mockResolvedValue({ count: 2 });
    mockStandingCreateMany.mockResolvedValue({ count: 2 });

    await recalculatePoolStandings(poolId);

    expect(mockStandingCreateMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ teamId: "t1", played: 0, won: 0, points: 0 }),
        expect.objectContaining({ teamId: "t2", played: 0, won: 0, points: 0 }),
      ]),
    });
  });

  it("awards 3 points for a win and 0 for a loss", async () => {
    mockPoolTeamFindMany.mockResolvedValue([{ teamId: "t1" }, { teamId: "t2" }]);
    mockMatchFindMany.mockResolvedValue([
      { id: "m1", teamAId: "t1", teamBId: "t2", scoreA: 3, scoreB: 1 },
    ]);
    mockTournamentFindFirst.mockResolvedValue(tournament);
    mockStandingDeleteMany.mockResolvedValue({ count: 2 });
    mockStandingCreateMany.mockResolvedValue({ count: 2 });

    await recalculatePoolStandings(poolId);

    const call = mockStandingCreateMany.mock.calls[0][0].data;
    const team1 = call.find((s: any) => s.teamId === "t1");
    const team2 = call.find((s: any) => s.teamId === "t2");

    expect(team1).toMatchObject({ won: 1, lost: 0, points: 3 });
    expect(team2).toMatchObject({ won: 0, lost: 1, points: 0 });
  });

  it("awards 1 point each for a draw", async () => {
    mockPoolTeamFindMany.mockResolvedValue([{ teamId: "t1" }, { teamId: "t2" }]);
    mockMatchFindMany.mockResolvedValue([
      { id: "m1", teamAId: "t1", teamBId: "t2", scoreA: 2, scoreB: 2 },
    ]);
    mockTournamentFindFirst.mockResolvedValue(tournament);
    mockStandingDeleteMany.mockResolvedValue({ count: 2 });
    mockStandingCreateMany.mockResolvedValue({ count: 2 });

    await recalculatePoolStandings(poolId);

    const call = mockStandingCreateMany.mock.calls[0][0].data;
    const team1 = call.find((s: any) => s.teamId === "t1");
    expect(team1).toMatchObject({ drawn: 1, points: 1 });
  });

  it("calculates goal difference correctly", async () => {
    mockPoolTeamFindMany.mockResolvedValue([{ teamId: "t1" }]);
    mockMatchFindMany.mockResolvedValue([
      { id: "m1", teamAId: "t1", teamBId: "t2", scoreA: 5, scoreB: 2 },
      { id: "m2", teamAId: "t3", teamBId: "t1", scoreA: 1, scoreB: 3 },
    ]);
    mockTournamentFindFirst.mockResolvedValue(tournament);
    mockStandingDeleteMany.mockResolvedValue({ count: 1 });
    mockStandingCreateMany.mockResolvedValue({ count: 1 });

    await recalculatePoolStandings(poolId);

    const call = mockStandingCreateMany.mock.calls[0][0].data[0];
    expect(call).toMatchObject({
      goalsFor: 8,
      goalsAgainst: 3,
      goalDifference: 5,
      played: 2,
    });
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockTournamentFindFirst = vi.hoisted(() => vi.fn());
const mockPoolFindMany = vi.hoisted(() => vi.fn());
const mockTeamFindMany = vi.hoisted(() => vi.fn());
const mockMatchFindMany = vi.hoisted(() => vi.fn());
const mockMatchUpdate = vi.hoisted(() => vi.fn());

vi.stubGlobal("defineEventHandler", (handler: any) => handler);
vi.stubGlobal("createApiError", ({ error, code, reason }: any) => {
  const err = new Error(reason) as any;
  err.statusCode = code;
  err.data = { error, code, reason, stacktrace: {} };
  return err;
});

vi.mock("~/server/utils/prisma", () => ({
  prisma: {
    tournament: { findFirst: mockTournamentFindFirst },
    pool: { findMany: mockPoolFindMany },
    team: { findMany: mockTeamFindMany },
    match: {
      findMany: mockMatchFindMany,
      update: mockMatchUpdate,
    },
  },
}));

vi.mock("~/server/utils/logger", () => ({ logRequest: vi.fn() }));

const { default: handler } = await import("./fill-teams.post");

function createMockEvent() {
  return { _url: "/api/admin/ko-bracket/fill-teams", context: {} } as any;
}

const baseTournament = {
  id: "t1",
  type: "COMBINATION",
  startTime: new Date("2025-06-01T14:00:00Z"),
  matchDuration: 15,
  breakTime: 5,
};

const knockoutTournament = { ...baseTournament, type: "KNOCKOUT" };

function makePool(id: string, teamsAdvancing: number, standingTeamIds: string[]) {
  return {
    id,
    teamsAdvancing,
    standings: standingTeamIds.map((teamId, i) => ({
      teamId,
      points: 9 - i * 3,
      goalDifference: 0,
      goalsFor: 0,
    })),
  };
}

describe("POST /api/admin/ko-bracket/fill-teams", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMatchUpdate.mockImplementation(async ({ data }: any) => data);
  });

  it("returns 404 when no tournament", async () => {
    mockTournamentFindFirst.mockResolvedValue(null);

    await expect(handler(createMockEvent())).rejects.toThrow("No tournament found");
  });

  it("returns 400 when no KO matches exist", async () => {
    mockTournamentFindFirst.mockResolvedValue(baseTournament);
    mockMatchFindMany.mockResolvedValue([]);
    mockPoolFindMany.mockResolvedValue([makePool("p1", 2, ["t1", "t2"])]);

    await expect(handler(createMockEvent())).rejects.toThrow("No KO matches");
  });

  it("returns 400 when no pools for COMBINATION tournament", async () => {
    mockTournamentFindFirst.mockResolvedValue(baseTournament);
    mockMatchFindMany.mockResolvedValue([{ id: "m1", round: 1 }, { id: "m2", round: 1 }]);
    mockPoolFindMany.mockResolvedValue([]);

    await expect(handler(createMockEvent())).rejects.toThrow("Not enough standings");
  });

  it("fills round-1 matches with teams from pool standings for COMBINATION", async () => {
    mockTournamentFindFirst.mockResolvedValue(baseTournament);
    const round1Matches = [
      { id: "m1", round: 1 },
      { id: "m2", round: 1 },
    ];
    const finalMatch = [{ id: "m3", round: 2 }];
    mockMatchFindMany.mockResolvedValue([...round1Matches, ...finalMatch]);
    mockPoolFindMany.mockResolvedValue([
      makePool("p1", 2, ["teamA", "teamB"]),
      makePool("p2", 2, ["teamC", "teamD"]),
    ]);

    await handler(createMockEvent());

    // 4 qualifiers, 2 round-1 matches → each match gets 2 teams
    expect(mockMatchUpdate).toHaveBeenCalledTimes(2);
    const updateCalls = mockMatchUpdate.mock.calls.map((c) => c[0]);
    const ids = updateCalls.map((c) => c.where.id);
    expect(ids).toContain("m1");
    expect(ids).toContain("m2");
    // Final match (round 2) should not be updated
    expect(ids).not.toContain("m3");
  });

  it("fills round-1 matches with teams for KNOCKOUT tournament", async () => {
    mockTournamentFindFirst.mockResolvedValue(knockoutTournament);
    mockMatchFindMany.mockResolvedValue([
      { id: "m1", round: 1, nextMatchId: "m3" },
      { id: "m2", round: 1, nextMatchId: "m3" },
      { id: "m3", round: 2, nextMatchId: null },
    ]);
    mockTeamFindMany.mockResolvedValue([
      { id: "t1" }, { id: "t2" }, { id: "t3" }, { id: "t4" },
    ]);

    await handler(createMockEvent());

    // 4 teams → bracketSize=4 → no byes → only 2 round-1 updates, no bye propagation
    expect(mockMatchUpdate).toHaveBeenCalledTimes(2);
    const ids = mockMatchUpdate.mock.calls.map((c) => c[0].where.id);
    expect(ids).not.toContain("m3");
  });

  it("auto-advances bye team to next round when participants < bracketSize", async () => {
    // 3 teams → bracketSize=4 → 1 bye (m1 gets only teamA), 1 real match (m2)
    mockTournamentFindFirst.mockResolvedValue(knockoutTournament);
    const round1a = { id: "m1", round: 1, nextMatchId: "m3" };
    const round1b = { id: "m2", round: 1, nextMatchId: "m3" };
    const final = { id: "m3", round: 2, nextMatchId: null };
    // First findMany: all KO matches; second: siblings for bye propagation
    mockMatchFindMany
      .mockResolvedValueOnce([round1a, round1b, final])
      .mockResolvedValueOnce([round1a, round1b]);
    mockTeamFindMany.mockResolvedValue([{ id: "t1" }, { id: "t2" }, { id: "t3" }]);

    await handler(createMockEvent());

    const updateCalls = mockMatchUpdate.mock.calls.map((c) => c[0]);

    // Bye match (m1) must be marked PLAYED
    const byePlayedUpdate = updateCalls.find(
      (c) => c.where.id === "m1" && c.data.status === "PLAYED",
    );
    expect(byePlayedUpdate).toBeDefined();

    // Next-round match (m3) must receive the bye team (t1)
    const nextRoundUpdate = updateCalls.find((c) => c.where.id === "m3");
    expect(nextRoundUpdate).toBeDefined();
    const advancedTeam =
      nextRoundUpdate!.data.teamAId ?? nextRoundUpdate!.data.teamBId;
    expect(advancedTeam).toBe("t1");
  });
});

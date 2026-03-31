import { describe, it, expect, vi, beforeEach } from "vitest";

const mockTournamentFindFirst = vi.hoisted(() => vi.fn());
const mockPoolFindMany = vi.hoisted(() => vi.fn());
const mockTeamFindMany = vi.hoisted(() => vi.fn());
const mockMatchCount = vi.hoisted(() => vi.fn());
const mockMatchDeleteMany = vi.hoisted(() => vi.fn());
const mockMatchCreate = vi.hoisted(() => vi.fn());
const mockFieldFindMany = vi.hoisted(() => vi.fn());

vi.stubGlobal("defineEventHandler", (handler: any) => handler);
vi.stubGlobal("readBody", vi.fn());
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
      count: mockMatchCount,
      deleteMany: mockMatchDeleteMany,
      create: mockMatchCreate,
    },
    field: { findMany: mockFieldFindMany },
  },
}));

vi.mock("~/server/utils/logger", () => ({ logRequest: vi.fn() }));

const { default: handler } = await import("./generate.post");

const baseTournament = {
  id: "t1",
  type: "COMBINATION",
  startTime: new Date("2025-06-01T14:00:00Z"),
  matchDuration: 15,
  breakTime: 5,
};

const knockoutTournament = { ...baseTournament, type: "KNOCKOUT" };

function makePool(id: string, teamsAdvancing: number, teamIds: { teamId: string; points: number }[]) {
  return {
    id,
    teamsAdvancing,
    standings: teamIds.map((t) => ({ teamId: t.teamId, points: t.points, goalDifference: 0, goalsFor: 0 })),
  };
}

function createMockEvent() {
  return { _url: "/api/admin/ko-bracket/generate", context: {} } as any;
}

let idCounter = 0;

describe("POST /api/admin/ko-bracket/generate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    idCounter = 0;
    mockMatchCreate.mockImplementation(async ({ data }: any) => ({ id: String(++idCounter), ...data }));
  });

  it("returns 404 when no tournament", async () => {
    mockTournamentFindFirst.mockResolvedValue(null);
    vi.mocked(readBody).mockResolvedValue({});

    await expect(handler(createMockEvent())).rejects.toThrow("No tournament found");
  });

  it("returns 400 when no pools exist", async () => {
    mockTournamentFindFirst.mockResolvedValue(baseTournament);
    vi.mocked(readBody).mockResolvedValue({});
    mockMatchCount.mockResolvedValue(0);
    mockPoolFindMany.mockResolvedValue([]);
    mockFieldFindMany.mockResolvedValue([{ id: "f1" }]);

    await expect(handler(createMockEvent())).rejects.toThrow("Not enough standings");
  });

  it("returns 400 when no fields available", async () => {
    mockTournamentFindFirst.mockResolvedValue(baseTournament);
    vi.mocked(readBody).mockResolvedValue({});
    mockMatchCount.mockResolvedValue(0);
    mockPoolFindMany.mockResolvedValue([makePool("p10", 2, [{ teamId: "1", points: 3 }, { teamId: "2", points: 0 }])]);
    mockFieldFindMany.mockResolvedValue([]);

    await expect(handler(createMockEvent())).rejects.toThrow("No fields");
  });

  it("returns 409 when KO matches exist without overwrite", async () => {
    mockTournamentFindFirst.mockResolvedValue(baseTournament);
    vi.mocked(readBody).mockResolvedValue({});
    mockMatchCount.mockResolvedValue(2);

    await expect(handler(createMockEvent())).rejects.toThrow("KO matches already exist");
  });

  it("generates 1 match (final only) for 2 qualifiers", async () => {
    mockTournamentFindFirst.mockResolvedValue(baseTournament);
    vi.mocked(readBody).mockResolvedValue({});
    mockMatchCount.mockResolvedValue(0);
    mockPoolFindMany.mockResolvedValue([makePool("p10", 2, [{ teamId: "1", points: 3 }, { teamId: "2", points: 0 }])]);
    mockFieldFindMany.mockResolvedValue([{ id: "f100" }]);

    const result = await handler(createMockEvent());

    // 2 teams → bracketSize=2, round1Count=1, totalRounds=1 → 1 match total
    expect(mockMatchCreate).toHaveBeenCalledTimes(1);
    expect(mockMatchCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ phase: "KO", round: 1, fieldId: "f100" }),
    });
    expect(result).toMatchObject({ generated: 1 });
  });

  it("generates 3 matches for 4 qualifiers (2 round-1 + 1 final)", async () => {
    mockTournamentFindFirst.mockResolvedValue(baseTournament);
    vi.mocked(readBody).mockResolvedValue({});
    mockMatchCount.mockResolvedValue(0);
    mockPoolFindMany.mockResolvedValue([
      makePool("p10", 2, [{ teamId: "1", points: 9 }, { teamId: "2", points: 6 }, { teamId: "5", points: 3 }]),
      makePool("p11", 2, [{ teamId: "3", points: 9 }, { teamId: "4", points: 6 }, { teamId: "6", points: 3 }]),
    ]);
    mockFieldFindMany.mockResolvedValue([{ id: "f100" }, { id: "f101" }]);

    const result = await handler(createMockEvent());

    // 4 teams → bracketSize=4, round1Count=2, totalRounds=2 → 2+1=3 matches
    expect(mockMatchCreate).toHaveBeenCalledTimes(3);
    expect(result).toMatchObject({ generated: 3 });
  });

  it("links round-1 matches to the final via nextMatchId", async () => {
    mockTournamentFindFirst.mockResolvedValue(baseTournament);
    vi.mocked(readBody).mockResolvedValue({});
    mockMatchCount.mockResolvedValue(0);
    mockPoolFindMany.mockResolvedValue([
      makePool("p10", 2, [{ teamId: "1", points: 9 }, { teamId: "2", points: 6 }]),
      makePool("p11", 2, [{ teamId: "3", points: 9 }, { teamId: "4", points: 6 }]),
    ]);
    mockFieldFindMany.mockResolvedValue([{ id: "f100" }]);

    await handler(createMockEvent());

    // Call order: final (round 2, id=1), then round 1 match 1 (id=2), round 1 match 2 (id=3)
    const calls = mockMatchCreate.mock.calls.map((c) => c[0].data);
    const finalCall = calls.find((d) => d.round === 2);
    const round1Calls = calls.filter((d) => d.round === 1);

    expect(finalCall).toBeTruthy();
    expect(round1Calls).toHaveLength(2);
    // Round 1 matches should have nextMatchId = id of final
    expect(round1Calls[0].nextMatchId).toBeDefined();
    expect(round1Calls[1].nextMatchId).toBeDefined();
    expect(round1Calls[0].nextMatchId).toBe(round1Calls[1].nextMatchId); // both link to same final
  });

  it("assigns teams to round 1; later rounds have null teams", async () => {
    mockTournamentFindFirst.mockResolvedValue(baseTournament);
    vi.mocked(readBody).mockResolvedValue({});
    mockMatchCount.mockResolvedValue(0);
    mockPoolFindMany.mockResolvedValue([
      makePool("p10", 2, [{ teamId: "1", points: 9 }, { teamId: "2", points: 6 }]),
      makePool("p11", 2, [{ teamId: "3", points: 9 }, { teamId: "4", points: 6 }]),
    ]);
    mockFieldFindMany.mockResolvedValue([{ id: "f100" }]);

    await handler(createMockEvent());

    const calls = mockMatchCreate.mock.calls.map((c) => c[0].data);
    const finalCall = calls.find((d) => d.round === 2);
    const round1Calls = calls.filter((d) => d.round === 1);

    expect(finalCall?.teamAId).toBeNull();
    expect(finalCall?.teamBId).toBeNull();
    round1Calls.forEach((m) => {
      expect(m.teamAId).not.toBeNull();
    });
  });

  it("generates bye slot (null teamB) for top seed when N has byes", async () => {
    // 3 teams: bracketSize=4, round1Count=2, byes=1
    // Top seed gets bye; remaining 2 paired
    mockTournamentFindFirst.mockResolvedValue(knockoutTournament);
    vi.mocked(readBody).mockResolvedValue({});
    mockMatchCount.mockResolvedValue(0);
    mockTeamFindMany.mockResolvedValue([{ id: "1" }, { id: "2" }, { id: "3" }]);
    mockFieldFindMany.mockResolvedValue([{ id: "f100" }]);

    await handler(createMockEvent());

    const calls = mockMatchCreate.mock.calls.map((c) => c[0].data);
    const round1Calls = calls.filter((d) => d.round === 1);
    const byeMatch = round1Calls.find((m) => m.teamBId === null);
    expect(byeMatch).toBeTruthy();
    expect(byeMatch?.teamAId).toBe("1"); // top seed gets bye
  });

  it("deletes existing KO matches and regenerates when overwrite:true", async () => {
    mockTournamentFindFirst.mockResolvedValue(baseTournament);
    vi.mocked(readBody).mockResolvedValue({ overwrite: true });
    mockMatchCount.mockResolvedValue(1);
    mockMatchDeleteMany.mockResolvedValue({ count: 1 });
    mockPoolFindMany.mockResolvedValue([makePool("p10", 2, [{ teamId: "1", points: 3 }, { teamId: "2", points: 0 }])]);
    mockFieldFindMany.mockResolvedValue([{ id: "f100" }]);

    await handler(createMockEvent());

    expect(mockMatchDeleteMany).toHaveBeenCalled();
    expect(mockMatchCreate).toHaveBeenCalled();
  });

  it("generates KO matches from teams for KNOCKOUT tournament (no pools needed)", async () => {
    mockTournamentFindFirst.mockResolvedValue(knockoutTournament);
    vi.mocked(readBody).mockResolvedValue({});
    mockMatchCount.mockResolvedValue(0);
    mockTeamFindMany.mockResolvedValue([{ id: "1" }, { id: "2" }, { id: "3" }, { id: "4" }]);
    mockFieldFindMany.mockResolvedValue([{ id: "f100" }]);

    const result = await handler(createMockEvent());

    expect(mockPoolFindMany).not.toHaveBeenCalled();
    expect(mockMatchCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ phase: "KO", round: 1 }),
    });
    // 4 teams → 3 total matches (2 round-1 + 1 final)
    expect(result).toMatchObject({ generated: 3 });
  });

  it("returns 400 for KNOCKOUT tournament with fewer than 2 teams", async () => {
    mockTournamentFindFirst.mockResolvedValue(knockoutTournament);
    vi.mocked(readBody).mockResolvedValue({});
    mockMatchCount.mockResolvedValue(0);
    mockTeamFindMany.mockResolvedValue([{ id: "1" }]);
    mockFieldFindMany.mockResolvedValue([{ id: "f100" }]);

    await expect(handler(createMockEvent())).rejects.toThrow("Not enough teams");
  });

  it("uses startDateTime body param as base time when provided", async () => {
    const customStart = "2025-07-15T10:00:00.000Z";
    mockTournamentFindFirst.mockResolvedValue(knockoutTournament);
    vi.mocked(readBody).mockResolvedValue({ startDateTime: customStart });
    mockMatchCount.mockResolvedValue(0);
    mockTeamFindMany.mockResolvedValue([{ id: "1" }, { id: "2" }]);
    mockFieldFindMany.mockResolvedValue([{ id: "f100" }]);

    await handler(createMockEvent());

    const calls = mockMatchCreate.mock.calls.map((c) => c[0].data);
    expect(calls[0].startTime).toEqual(new Date(customStart));
  });

  it("falls back to tournament startTime when startDateTime not provided", async () => {
    mockTournamentFindFirst.mockResolvedValue(knockoutTournament);
    vi.mocked(readBody).mockResolvedValue({});
    mockMatchCount.mockResolvedValue(0);
    mockTeamFindMany.mockResolvedValue([{ id: "1" }, { id: "2" }]);
    mockFieldFindMany.mockResolvedValue([{ id: "f100" }]);

    await handler(createMockEvent());

    const calls = mockMatchCreate.mock.calls.map((c) => c[0].data);
    expect(calls[0].startTime).toEqual(knockoutTournament.startTime);
  });

  it("advances only teamsAdvancing teams per pool", async () => {
    mockTournamentFindFirst.mockResolvedValue(baseTournament);
    vi.mocked(readBody).mockResolvedValue({});
    mockMatchCount.mockResolvedValue(0);
    mockPoolFindMany.mockResolvedValue([
      makePool("p10", 2, [{ teamId: "1", points: 9 }, { teamId: "2", points: 6 }, { teamId: "3", points: 3 }]),
      makePool("p11", 2, [{ teamId: "4", points: 9 }, { teamId: "5", points: 6 }, { teamId: "6", points: 3 }]),
    ]);
    mockFieldFindMany.mockResolvedValue([{ id: "f100" }]);

    const result = await handler(createMockEvent());

    // 4 qualifiers (2 per pool) → bracketSize=4 → 3 total matches
    const round1Calls = mockMatchCreate.mock.calls
      .map((c) => c[0].data)
      .filter((d) => d.round === 1);
    expect(round1Calls).toHaveLength(2);
    // Only teams 1,2,4,5 qualify (not 3 or 6)
    const teamIds = round1Calls.flatMap((m) => [m.teamAId, m.teamBId]).filter(Boolean);
    expect(teamIds).not.toContain("3");
    expect(teamIds).not.toContain("6");
    expect(result).toMatchObject({ generated: 3 });
  });
});

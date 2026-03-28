import { describe, it, expect, vi, beforeEach } from "vitest";

const mockTournamentFindFirst = vi.hoisted(() => vi.fn());
const mockStandingFindMany = vi.hoisted(() => vi.fn());
const mockTeamFindMany = vi.hoisted(() => vi.fn());
const mockMatchCount = vi.hoisted(() => vi.fn());
const mockMatchDeleteMany = vi.hoisted(() => vi.fn());
const mockMatchCreateMany = vi.hoisted(() => vi.fn());
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
    standing: { findMany: mockStandingFindMany },
    team: { findMany: mockTeamFindMany },
    match: {
      count: mockMatchCount,
      deleteMany: mockMatchDeleteMany,
      createMany: mockMatchCreateMany,
    },
    field: { findMany: mockFieldFindMany },
  },
}));

vi.mock("~/server/utils/logger", () => ({ logRequest: vi.fn() }));

const { default: handler } = await import("./generate.post");

const baseTournament = {
  id: 1,
  type: "COMBINATION",
  startTime: new Date("2025-06-01T14:00:00Z"),
  matchDuration: 15,
  breakTime: 5,
};

const knockoutTournament = { ...baseTournament, type: "KNOCKOUT" };

function makeStandings(teams: { teamId: number; points: number }[], poolId = 10) {
  return teams.map((t) => ({ poolId, teamId: t.teamId, points: t.points, goalDifference: 0, goalsFor: 0 }));
}

function createMockEvent() {
  return { _url: "/api/admin/ko-bracket/generate", context: {} } as any;
}

describe("POST /api/admin/ko-bracket/generate", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 404 when no tournament", async () => {
    mockTournamentFindFirst.mockResolvedValue(null);
    vi.mocked(readBody).mockResolvedValue({});

    await expect(handler(createMockEvent())).rejects.toThrow("No tournament found");
  });

  it("returns 400 when no standings exist", async () => {
    mockTournamentFindFirst.mockResolvedValue(baseTournament);
    vi.mocked(readBody).mockResolvedValue({});
    mockMatchCount.mockResolvedValue(0);
    mockStandingFindMany.mockResolvedValue([]);
    mockFieldFindMany.mockResolvedValue([{ id: 1 }]);

    await expect(handler(createMockEvent())).rejects.toThrow("Not enough standings");
  });

  it("returns 400 when no fields available", async () => {
    mockTournamentFindFirst.mockResolvedValue(baseTournament);
    vi.mocked(readBody).mockResolvedValue({});
    mockMatchCount.mockResolvedValue(0);
    mockStandingFindMany.mockResolvedValue(makeStandings([{ teamId: 1, points: 3 }, { teamId: 2, points: 0 }]));
    mockFieldFindMany.mockResolvedValue([]);

    await expect(handler(createMockEvent())).rejects.toThrow("No fields");
  });

  it("returns 409 when KO matches exist without overwrite", async () => {
    mockTournamentFindFirst.mockResolvedValue(baseTournament);
    vi.mocked(readBody).mockResolvedValue({});
    mockMatchCount.mockResolvedValue(2);

    await expect(handler(createMockEvent())).rejects.toThrow("KO matches already exist");
  });

  it("generates KO matches from standings (2 teams → 1 match)", async () => {
    mockTournamentFindFirst.mockResolvedValue(baseTournament);
    vi.mocked(readBody).mockResolvedValue({});
    mockMatchCount.mockResolvedValue(0);
    mockStandingFindMany.mockResolvedValue(
      makeStandings([{ teamId: 1, points: 3 }, { teamId: 2, points: 0 }]),
    );
    mockFieldFindMany.mockResolvedValue([{ id: 100 }]);
    mockMatchCreateMany.mockResolvedValue({ count: 1 });

    const result = await handler(createMockEvent());

    expect(mockMatchCreateMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ phase: "KO", round: 1, fieldId: 100 }),
      ]),
    });
    expect(result).toMatchObject({ generated: 1 });
  });

  it("generates correct number of KO matches for 4 qualifiers (2 matches)", async () => {
    mockTournamentFindFirst.mockResolvedValue(baseTournament);
    vi.mocked(readBody).mockResolvedValue({});
    mockMatchCount.mockResolvedValue(0);
    mockStandingFindMany.mockResolvedValue(
      makeStandings([
        { teamId: 1, points: 9 },
        { teamId: 2, points: 6 },
        { teamId: 3, points: 3 },
        { teamId: 4, points: 0 },
      ]),
    );
    mockFieldFindMany.mockResolvedValue([{ id: 100 }, { id: 101 }]);
    mockMatchCreateMany.mockResolvedValue({ count: 2 });

    const result = await handler(createMockEvent());

    const data = mockMatchCreateMany.mock.calls[0][0].data;
    expect(data).toHaveLength(2);
    expect(result).toMatchObject({ generated: 2 });
  });

  it("deletes existing KO matches and regenerates when overwrite:true", async () => {
    mockTournamentFindFirst.mockResolvedValue(baseTournament);
    vi.mocked(readBody).mockResolvedValue({ overwrite: true });
    mockMatchCount.mockResolvedValue(1);
    mockMatchDeleteMany.mockResolvedValue({ count: 1 });
    mockStandingFindMany.mockResolvedValue(
      makeStandings([{ teamId: 1, points: 3 }, { teamId: 2, points: 0 }]),
    );
    mockFieldFindMany.mockResolvedValue([{ id: 100 }]);
    mockMatchCreateMany.mockResolvedValue({ count: 1 });

    await handler(createMockEvent());

    expect(mockMatchDeleteMany).toHaveBeenCalled();
    expect(mockMatchCreateMany).toHaveBeenCalled();
  });

  it("generates KO matches from teams for KNOCKOUT tournament (no standings needed)", async () => {
    mockTournamentFindFirst.mockResolvedValue(knockoutTournament);
    vi.mocked(readBody).mockResolvedValue({});
    mockMatchCount.mockResolvedValue(0);
    mockTeamFindMany.mockResolvedValue([{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]);
    mockFieldFindMany.mockResolvedValue([{ id: 100 }]);
    mockMatchCreateMany.mockResolvedValue({ count: 2 });

    const result = await handler(createMockEvent());

    expect(mockStandingFindMany).not.toHaveBeenCalled();
    expect(mockMatchCreateMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ phase: "KO", round: 1 }),
      ]),
    });
    expect(result).toMatchObject({ generated: 2 });
  });

  it("returns 400 for KNOCKOUT tournament with fewer than 2 teams", async () => {
    mockTournamentFindFirst.mockResolvedValue(knockoutTournament);
    vi.mocked(readBody).mockResolvedValue({});
    mockMatchCount.mockResolvedValue(0);
    mockTeamFindMany.mockResolvedValue([{ id: 1 }]);
    mockFieldFindMany.mockResolvedValue([{ id: 100 }]);

    await expect(handler(createMockEvent())).rejects.toThrow("Not enough teams");
  });
});

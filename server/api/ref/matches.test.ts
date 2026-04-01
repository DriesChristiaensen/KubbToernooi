import { describe, it, expect, vi, beforeEach } from "vitest";

const mockMatchFindMany = vi.hoisted(() => vi.fn());
const mockMatchFindFirst = vi.hoisted(() => vi.fn());
const mockMatchUpdate = vi.hoisted(() => vi.fn());
const mockMatchCreateMany = vi.hoisted(() => vi.fn());
const mockTournamentFindFirst = vi.hoisted(() => vi.fn());
const mockFieldFindMany = vi.hoisted(() => vi.fn());

vi.stubGlobal("defineEventHandler", (handler: any) => handler);
vi.stubGlobal("readBody", vi.fn());
vi.stubGlobal("getRouterParam", vi.fn());
vi.stubGlobal("createApiError", ({ error, code, reason }: any) => {
  const err = new Error(reason) as any;
  err.statusCode = code;
  err.data = { error, code, reason, stacktrace: {} };
  return err;
});

vi.mock("~/server/utils/prisma", () => ({
  prisma: {
    match: {
      findMany: mockMatchFindMany,
      findFirst: mockMatchFindFirst,
      update: mockMatchUpdate,
      createMany: mockMatchCreateMany,
    },
    tournament: {
      findFirst: mockTournamentFindFirst,
    },
    field: {
      findMany: mockFieldFindMany,
    },
  },
}));

vi.mock("~/server/utils/logger", () => ({
  logRequest: vi.fn(),
}));

const { default: getMatchesHandler } = await import("./matches.get");
const { default: patchMatchHandler } = await import("./matches/[id].patch");

function createMockEvent(overrides: any = {}) {
  return {
    _url: "http://localhost/api/ref/matches",
    context: {},
    ...overrides,
  } as any;
}

const mockMatch = {
  id: "m1",
  phase: "POOL",
  round: 1,
  startTime: new Date("2025-06-01T10:00:00Z"),
  status: "SCHEDULED",
  fieldId: "f1",
  teamAId: "t1",
  teamBId: "t2",
  scoreA: null,
  scoreB: null,
  koWinnerId: null,
  field: { id: "f1", name: "Veld 1" },
  teamA: { id: "t1", name: "Team A" },
  teamB: { id: "t2", name: "Team B" },
  koWinner: null,
};

describe("GET /api/ref/matches", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 404 when no tournament exists", async () => {
    mockTournamentFindFirst.mockResolvedValue(null);

    await expect(getMatchesHandler(createMockEvent())).rejects.toThrow(
      "No tournament found",
    );
  });

  it("returns list of matches for active tournament", async () => {
    mockTournamentFindFirst.mockResolvedValue({ id: "t1" });
    mockMatchFindMany.mockResolvedValue([mockMatch]);

    const result = await getMatchesHandler(createMockEvent());

    expect(mockMatchFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          field: { tournamentId: "t1" },
          teamAId: { not: null },
          teamBId: { not: null },
        },
      }),
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: "m1", phase: "POOL" });
  });
});

describe("PATCH /api/ref/matches/:id", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 for invalid ID", async () => {
    vi.mocked(getRouterParam).mockReturnValue("");

    await expect(patchMatchHandler(createMockEvent())).rejects.toThrow(
      "Invalid match ID",
    );
  });

  it("returns 404 when match not found", async () => {
    vi.mocked(getRouterParam).mockReturnValue("m1");
    vi.mocked(readBody).mockResolvedValue({ scoreA: 2, scoreB: 1 });
    mockMatchFindFirst.mockResolvedValue(null);

    await expect(patchMatchHandler(createMockEvent())).rejects.toThrow(
      "Match not found",
    );
  });

  it("returns 400 for negative scoreA", async () => {
    vi.mocked(getRouterParam).mockReturnValue("m1");
    vi.mocked(readBody).mockResolvedValue({ scoreA: -1, scoreB: 0 });
    mockMatchFindFirst.mockResolvedValue(mockMatch);

    await expect(patchMatchHandler(createMockEvent())).rejects.toThrow(
      "Invalid score",
    );
  });

  it("returns 400 for negative scoreB", async () => {
    vi.mocked(getRouterParam).mockReturnValue("m1");
    vi.mocked(readBody).mockResolvedValue({ scoreA: 0, scoreB: -1 });
    mockMatchFindFirst.mockResolvedValue(mockMatch);

    await expect(patchMatchHandler(createMockEvent())).rejects.toThrow(
      "Invalid score",
    );
  });

  it("saves score for pool match allowing draw", async () => {
    vi.mocked(getRouterParam).mockReturnValue("m1");
    vi.mocked(readBody).mockResolvedValue({ scoreA: 1, scoreB: 1 });
    mockMatchFindFirst.mockResolvedValue({ ...mockMatch, phase: "POOL" });
    mockMatchUpdate.mockResolvedValue({
      ...mockMatch,
      scoreA: 1,
      scoreB: 1,
      status: "PLAYED",
    });

    const result = await patchMatchHandler(createMockEvent());

    expect(mockMatchUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ scoreA: 1, scoreB: 1, status: "PLAYED" }),
      }),
    );
    expect(result).toMatchObject({ scoreA: 1, scoreB: 1, status: "PLAYED" });
  });

  it("returns 400 for KO draw without koWinnerId", async () => {
    vi.mocked(getRouterParam).mockReturnValue("m1");
    vi.mocked(readBody).mockResolvedValue({ scoreA: 2, scoreB: 2 });
    mockMatchFindFirst.mockResolvedValue({ ...mockMatch, phase: "KO" });

    await expect(patchMatchHandler(createMockEvent())).rejects.toThrow(
      "KO winner required on draw",
    );
  });

  it("returns 400 for KO draw with invalid koWinnerId", async () => {
    vi.mocked(getRouterParam).mockReturnValue("m1");
    vi.mocked(readBody).mockResolvedValue({ scoreA: 2, scoreB: 2, koWinnerId: "t99" });
    mockMatchFindFirst.mockResolvedValue({ ...mockMatch, phase: "KO", teamAId: "t1", teamBId: "t2" });

    await expect(patchMatchHandler(createMockEvent())).rejects.toThrow(
      "Invalid KO winner",
    );
  });

  it("saves score for KO match with clear winner", async () => {
    vi.mocked(getRouterParam).mockReturnValue("m1");
    vi.mocked(readBody).mockResolvedValue({ scoreA: 3, scoreB: 1 });
    mockMatchFindFirst.mockResolvedValue({ ...mockMatch, phase: "KO" });
    const updatedMatch = { ...mockMatch, phase: "KO", scoreA: 3, scoreB: 1, status: "PLAYED" };
    mockMatchUpdate.mockResolvedValue(updatedMatch);
    mockMatchFindMany.mockResolvedValue([updatedMatch]);

    const result = await patchMatchHandler(createMockEvent());

    expect(mockMatchUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ scoreA: 3, scoreB: 1, status: "PLAYED" }),
      }),
    );
    expect(result).toMatchObject({ scoreA: 3, scoreB: 1 });
  });

  it("saves score for KO draw with valid koWinnerId", async () => {
    vi.mocked(getRouterParam).mockReturnValue("m1");
    vi.mocked(readBody).mockResolvedValue({ scoreA: 2, scoreB: 2, koWinnerId: "t1" });
    mockMatchFindFirst.mockResolvedValue({ ...mockMatch, phase: "KO", teamAId: "t1", teamBId: "t2" });
    const updatedMatch = { ...mockMatch, phase: "KO", scoreA: 2, scoreB: 2, koWinnerId: "t1", status: "PLAYED" };
    mockMatchUpdate.mockResolvedValue(updatedMatch);
    mockMatchFindMany.mockResolvedValue([updatedMatch]);

    const result = await patchMatchHandler(createMockEvent());

    expect(mockMatchUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ koWinnerId: "t1", status: "PLAYED" }),
      }),
    );
    expect(result).toMatchObject({ koWinnerId: "t1" });
  });

  it("updates teamA of next match when current match is first sibling", async () => {
    vi.mocked(getRouterParam).mockReturnValue("m1");
    vi.mocked(readBody).mockResolvedValue({ scoreA: 3, scoreB: 1 });
    const match = { ...mockMatch, id: "m1", phase: "KO", round: 1, teamAId: "t10", teamBId: "t20", nextMatchId: "m5" };
    mockMatchFindFirst.mockResolvedValue(match);
    const updatedMatch = { ...match, scoreA: 3, scoreB: 1, status: "PLAYED" };
    mockMatchUpdate.mockResolvedValue(updatedMatch);
    // Sibling query: only current match links to nextMatchId m5
    mockMatchFindMany.mockResolvedValue([match]);

    await patchMatchHandler(createMockEvent());

    expect(mockMatchUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "m5" },
        data: expect.objectContaining({ teamAId: "t10" }),
      }),
    );
  });

  it("updates teamB of next match when current match is second sibling", async () => {
    vi.mocked(getRouterParam).mockReturnValue("m2");
    vi.mocked(readBody).mockResolvedValue({ scoreA: 0, scoreB: 3 });
    const match1 = { ...mockMatch, id: "m1", phase: "KO", round: 1, teamAId: "t10", teamBId: "t20", nextMatchId: "m5" };
    const match2 = { ...mockMatch, id: "m2", phase: "KO", round: 1, teamAId: "t30", teamBId: "t40", nextMatchId: "m5" };
    mockMatchFindFirst.mockResolvedValue(match2);
    const updatedMatch2 = { ...match2, scoreA: 0, scoreB: 3, status: "PLAYED" };
    mockMatchUpdate.mockResolvedValue(updatedMatch2);
    // Both siblings present; match2 is second (higher id)
    mockMatchFindMany.mockResolvedValue([match1, match2]);

    await patchMatchHandler(createMockEvent());

    expect(mockMatchUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "m5" },
        data: expect.objectContaining({ teamBId: "t40" }),
      }),
    );
  });

  it("does not update next match when nextMatchId is null", async () => {
    vi.mocked(getRouterParam).mockReturnValue("m1");
    vi.mocked(readBody).mockResolvedValue({ scoreA: 3, scoreB: 1 });
    const match = { ...mockMatch, id: "m1", phase: "KO", round: 1, teamAId: "t10", teamBId: "t20" };
    mockMatchFindFirst.mockResolvedValue(match);
    const updatedMatch = { ...match, scoreA: 3, scoreB: 1, status: "PLAYED" };
    mockMatchUpdate.mockResolvedValue(updatedMatch);

    await patchMatchHandler(createMockEvent());

    // Only one update call (the score update); no nextMatch update
    expect(mockMatchUpdate).toHaveBeenCalledTimes(1);
    expect(mockMatchFindMany).not.toHaveBeenCalled();
  });
});

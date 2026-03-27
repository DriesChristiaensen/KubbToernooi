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
const { default: patchMatchHandler } = await import("./matches.[id].patch");

function createMockEvent(overrides: any = {}) {
  return {
    _url: "http://localhost/api/ref/matches",
    context: {},
    ...overrides,
  } as any;
}

const mockMatch = {
  id: 1,
  phase: "POOL",
  round: 1,
  startTime: new Date("2025-06-01T10:00:00Z"),
  status: "SCHEDULED",
  fieldId: 1,
  teamAId: 1,
  teamBId: 2,
  scoreA: null,
  scoreB: null,
  koWinnerId: null,
  field: { id: 1, name: "Veld 1" },
  teamA: { id: 1, name: "Team A" },
  teamB: { id: 2, name: "Team B" },
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
    mockTournamentFindFirst.mockResolvedValue({ id: 1 });
    mockMatchFindMany.mockResolvedValue([mockMatch]);

    const result = await getMatchesHandler(createMockEvent());

    expect(mockMatchFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { field: { tournamentId: 1 } } }),
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: 1, phase: "POOL" });
  });
});

describe("PATCH /api/ref/matches/:id", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 for invalid ID", async () => {
    vi.mocked(getRouterParam).mockReturnValue("abc");

    await expect(patchMatchHandler(createMockEvent())).rejects.toThrow(
      "Invalid match ID",
    );
  });

  it("returns 404 when match not found", async () => {
    vi.mocked(getRouterParam).mockReturnValue("1");
    vi.mocked(readBody).mockResolvedValue({ scoreA: 2, scoreB: 1 });
    mockMatchFindFirst.mockResolvedValue(null);

    await expect(patchMatchHandler(createMockEvent())).rejects.toThrow(
      "Match not found",
    );
  });

  it("returns 400 for negative scoreA", async () => {
    vi.mocked(getRouterParam).mockReturnValue("1");
    vi.mocked(readBody).mockResolvedValue({ scoreA: -1, scoreB: 0 });
    mockMatchFindFirst.mockResolvedValue(mockMatch);

    await expect(patchMatchHandler(createMockEvent())).rejects.toThrow(
      "Invalid score",
    );
  });

  it("returns 400 for negative scoreB", async () => {
    vi.mocked(getRouterParam).mockReturnValue("1");
    vi.mocked(readBody).mockResolvedValue({ scoreA: 0, scoreB: -1 });
    mockMatchFindFirst.mockResolvedValue(mockMatch);

    await expect(patchMatchHandler(createMockEvent())).rejects.toThrow(
      "Invalid score",
    );
  });

  it("saves score for pool match allowing draw", async () => {
    vi.mocked(getRouterParam).mockReturnValue("1");
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
    vi.mocked(getRouterParam).mockReturnValue("1");
    vi.mocked(readBody).mockResolvedValue({ scoreA: 2, scoreB: 2 });
    mockMatchFindFirst.mockResolvedValue({ ...mockMatch, phase: "KO" });

    await expect(patchMatchHandler(createMockEvent())).rejects.toThrow(
      "KO winner required on draw",
    );
  });

  it("returns 400 for KO draw with invalid koWinnerId", async () => {
    vi.mocked(getRouterParam).mockReturnValue("1");
    vi.mocked(readBody).mockResolvedValue({ scoreA: 2, scoreB: 2, koWinnerId: 99 });
    mockMatchFindFirst.mockResolvedValue({ ...mockMatch, phase: "KO", teamAId: 1, teamBId: 2 });

    await expect(patchMatchHandler(createMockEvent())).rejects.toThrow(
      "Invalid KO winner",
    );
  });

  it("saves score for KO match with clear winner", async () => {
    vi.mocked(getRouterParam).mockReturnValue("1");
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
    vi.mocked(getRouterParam).mockReturnValue("1");
    vi.mocked(readBody).mockResolvedValue({ scoreA: 2, scoreB: 2, koWinnerId: 1 });
    mockMatchFindFirst.mockResolvedValue({ ...mockMatch, phase: "KO", teamAId: 1, teamBId: 2 });
    const updatedMatch = { ...mockMatch, phase: "KO", scoreA: 2, scoreB: 2, koWinnerId: 1, status: "PLAYED" };
    mockMatchUpdate.mockResolvedValue(updatedMatch);
    mockMatchFindMany.mockResolvedValue([updatedMatch]);

    const result = await patchMatchHandler(createMockEvent());

    expect(mockMatchUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ koWinnerId: 1, status: "PLAYED" }),
      }),
    );
    expect(result).toMatchObject({ koWinnerId: 1 });
  });

  it("generates next KO round when all round-1 matches are played", async () => {
    vi.mocked(getRouterParam).mockReturnValue("2");
    vi.mocked(readBody).mockResolvedValue({ scoreA: 2, scoreB: 0 });
    const match1 = { ...mockMatch, id: 1, phase: "KO", round: 1, teamAId: 10, teamBId: 20, scoreA: 3, scoreB: 1, status: "PLAYED", fieldId: 100 };
    const match2 = { ...mockMatch, id: 2, phase: "KO", round: 1, teamAId: 30, teamBId: 40, status: "SCHEDULED", fieldId: 101 };
    mockMatchFindFirst.mockResolvedValue(match2);
    const updatedMatch2 = { ...match2, scoreA: 2, scoreB: 0, status: "PLAYED" };
    mockMatchUpdate.mockResolvedValue(updatedMatch2);
    mockMatchFindMany.mockResolvedValue([match1, updatedMatch2]);
    mockTournamentFindFirst.mockResolvedValue({ id: 1, startTime: new Date("2025-06-01T14:00:00Z"), matchDuration: 15, breakTime: 5 });
    mockMatchCreateMany.mockResolvedValue({ count: 1 });

    await patchMatchHandler(createMockEvent());

    expect(mockMatchCreateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ phase: "KO", round: 2, teamAId: 10, teamBId: 30 }),
        ]),
      }),
    );
  });
});

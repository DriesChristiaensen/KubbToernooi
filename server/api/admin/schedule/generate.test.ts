import { describe, it, expect, vi, beforeEach } from "vitest";

const mockTournamentFindFirst = vi.hoisted(() => vi.fn());
const mockPoolFindMany = vi.hoisted(() => vi.fn());
const mockFieldFindMany = vi.hoisted(() => vi.fn());
const mockMatchCount = vi.hoisted(() => vi.fn());
const mockMatchCreateMany = vi.hoisted(() => vi.fn());
const mockMatchDeleteMany = vi.hoisted(() => vi.fn());

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
    field: { findMany: mockFieldFindMany },
    match: {
      count: mockMatchCount,
      createMany: mockMatchCreateMany,
      deleteMany: mockMatchDeleteMany,
    },
  },
}));

vi.mock("~/server/utils/logger", () => ({ logRequest: vi.fn() }));

const { default: handler } = await import("./generate.post");

const baseTournament = {
  id: 1,
  startTime: new Date("2025-06-01T09:00:00Z"),
  matchDuration: 15,
  breakTime: 5,
};

const twoTeamPool = {
  id: 10,
  poolTeams: [{ teamId: 1 }, { teamId: 2 }],
};

const fourTeamPool = {
  id: 10,
  poolTeams: [{ teamId: 1 }, { teamId: 2 }, { teamId: 3 }, { teamId: 4 }],
};

const oneField = [{ id: 100 }];
const twoFields = [{ id: 100 }, { id: 101 }];

function createMockEvent() {
  return { _url: "/api/admin/schedule/generate", context: {} } as any;
}

describe("POST /api/admin/schedule/generate", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 404 when no tournament exists", async () => {
    mockTournamentFindFirst.mockResolvedValue(null);
    vi.mocked(readBody).mockResolvedValue({});

    await expect(handler(createMockEvent())).rejects.toThrow("No tournament found");
  });

  it("returns 400 when no pools exist", async () => {
    mockTournamentFindFirst.mockResolvedValue(baseTournament);
    vi.mocked(readBody).mockResolvedValue({});
    mockPoolFindMany.mockResolvedValue([]);
    mockFieldFindMany.mockResolvedValue(oneField);
    mockMatchCount.mockResolvedValue(0);

    await expect(handler(createMockEvent())).rejects.toThrow("No pools exist");
  });

  it("returns 400 when no fields exist", async () => {
    mockTournamentFindFirst.mockResolvedValue(baseTournament);
    vi.mocked(readBody).mockResolvedValue({});
    mockPoolFindMany.mockResolvedValue([twoTeamPool]);
    mockFieldFindMany.mockResolvedValue([]);
    mockMatchCount.mockResolvedValue(0);

    await expect(handler(createMockEvent())).rejects.toThrow("No fields exist");
  });

  it("returns 409 when matches already exist without overwrite", async () => {
    mockTournamentFindFirst.mockResolvedValue(baseTournament);
    vi.mocked(readBody).mockResolvedValue({});
    mockMatchCount.mockResolvedValue(3);

    await expect(handler(createMockEvent())).rejects.toThrow("Matches already exist");
  });

  it("generates 1 match for a 2-team pool with 1 field", async () => {
    mockTournamentFindFirst.mockResolvedValue(baseTournament);
    vi.mocked(readBody).mockResolvedValue({});
    mockMatchCount.mockResolvedValue(0);
    mockPoolFindMany.mockResolvedValue([twoTeamPool]);
    mockFieldFindMany.mockResolvedValue(oneField);
    mockMatchCreateMany.mockResolvedValue({ count: 1 });

    const result = await handler(createMockEvent());

    expect(mockMatchCreateMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          phase: "POOL",
          fieldId: 100,
          poolId: 10,
          status: "SCHEDULED",
        }),
      ]),
    });
    expect(result).toMatchObject({ generated: 1 });
  });

  it("generates 6 matches for a 4-team pool (full round-robin)", async () => {
    mockTournamentFindFirst.mockResolvedValue(baseTournament);
    vi.mocked(readBody).mockResolvedValue({});
    mockMatchCount.mockResolvedValue(0);
    mockPoolFindMany.mockResolvedValue([fourTeamPool]);
    mockFieldFindMany.mockResolvedValue(twoFields);
    mockMatchCreateMany.mockResolvedValue({ count: 6 });

    const result = await handler(createMockEvent());

    const callData = mockMatchCreateMany.mock.calls[0][0].data;
    expect(callData).toHaveLength(6);
    expect(result).toMatchObject({ generated: 6 });
  });

  it("deletes existing matches and regenerates when overwrite:true", async () => {
    mockTournamentFindFirst.mockResolvedValue(baseTournament);
    vi.mocked(readBody).mockResolvedValue({ overwrite: true });
    mockMatchCount.mockResolvedValue(2);
    mockMatchDeleteMany.mockResolvedValue({ count: 2 });
    mockPoolFindMany.mockResolvedValue([twoTeamPool]);
    mockFieldFindMany.mockResolvedValue(oneField);
    mockMatchCreateMany.mockResolvedValue({ count: 1 });

    const result = await handler(createMockEvent());

    expect(mockMatchDeleteMany).toHaveBeenCalled();
    expect(result).toMatchObject({ generated: 1 });
  });

  it("schedules matches with correct start times across multiple slots", async () => {
    mockTournamentFindFirst.mockResolvedValue(baseTournament);
    vi.mocked(readBody).mockResolvedValue({});
    mockMatchCount.mockResolvedValue(0);
    mockPoolFindMany.mockResolvedValue([fourTeamPool]);
    mockFieldFindMany.mockResolvedValue(oneField);
    mockMatchCreateMany.mockResolvedValue({ count: 6 });

    await handler(createMockEvent());

    const data: any[] = mockMatchCreateMany.mock.calls[0][0].data;
    const times = [...new Set(data.map((m) => m.startTime.toISOString()))];
    expect(times.length).toBeGreaterThanOrEqual(3);
  });
});

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
  id: "t1",
  startTime: new Date("2025-06-01T09:00:00Z"),
  matchDuration: 15,
  breakTime: 5,
};

const twoTeamPool = {
  id: "p10",
  poolTeams: [{ teamId: "t1" }, { teamId: "t2" }],
};

const fourTeamPool = {
  id: "p10",
  poolTeams: [{ teamId: "t1" }, { teamId: "t2" }, { teamId: "t3" }, { teamId: "t4" }],
};

const oneField = [{ id: "f100" }];
const twoFields = [{ id: "f100" }, { id: "f101" }];

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
          fieldId: "f100",
          poolId: "p10",
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

  it("uses startDateTime body param as base time when provided", async () => {
    const customStart = "2025-07-15T08:30:00.000Z";
    mockTournamentFindFirst.mockResolvedValue(baseTournament);
    vi.mocked(readBody).mockResolvedValue({ startDateTime: customStart });
    mockMatchCount.mockResolvedValue(0);
    mockPoolFindMany.mockResolvedValue([twoTeamPool]);
    mockFieldFindMany.mockResolvedValue(oneField);
    mockMatchCreateMany.mockResolvedValue({ count: 1 });

    await handler(createMockEvent());

    const data: any[] = mockMatchCreateMany.mock.calls[0][0].data;
    expect(data[0].startTime).toEqual(new Date(customStart));
  });

  it("falls back to tournament startTime when startDateTime not provided", async () => {
    mockTournamentFindFirst.mockResolvedValue(baseTournament);
    vi.mocked(readBody).mockResolvedValue({});
    mockMatchCount.mockResolvedValue(0);
    mockPoolFindMany.mockResolvedValue([twoTeamPool]);
    mockFieldFindMany.mockResolvedValue(oneField);
    mockMatchCreateMany.mockResolvedValue({ count: 1 });

    await handler(createMockEvent());

    const data: any[] = mockMatchCreateMany.mock.calls[0][0].data;
    expect(data[0].startTime).toEqual(baseTournament.startTime);
  });

  it("balances pool completion ratios for unequal pools (T19)", async () => {
    // Pool A: 4 teams → 6 matches. Pool B: 6 teams → 15 matches. 4 fields.
    const poolA = { id: "pA", poolTeams: [{ teamId: "a1" }, { teamId: "a2" }, { teamId: "a3" }, { teamId: "a4" }] };
    const poolB = { id: "pB", poolTeams: [{ teamId: "b1" }, { teamId: "b2" }, { teamId: "b3" }, { teamId: "b4" }, { teamId: "b5" }, { teamId: "b6" }] };
    const fourFields = [{ id: "f1" }, { id: "f2" }, { id: "f3" }, { id: "f4" }];

    mockTournamentFindFirst.mockResolvedValue(baseTournament);
    vi.mocked(readBody).mockResolvedValue({});
    mockMatchCount.mockResolvedValue(0);
    mockPoolFindMany.mockResolvedValue([poolA, poolB]);
    mockFieldFindMany.mockResolvedValue(fourFields);
    mockMatchCreateMany.mockResolvedValue({ count: 21 });

    await handler(createMockEvent());

    const data: any[] = mockMatchCreateMany.mock.calls[0][0].data;
    expect(data).toHaveLength(21);

    // At any point in the schedule, Pool A and Pool B should be close in completion ratio.
    // Verify by checking that Pool A's matches are spread across the full schedule window
    // rather than all bunched at the start.
    const poolAData = data.filter((m: any) => m.poolId === "pA");
    const poolBData = data.filter((m: any) => m.poolId === "pB");
    expect(poolAData).toHaveLength(6);
    expect(poolBData).toHaveLength(15);

    // Key property: Pool A (smaller) should NOT finish all its matches before Pool B
    // reaches its later rounds. With priority-queue scheduling, Pool A's rounds are
    // interleaved proportionally, so Pool A must have at least one match in the last
    // third of unique time slots.
    const allTimes = [...new Set(data.map((m: any) => m.startTime.getTime()))].sort((a, b) => a - b);
    const lastThirdStart = allTimes[Math.floor(allTimes.length * 0.6)];
    const poolAInLastThird = poolAData.filter((m: any) => m.startTime.getTime() >= lastThirdStart).length;
    expect(poolAInLastThird).toBeGreaterThanOrEqual(1);
  });

  it("allows round mixing when sufficient fields are available (T7.2)", async () => {
    const poolA = { id: "pA", poolTeams: [{ teamId: "a1" }, { teamId: "a2" }, { teamId: "a3" }, { teamId: "a4" }] };
    const poolB = { id: "pB", poolTeams: [{ teamId: "b1" }, { teamId: "b2" }, { teamId: "b3" }, { teamId: "b4" }] };
    const poolC = { id: "pC", poolTeams: [{ teamId: "c1" }, { teamId: "c2" }, { teamId: "c3" }, { teamId: "c4" }] };
    const fourFields = [{ id: "f1" }, { id: "f2" }, { id: "f3" }, { id: "f4" }];

    mockTournamentFindFirst.mockResolvedValue(baseTournament);
    vi.mocked(readBody).mockResolvedValue({});
    mockMatchCount.mockResolvedValue(0);
    mockPoolFindMany.mockResolvedValue([poolA, poolB, poolC]);
    mockFieldFindMany.mockResolvedValue(fourFields);
    mockMatchCreateMany.mockResolvedValue({ count: 18 });

    await handler(createMockEvent());

    const data: any[] = mockMatchCreateMany.mock.calls[0][0].data;
    expect(data).toHaveLength(18);

    // Group matches by start time and verify round mixing occurs
    const byTime = new Map<string, number[]>();
    for (const m of data) {
      const t = m.startTime.toISOString();
      byTime.set(t, [...(byTime.get(t) ?? []), m.round]);
    }
    const hasMixedSlot = [...byTime.values()].some((rounds) => new Set(rounds).size > 1);
    expect(hasMixedSlot).toBe(true);
  });
});

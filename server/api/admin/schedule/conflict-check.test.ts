import { describe, it, expect, vi, beforeEach } from "vitest";

const mockTournamentFindFirst = vi.hoisted(() => vi.fn());
const mockMatchFindUnique = vi.hoisted(() => vi.fn());
const mockMatchFindMany = vi.hoisted(() => vi.fn());

vi.stubGlobal("defineEventHandler", (handler: any) => handler);
vi.stubGlobal("getQuery", vi.fn());
vi.stubGlobal("createApiError", ({ error, code, reason }: any) => {
  const err = new Error(reason) as any;
  err.statusCode = code;
  err.data = { error, code, reason, stacktrace: {} };
  return err;
});

vi.mock("~/server/utils/prisma", () => ({
  prisma: {
    tournament: { findFirst: mockTournamentFindFirst },
    match: {
      findUnique: mockMatchFindUnique,
      findMany: mockMatchFindMany,
    },
  },
}));

const { default: handler } = await import("./conflict-check.get");

const baseTournament = { id: "t1" };
const slotTime = "2025-06-01T09:00:00.000Z";

function createMockEvent() {
  return { _url: "/api/admin/schedule/conflict-check", context: {} } as any;
}

describe("GET /api/admin/schedule/conflict-check", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 when matchId is missing", async () => {
    mockTournamentFindFirst.mockResolvedValue(baseTournament);
    vi.mocked(getQuery).mockReturnValue({ fieldId: "f2", startTime: slotTime });

    await expect(handler(createMockEvent())).rejects.toThrow("matchId is required");
  });

  it("returns 404 when match not found", async () => {
    mockTournamentFindFirst.mockResolvedValue(baseTournament);
    vi.mocked(getQuery).mockReturnValue({ matchId: "m999", fieldId: "f2", startTime: slotTime });
    mockMatchFindUnique.mockResolvedValue(null);

    await expect(handler(createMockEvent())).rejects.toThrow("Match not found");
  });

  it("returns ok:true when no conflicts", async () => {
    mockTournamentFindFirst.mockResolvedValue(baseTournament);
    vi.mocked(getQuery).mockReturnValue({ matchId: "m1", fieldId: "f2", startTime: slotTime });
    mockMatchFindUnique.mockResolvedValue({
      id: "m1", fieldId: "f1", startTime: new Date(slotTime), teamAId: "t10", teamBId: "t20",
    });
    mockMatchFindMany.mockResolvedValue([]);

    const result = await handler(createMockEvent());

    expect(result).toMatchObject({ ok: true, conflicts: [] });
  });

  it("returns field conflict when another match uses the same field at that time", async () => {
    mockTournamentFindFirst.mockResolvedValue(baseTournament);
    vi.mocked(getQuery).mockReturnValue({ matchId: "m1", fieldId: "f2", startTime: slotTime });
    mockMatchFindUnique.mockResolvedValue({
      id: "m1", fieldId: "f1", startTime: new Date(slotTime), teamAId: "t10", teamBId: "t20",
    });
    mockMatchFindMany.mockResolvedValue([
      { id: "m5", fieldId: "f2", teamAId: "t30", teamBId: "t40" },
    ]);

    const result = await handler(createMockEvent());

    expect(result.ok).toBe(false);
    expect(result.conflicts.length).toBeGreaterThan(0);
  });

  it("returns team conflict when teamA plays another match at that time", async () => {
    mockTournamentFindFirst.mockResolvedValue(baseTournament);
    vi.mocked(getQuery).mockReturnValue({ matchId: "m1", fieldId: "f2", startTime: slotTime });
    mockMatchFindUnique.mockResolvedValue({
      id: "m1", fieldId: "f1", startTime: new Date(slotTime), teamAId: "t10", teamBId: "t20",
    });
    mockMatchFindMany.mockResolvedValue([
      { id: "m5", fieldId: "f3", teamAId: "t10", teamBId: "t40" },
    ]);

    const result = await handler(createMockEvent());

    expect(result.ok).toBe(false);
  });

  it("does not flag team conflict when both null teamBIds would match (bye slots)", async () => {
    mockTournamentFindFirst.mockResolvedValue(baseTournament);
    vi.mocked(getQuery).mockReturnValue({ matchId: "m1", startTime: slotTime });
    // Bye match: teamBId is null
    mockMatchFindUnique.mockResolvedValue({
      id: "m1", fieldId: "f1", startTime: new Date(slotTime), teamAId: "t10", teamBId: null,
      teamA: { name: "Team A" }, teamB: null,
    });
    // Another empty KO slot at same time with both null teams
    mockMatchFindMany.mockResolvedValue([
      { id: "m5", fieldId: "f2", teamAId: null, teamBId: null, field: { name: "f2" }, teamA: null, teamB: null },
    ]);

    const result = await handler(createMockEvent());

    expect(result.ok).toBe(true);
  });

  it("excludes the match itself from conflict checks", async () => {
    mockTournamentFindFirst.mockResolvedValue(baseTournament);
    vi.mocked(getQuery).mockReturnValue({ matchId: "m1", fieldId: "f2", startTime: slotTime });
    mockMatchFindUnique.mockResolvedValue({
      id: "m1", fieldId: "f2", startTime: new Date(slotTime), teamAId: "t10", teamBId: "t20",
    });
    mockMatchFindMany.mockResolvedValue([]);

    const result = await handler(createMockEvent());

    expect(result.ok).toBe(true);
  });
});

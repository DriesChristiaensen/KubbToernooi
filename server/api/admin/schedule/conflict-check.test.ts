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

const baseTournament = { id: 1 };
const slotTime = "2025-06-01T09:00:00.000Z";

function createMockEvent() {
  return { _url: "/api/admin/schedule/conflict-check", context: {} } as any;
}

describe("GET /api/admin/schedule/conflict-check", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 when matchId is missing", async () => {
    mockTournamentFindFirst.mockResolvedValue(baseTournament);
    vi.mocked(getQuery).mockReturnValue({ fieldId: "2", startTime: slotTime });

    await expect(handler(createMockEvent())).rejects.toThrow("matchId is required");
  });

  it("returns 404 when match not found", async () => {
    mockTournamentFindFirst.mockResolvedValue(baseTournament);
    vi.mocked(getQuery).mockReturnValue({ matchId: "999", fieldId: "2", startTime: slotTime });
    mockMatchFindUnique.mockResolvedValue(null);

    await expect(handler(createMockEvent())).rejects.toThrow("Match not found");
  });

  it("returns ok:true when no conflicts", async () => {
    mockTournamentFindFirst.mockResolvedValue(baseTournament);
    vi.mocked(getQuery).mockReturnValue({ matchId: "1", fieldId: "2", startTime: slotTime });
    mockMatchFindUnique.mockResolvedValue({
      id: 1, fieldId: 1, startTime: new Date(slotTime), teamAId: 10, teamBId: 20,
    });
    mockMatchFindMany.mockResolvedValue([]);

    const result = await handler(createMockEvent());

    expect(result).toMatchObject({ ok: true, conflicts: [] });
  });

  it("returns field conflict when another match uses the same field at that time", async () => {
    mockTournamentFindFirst.mockResolvedValue(baseTournament);
    vi.mocked(getQuery).mockReturnValue({ matchId: "1", fieldId: "2", startTime: slotTime });
    mockMatchFindUnique.mockResolvedValue({
      id: 1, fieldId: 1, startTime: new Date(slotTime), teamAId: 10, teamBId: 20,
    });
    mockMatchFindMany.mockResolvedValue([
      { id: 5, fieldId: 2, teamAId: 30, teamBId: 40 },
    ]);

    const result = await handler(createMockEvent());

    expect(result.ok).toBe(false);
    expect(result.conflicts.length).toBeGreaterThan(0);
  });

  it("returns team conflict when teamA plays another match at that time", async () => {
    mockTournamentFindFirst.mockResolvedValue(baseTournament);
    vi.mocked(getQuery).mockReturnValue({ matchId: "1", fieldId: "2", startTime: slotTime });
    mockMatchFindUnique.mockResolvedValue({
      id: 1, fieldId: 1, startTime: new Date(slotTime), teamAId: 10, teamBId: 20,
    });
    mockMatchFindMany.mockResolvedValue([
      { id: 5, fieldId: 3, teamAId: 10, teamBId: 40 },
    ]);

    const result = await handler(createMockEvent());

    expect(result.ok).toBe(false);
  });

  it("excludes the match itself from conflict checks", async () => {
    mockTournamentFindFirst.mockResolvedValue(baseTournament);
    vi.mocked(getQuery).mockReturnValue({ matchId: "1", fieldId: "2", startTime: slotTime });
    mockMatchFindUnique.mockResolvedValue({
      id: 1, fieldId: 2, startTime: new Date(slotTime), teamAId: 10, teamBId: 20,
    });
    mockMatchFindMany.mockResolvedValue([]);

    const result = await handler(createMockEvent());

    expect(result.ok).toBe(true);
  });
});

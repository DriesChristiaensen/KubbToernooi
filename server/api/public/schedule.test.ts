import { describe, it, expect, vi, beforeEach } from "vitest";

const mockTournamentFindFirst = vi.hoisted(() => vi.fn());
const mockMatchFindMany = vi.hoisted(() => vi.fn());

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
    match: { findMany: mockMatchFindMany },
  },
}));

const { default: handler } = await import("./schedule.get");

function createMockEvent() {
  return { _url: "/api/public/schedule", context: {} } as any;
}

describe("GET /api/public/schedule", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns empty array when no tournament exists", async () => {
    mockTournamentFindFirst.mockResolvedValue(null);

    const result = await handler(createMockEvent());

    expect(result).toEqual([]);
    expect(mockMatchFindMany).not.toHaveBeenCalled();
  });

  it("returns empty array when tournament is DRAFT", async () => {
    mockTournamentFindFirst.mockResolvedValue({ id: 1, status: "DRAFT" });

    const result = await handler(createMockEvent());

    expect(result).toEqual([]);
    expect(mockMatchFindMany).not.toHaveBeenCalled();
  });

  it("returns matches when tournament is LIVE", async () => {
    mockTournamentFindFirst.mockResolvedValue({ id: 1, status: "LIVE" });
    const matches = [
      {
        id: 1,
        phase: "POOL",
        round: 1,
        startTime: new Date("2025-06-01T09:00:00Z"),
        status: "SCHEDULED",
        field: { id: 1, name: "Veld 1" },
        teamA: { id: 1, name: "Team A" },
        teamB: { id: 2, name: "Team B" },
      },
    ];
    mockMatchFindMany.mockResolvedValue(matches);

    const result = await handler(createMockEvent());

    expect(mockMatchFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          field: { tournamentId: 1 },
          teamAId: { not: null },
          teamBId: { not: null },
        },
      }),
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: 1, phase: "POOL" });
  });

  it("returns matches ordered by startTime", async () => {
    mockTournamentFindFirst.mockResolvedValue({ id: 1, status: "LIVE" });
    mockMatchFindMany.mockResolvedValue([]);

    await handler(createMockEvent());

    expect(mockMatchFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ startTime: "asc" }, { id: "asc" }],
      }),
    );
  });
});

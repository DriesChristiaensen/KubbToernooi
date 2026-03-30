import { describe, it, expect, vi, beforeEach } from "vitest";

const mockTournamentFindFirst = vi.hoisted(() => vi.fn());
const mockTeamFindMany = vi.hoisted(() => vi.fn());
const mockFieldFindMany = vi.hoisted(() => vi.fn());
const mockPoolFindMany = vi.hoisted(() => vi.fn());
const mockMatchFindMany = vi.hoisted(() => vi.fn());
const mockStandingFindMany = vi.hoisted(() => vi.fn());

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
    team: { findMany: mockTeamFindMany },
    field: { findMany: mockFieldFindMany },
    pool: { findMany: mockPoolFindMany },
    match: { findMany: mockMatchFindMany },
    standing: { findMany: mockStandingFindMany },
  },
}));

const { default: handler } = await import("./export.get");

function createMockEvent() {
  return { _url: "/api/admin/export", context: {} } as any;
}

describe("GET /api/admin/export", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 404 when no tournament exists", async () => {
    mockTournamentFindFirst.mockResolvedValue(null);

    await expect(handler(createMockEvent())).rejects.toThrow("No tournament found");
  });

  it("returns export containing tournament data", async () => {
    const tournament = { id: 1, name: "Kubb 2025", status: "LIVE", type: "COMBINATION" };
    mockTournamentFindFirst.mockResolvedValue(tournament);
    mockTeamFindMany.mockResolvedValue([{ id: 1, name: "Team A" }]);
    mockFieldFindMany.mockResolvedValue([{ id: 1, name: "Veld 1" }]);
    mockPoolFindMany.mockResolvedValue([]);
    mockMatchFindMany.mockResolvedValue([]);
    mockStandingFindMany.mockResolvedValue([]);

    const result = await handler(createMockEvent());

    expect(result).toMatchObject({
      tournament,
      teams: [{ id: 1, name: "Team A" }],
      fields: [{ id: 1, name: "Veld 1" }],
    });
  });

  it("includes pools, matches and standings in export", async () => {
    const tournament = { id: 1, name: "Kubb 2025" };
    mockTournamentFindFirst.mockResolvedValue(tournament);
    mockTeamFindMany.mockResolvedValue([]);
    mockFieldFindMany.mockResolvedValue([]);
    mockPoolFindMany.mockResolvedValue([{ id: 10, name: "Poule A" }]);
    mockMatchFindMany.mockResolvedValue([{ id: 5, phase: "POOL" }]);
    mockStandingFindMany.mockResolvedValue([{ id: 1, points: 3 }]);

    const result = await handler(createMockEvent());

    expect(result.pools).toHaveLength(1);
    expect(result.matches).toHaveLength(1);
    expect(result.standings).toHaveLength(1);
  });
});

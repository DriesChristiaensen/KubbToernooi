import { describe, it, expect, vi, beforeEach } from "vitest";

const mockTournamentFindFirst = vi.hoisted(() => vi.fn());
const mockPoolFindMany = vi.hoisted(() => vi.fn());

vi.stubGlobal("defineEventHandler", (handler: any) => handler);

vi.mock("~/server/utils/prisma", () => ({
  prisma: {
    tournament: { findFirst: mockTournamentFindFirst },
    pool: { findMany: mockPoolFindMany },
  },
}));

const { default: handler } = await import("./standings.get");

function createMockEvent() {
  return { _url: "/api/public/standings", context: {} } as any;
}

describe("GET /api/public/standings", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns empty array when no tournament exists", async () => {
    mockTournamentFindFirst.mockResolvedValue(null);

    const result = await handler(createMockEvent());

    expect(result).toEqual([]);
  });

  it("returns empty array when tournament is DRAFT", async () => {
    mockTournamentFindFirst.mockResolvedValue({ id: 1, status: "DRAFT" });

    const result = await handler(createMockEvent());

    expect(result).toEqual([]);
  });

  it("returns pools with standings when LIVE", async () => {
    mockTournamentFindFirst.mockResolvedValue({ id: 1, status: "LIVE" });
    const pools = [
      {
        id: 10,
        name: "Poule A",
        standings: [
          { teamId: 1, team: { name: "Team A" }, points: 3, won: 1 },
        ],
      },
    ];
    mockPoolFindMany.mockResolvedValue(pools);

    const result = await handler(createMockEvent());

    expect(mockPoolFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tournamentId: 1 } }),
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ name: "Poule A" });
  });
});

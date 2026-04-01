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
    expect(mockPoolFindMany).not.toHaveBeenCalled();
  });

  it("returns empty array when poolScheduleLive is false", async () => {
    mockTournamentFindFirst.mockResolvedValue({ id: "t1", poolScheduleLive: false });

    const result = await handler(createMockEvent());

    expect(result).toEqual([]);
    expect(mockPoolFindMany).not.toHaveBeenCalled();
  });

  it("returns pools with standings when poolScheduleLive is true", async () => {
    mockTournamentFindFirst.mockResolvedValue({ id: "t1", poolScheduleLive: true });
    const pools = [
      {
        id: "p10",
        name: "Poule A",
        standings: [
          { teamId: "ta1", team: { name: "Team A" }, points: 3, won: 1 },
        ],
      },
    ];
    mockPoolFindMany.mockResolvedValue(pools);

    const result = await handler(createMockEvent());

    expect(mockPoolFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tournamentId: "t1" } }),
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ name: "Poule A" });
  });

  it("queries isActive tournament", async () => {
    mockTournamentFindFirst.mockResolvedValue(null);

    await handler(createMockEvent());

    expect(mockTournamentFindFirst).toHaveBeenCalledWith({ where: { isActive: true } });
  });
});

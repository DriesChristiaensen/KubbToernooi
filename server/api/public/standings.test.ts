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
        poolTeams: [{ teamId: "ta1", team: { id: "ta1", name: "Team A" } }],
        standings: [
          { teamId: "ta1", team: { id: "ta1", name: "Team A" }, points: 3, won: 1 },
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

  it("fills in zero-standings for teams not yet in standings", async () => {
    mockTournamentFindFirst.mockResolvedValue({ id: "t1", poolScheduleLive: true });
    const pools = [
      {
        id: "p10",
        name: "Poule A",
        poolTeams: [
          { teamId: "ta1", team: { id: "ta1", name: "Team A" } },
          { teamId: "ta2", team: { id: "ta2", name: "Team B" } },
        ],
        standings: [
          { teamId: "ta1", team: { id: "ta1", name: "Team A" }, points: 3, won: 1, drawn: 0, lost: 0, played: 1, goalsFor: 5, goalsAgainst: 2, goalDifference: 3 },
        ],
      },
    ];
    mockPoolFindMany.mockResolvedValue(pools);

    const result = await handler(createMockEvent());

    expect(result[0].standings).toHaveLength(2);
    const teamB = result[0].standings.find((st: any) => st.teamId === "ta2");
    expect(teamB).toMatchObject({ teamId: "ta2", points: 0, won: 0, drawn: 0, lost: 0, played: 0, goalsFor: 0, goalDifference: 0 });
  });

  it("queries isActive tournament", async () => {
    mockTournamentFindFirst.mockResolvedValue(null);

    await handler(createMockEvent());

    expect(mockTournamentFindFirst).toHaveBeenCalledWith({ where: { isActive: true } });
  });
});

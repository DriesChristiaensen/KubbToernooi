import { describe, it, expect, vi, beforeEach } from "vitest";

const mockTournamentFindFirst = vi.hoisted(() => vi.fn());

vi.stubGlobal("defineEventHandler", (handler: any) => handler);

vi.mock("~/server/utils/prisma", () => ({
  prisma: {
    tournament: {
      findFirst: mockTournamentFindFirst,
    },
  },
}));

const { default: handler } = await import("./info.get");

describe("GET /api/public/info", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null type and false schedules when no active tournament", async () => {
    mockTournamentFindFirst.mockResolvedValue(null);
    const result = await handler({} as any);
    expect(result).toEqual({ type: null, tournamentLive: false, poolScheduleLive: false, koScheduleLive: false });
  });

  it("returns tournament type and schedule live flags when active tournament exists", async () => {
    mockTournamentFindFirst.mockResolvedValue({
      id: "t1",
      type: "COMBINATION",
      isActive: true,
      poolScheduleLive: true,
      koScheduleLive: false,
    });
    const result = await handler({} as any);
    expect(result).toEqual({ type: "COMBINATION", tournamentLive: false, poolScheduleLive: true, koScheduleLive: false });
  });

  it("returns all false schedule flags when tournament has none live", async () => {
    mockTournamentFindFirst.mockResolvedValue({
      id: "t1",
      type: "POOLS",
      isActive: true,
      poolScheduleLive: false,
      koScheduleLive: false,
    });
    const result = await handler({} as any);
    expect(result).toEqual({ type: "POOLS", tournamentLive: false, poolScheduleLive: false, koScheduleLive: false });
  });

  it("queries only active tournaments", async () => {
    mockTournamentFindFirst.mockResolvedValue(null);
    await handler({} as any);
    expect(mockTournamentFindFirst).toHaveBeenCalledWith({ where: { isActive: true } });
  });
});

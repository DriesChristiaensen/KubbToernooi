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

  it("returns null type when no active tournament", async () => {
    mockTournamentFindFirst.mockResolvedValue(null);
    const result = await handler({} as any);
    expect(result).toEqual({ type: null });
  });

  it("returns tournament type when active tournament exists", async () => {
    mockTournamentFindFirst.mockResolvedValue({ id: "t1", type: "POOLS", isActive: true });
    const result = await handler({} as any);
    expect(result).toEqual({ type: "POOLS" });
  });

  it("queries only active tournaments", async () => {
    mockTournamentFindFirst.mockResolvedValue(null);
    await handler({} as any);
    expect(mockTournamentFindFirst).toHaveBeenCalledWith({ where: { isActive: true } });
  });
});

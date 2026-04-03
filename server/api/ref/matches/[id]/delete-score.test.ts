import { describe, it, expect, vi, beforeEach } from "vitest";

const mockMatchFindFirst = vi.hoisted(() => vi.fn());
const mockMatchUpdate = vi.hoisted(() => vi.fn());
const mockRecalculate = vi.hoisted(() => vi.fn());

vi.stubGlobal("defineEventHandler", (handler: any) => handler);
vi.stubGlobal("getRouterParam", vi.fn());
vi.stubGlobal("createApiError", ({ error, code, reason }: any) => {
  const err = new Error(reason) as any;
  err.statusCode = code;
  err.data = { error, code, reason, stacktrace: {} };
  return err;
});

vi.mock("~/server/utils/prisma", () => ({
  prisma: {
    match: {
      findFirst: mockMatchFindFirst,
      update: mockMatchUpdate,
    },
  },
}));

vi.mock("~/server/utils/logger", () => ({ logRequest: vi.fn() }));
vi.mock("~/server/utils/standings", () => ({ recalculatePoolStandings: mockRecalculate }));

const { default: handler } = await import("./delete-score.post");

function createMockEvent() {
  return { _url: "/api/ref/matches/m1/delete-score", context: {} } as any;
}

describe("POST /api/ref/matches/:id/delete-score", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getRouterParam).mockReturnValue("m1");
  });

  it("returns 404 when match not found", async () => {
    mockMatchFindFirst.mockResolvedValue(null);

    await expect(handler(createMockEvent())).rejects.toThrow("Match not found");
  });

  it("returns 400 when match has no score", async () => {
    mockMatchFindFirst.mockResolvedValue({
      id: "m1",
      scoreA: null,
      scoreB: null,
      phase: "POOL",
      poolId: null,
      startTime: new Date(),
    });

    await expect(handler(createMockEvent())).rejects.toThrow("No score to delete");
  });

  it("resets score to null and updates status to SCHEDULED for future match", async () => {
    const future = new Date(Date.now() + 3600000);
    mockMatchFindFirst.mockResolvedValue({
      id: "m1",
      scoreA: 3,
      scoreB: 1,
      phase: "POOL",
      poolId: "p1",
      startTime: future,
      koWinnerId: null,
    });
    mockMatchUpdate.mockResolvedValue({ id: "m1", scoreA: null, scoreB: null, status: "SCHEDULED" });
    mockRecalculate.mockResolvedValue(undefined);

    const result = await handler(createMockEvent());

    expect(mockMatchUpdate).toHaveBeenCalledWith({
      where: { id: "m1" },
      data: { scoreA: null, scoreB: null, koWinnerId: null, status: "SCHEDULED" },
    });
    expect(mockRecalculate).toHaveBeenCalledWith("p1");
    expect(result).toMatchObject({ status: "SCHEDULED" });
  });

  it("sets status to LIVE for past match", async () => {
    const past = new Date(Date.now() - 3600000);
    mockMatchFindFirst.mockResolvedValue({
      id: "m1",
      scoreA: 2,
      scoreB: 0,
      phase: "POOL",
      poolId: null,
      startTime: past,
      koWinnerId: null,
    });
    mockMatchUpdate.mockResolvedValue({ id: "m1", scoreA: null, scoreB: null, status: "LIVE" });

    await handler(createMockEvent());

    expect(mockMatchUpdate).toHaveBeenCalledWith({
      where: { id: "m1" },
      data: { scoreA: null, scoreB: null, koWinnerId: null, status: "LIVE" },
    });
  });
});

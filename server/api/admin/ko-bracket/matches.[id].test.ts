import { describe, it, expect, vi, beforeEach } from "vitest";

const mockMatchFindFirst = vi.hoisted(() => vi.fn());
const mockMatchUpdate = vi.hoisted(() => vi.fn());

vi.stubGlobal("defineEventHandler", (handler: any) => handler);
vi.stubGlobal("readBody", vi.fn());
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

const { default: handler } = await import("./matches.[id].patch");

function createMockEvent() {
  return { _url: "/api/admin/ko-bracket/matches/1", context: {} } as any;
}

const baseMatch = {
  id: 1,
  phase: "KO",
  round: 1,
  teamAId: 10,
  teamBId: 20,
  fieldId: 100,
  startTime: new Date("2025-06-01T14:00:00Z"),
  status: "SCHEDULED",
  poolId: null,
};

describe("PATCH /api/admin/ko-bracket/matches/:id", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 for invalid match ID", async () => {
    vi.mocked(getRouterParam).mockReturnValue("abc");
    vi.mocked(readBody).mockResolvedValue({});

    await expect(handler(createMockEvent())).rejects.toThrow("Invalid match ID");
  });

  it("returns 404 when match not found", async () => {
    vi.mocked(getRouterParam).mockReturnValue("1");
    vi.mocked(readBody).mockResolvedValue({ teamAId: 10, teamBId: 20 });
    mockMatchFindFirst.mockResolvedValue(null);

    await expect(handler(createMockEvent())).rejects.toThrow("Match not found");
  });

  it("returns 400 when match is not KO phase", async () => {
    vi.mocked(getRouterParam).mockReturnValue("1");
    vi.mocked(readBody).mockResolvedValue({ teamAId: 10, teamBId: 20 });
    mockMatchFindFirst.mockResolvedValue({ ...baseMatch, phase: "POOL" });

    await expect(handler(createMockEvent())).rejects.toThrow("Not a KO match");
  });

  it("returns 400 when match is already played", async () => {
    vi.mocked(getRouterParam).mockReturnValue("1");
    vi.mocked(readBody).mockResolvedValue({ teamAId: 10, teamBId: 20 });
    mockMatchFindFirst.mockResolvedValue({ ...baseMatch, status: "PLAYED" });

    await expect(handler(createMockEvent())).rejects.toThrow("Match already played");
  });

  it("swaps teams when valid teamAId and teamBId provided", async () => {
    vi.mocked(getRouterParam).mockReturnValue("1");
    vi.mocked(readBody).mockResolvedValue({ teamAId: 30, teamBId: 40 });
    mockMatchFindFirst.mockResolvedValue(baseMatch);
    mockMatchUpdate.mockResolvedValue({ ...baseMatch, teamAId: 30, teamBId: 40 });

    const result = await handler(createMockEvent());

    expect(mockMatchUpdate).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { teamAId: 30, teamBId: 40 },
    });
    expect(result).toMatchObject({ teamAId: 30, teamBId: 40 });
  });
});

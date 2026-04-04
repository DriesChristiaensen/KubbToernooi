import { describe, it, expect, vi, beforeEach } from "vitest";

const mockMatchFindMany = vi.hoisted(() => vi.fn());
const mockMatchUpdate = vi.hoisted(() => vi.fn());

vi.stubGlobal("defineEventHandler", (handler: any) => handler);
vi.stubGlobal("readBody", vi.fn());
vi.stubGlobal("createApiError", ({ error, code, reason }: any) => {
  const err = new Error(reason) as any;
  err.statusCode = code;
  err.data = { error, code, reason, stacktrace: {} };
  return err;
});

vi.mock("~/server/utils/prisma", () => {
  const mockPrisma: any = {
    match: {
      findMany: mockMatchFindMany,
      update: mockMatchUpdate,
    },
  };
  mockPrisma.$transaction = vi.fn((callback: any) => callback(mockPrisma));
  return { prisma: mockPrisma };
});

vi.mock("~/server/utils/logger", () => ({ logRequest: vi.fn() }));
vi.mock("~/server/utils/tournament", () => ({
  getActiveTournament: vi.fn().mockResolvedValue({ id: "t1" }),
}));

const { default: handler } = await import("./swap.post");

function createMockEvent() {
  return { _url: "/api/admin/schedule/matches/swap", context: {} } as any;
}

const matchA = {
  id: "mA",
  fieldId: "f1",
  startTime: new Date("2025-08-15T09:00:00Z"),
  teamAId: "teamA1",
  teamBId: "teamA2",
  status: "SCHEDULED",
  field: { id: "f1", name: "Veld 1" },
  teamA: { id: "teamA1", name: "Team Alpha" },
  teamB: { id: "teamA2", name: "Team Beta" },
};

const matchB = {
  id: "mB",
  fieldId: "f2",
  startTime: new Date("2025-08-15T10:00:00Z"),
  teamAId: "teamB1",
  teamBId: "teamB2",
  status: "SCHEDULED",
  field: { id: "f2", name: "Veld 2" },
  teamA: { id: "teamB1", name: "Team Gamma" },
  teamB: { id: "teamB2", name: "Team Delta" },
};

describe("POST /api/admin/schedule/matches/swap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMatchUpdate.mockResolvedValue({});
  });

  it("returns 400 when matchAId or matchBId is missing", async () => {
    vi.mocked(readBody).mockResolvedValue({ matchAId: "mA" });

    await expect(handler(createMockEvent())).rejects.toMatchObject({ statusCode: 400 });
  });

  it("returns 404 when one of the matches is not found", async () => {
    vi.mocked(readBody).mockResolvedValue({ matchAId: "mA", matchBId: "mB" });
    mockMatchFindMany.mockResolvedValue([matchA]);

    await expect(handler(createMockEvent())).rejects.toMatchObject({ statusCode: 404 });
  });

  it("swaps fieldId and startTime between two matches", async () => {
    vi.mocked(readBody).mockResolvedValue({ matchAId: "mA", matchBId: "mB" });
    mockMatchFindMany.mockResolvedValue([matchA, matchB]);

    await handler(createMockEvent());

    expect(mockMatchUpdate).toHaveBeenCalledWith({
      where: { id: "mA" },
      data: { fieldId: matchB.fieldId, startTime: matchB.startTime },
    });
    expect(mockMatchUpdate).toHaveBeenCalledWith({
      where: { id: "mB" },
      data: { fieldId: matchA.fieldId, startTime: matchA.startTime },
    });
  });

  it("returns swapped match details", async () => {
    vi.mocked(readBody).mockResolvedValue({ matchAId: "mA", matchBId: "mB" });
    mockMatchFindMany.mockResolvedValue([matchA, matchB]);

    const result = await handler(createMockEvent());

    expect(result).toMatchObject({ swapped: true });
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockTournamentFindFirst = vi.hoisted(() => vi.fn());
const mockMatchFindUnique = vi.hoisted(() => vi.fn());
const mockMatchFindMany = vi.hoisted(() => vi.fn());
const mockMatchUpdate = vi.hoisted(() => vi.fn());
const mockFieldFindFirst = vi.hoisted(() => vi.fn());

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
    tournament: { findFirst: mockTournamentFindFirst },
    match: {
      findUnique: mockMatchFindUnique,
      findMany: mockMatchFindMany,
      update: mockMatchUpdate,
    },
    field: { findFirst: mockFieldFindFirst },
  },
}));

vi.mock("~/server/utils/logger", () => ({ logRequest: vi.fn() }));

const { default: handler } = await import("./matches.[id].patch");

const slotTime = new Date("2025-06-01T09:00:00Z");

function createMockEvent() {
  return { _url: "/api/admin/schedule/matches/1", context: {} } as any;
}

describe("PATCH /api/admin/schedule/matches/:id", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 404 when match not found", async () => {
    mockTournamentFindFirst.mockResolvedValue({ id: 1 });
    vi.mocked(getRouterParam).mockReturnValue("99");
    vi.mocked(readBody).mockResolvedValue({ fieldId: 2 });
    mockMatchFindUnique.mockResolvedValue(null);

    await expect(handler(createMockEvent())).rejects.toThrow("Match not found");
  });

  it("returns 404 when field does not exist", async () => {
    mockTournamentFindFirst.mockResolvedValue({ id: 1 });
    vi.mocked(getRouterParam).mockReturnValue("1");
    vi.mocked(readBody).mockResolvedValue({ fieldId: 999 });
    mockMatchFindUnique.mockResolvedValue({
      id: 1, fieldId: 1, startTime: slotTime, teamAId: 10, teamBId: 20,
    });
    mockFieldFindFirst.mockResolvedValue(null);

    await expect(handler(createMockEvent())).rejects.toThrow("Field not found");
  });

  it("returns 409 when field is already booked at that time", async () => {
    mockTournamentFindFirst.mockResolvedValue({ id: 1 });
    vi.mocked(getRouterParam).mockReturnValue("1");
    vi.mocked(readBody).mockResolvedValue({ fieldId: 2, startTime: slotTime.toISOString() });
    mockMatchFindUnique.mockResolvedValue({
      id: 1, fieldId: 1, startTime: slotTime, teamAId: 10, teamBId: 20,
    });
    mockFieldFindFirst.mockResolvedValue({ id: 2 });
    mockMatchFindMany.mockResolvedValue([{ id: 5, fieldId: 2, teamAId: 30, teamBId: 40 }]);

    await expect(handler(createMockEvent())).rejects.toThrow("Conflict detected");
  });

  it("updates match field and time when no conflicts", async () => {
    mockTournamentFindFirst.mockResolvedValue({ id: 1 });
    vi.mocked(getRouterParam).mockReturnValue("1");
    vi.mocked(readBody).mockResolvedValue({ fieldId: 2, startTime: slotTime.toISOString() });
    mockMatchFindUnique.mockResolvedValue({
      id: 1, fieldId: 1, startTime: slotTime, teamAId: 10, teamBId: 20,
    });
    mockFieldFindFirst.mockResolvedValue({ id: 2 });
    mockMatchFindMany.mockResolvedValue([]);
    mockMatchUpdate.mockResolvedValue({ id: 1, fieldId: 2, startTime: slotTime });

    const result = await handler(createMockEvent());

    expect(mockMatchUpdate).toHaveBeenCalledWith({
      where: { id: 1 },
      data: expect.objectContaining({ fieldId: 2 }),
    });
    expect(result).toMatchObject({ id: 1 });
  });
});

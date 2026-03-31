import { describe, it, expect, vi, beforeEach } from "vitest";

const mockTournamentFindFirst = vi.hoisted(() => vi.fn());
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

vi.mock("~/server/utils/prisma", () => ({
  prisma: {
    tournament: { findFirst: mockTournamentFindFirst },
    match: {
      findMany: mockMatchFindMany,
      update: mockMatchUpdate,
    },
  },
}));

vi.mock("~/server/utils/logger", () => ({ logRequest: vi.fn() }));

const { default: handler } = await import("./time-shift.post");

const t1 = new Date("2025-06-01T09:00:00Z");
const t2 = new Date("2025-06-01T09:20:00Z");
const t3 = new Date("2025-06-01T09:40:00Z");

function createMockEvent() {
  return { _url: "/api/admin/schedule/time-shift", context: {} } as any;
}

describe("POST /api/admin/schedule/time-shift", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 404 when no tournament exists", async () => {
    mockTournamentFindFirst.mockResolvedValue(null);
    vi.mocked(readBody).mockResolvedValue({ fromTime: t1.toISOString(), offsetMinutes: 10 });

    await expect(handler(createMockEvent())).rejects.toThrow("No tournament found");
  });

  it("returns 400 when fromTime is missing", async () => {
    mockTournamentFindFirst.mockResolvedValue({ id: "t1" });
    vi.mocked(readBody).mockResolvedValue({ offsetMinutes: 10 });

    await expect(handler(createMockEvent())).rejects.toThrow("fromTime is required");
  });

  it("returns 400 when offsetMinutes is missing", async () => {
    mockTournamentFindFirst.mockResolvedValue({ id: "t1" });
    vi.mocked(readBody).mockResolvedValue({ fromTime: t1.toISOString() });

    await expect(handler(createMockEvent())).rejects.toThrow("offsetMinutes is required");
  });

  it("shifts matches at or after fromTime by the offset", async () => {
    mockTournamentFindFirst.mockResolvedValue({ id: "t1" });
    vi.mocked(readBody).mockResolvedValue({ fromTime: t2.toISOString(), offsetMinutes: 15 });
    mockMatchFindMany.mockResolvedValue([
      { id: "m2", startTime: t2 },
      { id: "m3", startTime: t3 },
    ]);
    mockMatchUpdate.mockResolvedValue({});

    const result = await handler(createMockEvent());

    expect(mockMatchFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ startTime: { gte: new Date(t2.toISOString()) } }),
      }),
    );
    expect(mockMatchUpdate).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ shifted: 2 });
  });

  it("updates each match with the correct new start time", async () => {
    mockTournamentFindFirst.mockResolvedValue({ id: "t1" });
    vi.mocked(readBody).mockResolvedValue({ fromTime: t2.toISOString(), offsetMinutes: 15 });
    mockMatchFindMany.mockResolvedValue([{ id: "m2", startTime: t2 }]);
    mockMatchUpdate.mockResolvedValue({});

    await handler(createMockEvent());

    const expectedTime = new Date(t2.getTime() + 15 * 60 * 1000);
    expect(mockMatchUpdate).toHaveBeenCalledWith({
      where: { id: "m2" },
      data: { startTime: expectedTime },
    });
  });

  it("applies negative offset correctly", async () => {
    mockTournamentFindFirst.mockResolvedValue({ id: "t1" });
    vi.mocked(readBody).mockResolvedValue({ fromTime: t2.toISOString(), offsetMinutes: -10 });
    mockMatchFindMany.mockResolvedValue([{ id: "m2", startTime: t2 }]);
    mockMatchUpdate.mockResolvedValue({});

    const result = await handler(createMockEvent());

    const expectedTime = new Date(t2.getTime() - 10 * 60 * 1000);
    expect(mockMatchUpdate).toHaveBeenCalledWith({
      where: { id: "m2" },
      data: { startTime: expectedTime },
    });
    expect(result).toMatchObject({ shifted: 1 });
  });
});

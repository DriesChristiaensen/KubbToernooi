import { describe, it, expect, vi, beforeEach } from "vitest";

const mockTournamentFindFirst = vi.hoisted(() => vi.fn());
const mockTournamentUpdate = vi.hoisted(() => vi.fn());

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
    tournament: {
      findFirst: mockTournamentFindFirst,
      update: mockTournamentUpdate,
    },
  },
}));

vi.mock("~/server/utils/logger", () => ({
  logRequest: vi.fn(),
}));

const { default: getTournamentHandler } = await import("./tournament.get");
const { default: patchTournamentHandler } = await import("./tournament.patch");

function createMockEvent(overrides: any = {}) {
  return {
    _url: "http://localhost/api/admin/tournament",
    context: {},
    ...overrides,
  } as any;
}

describe("GET /api/admin/tournament", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 404 when no tournament exists", async () => {
    mockTournamentFindFirst.mockResolvedValue(null);

    await expect(getTournamentHandler(createMockEvent())).rejects.toThrow(
      "No tournament found",
    );
  });

  it("returns tournament settings", async () => {
    const tournament = {
      id: "t1",
      name: "Kubb 2025",
      status: "DRAFT",
      type: "COMBINATION",
      pointsWin: 3,
      pointsDraw: 1,
      pointsLoss: 0,
    };
    mockTournamentFindFirst.mockResolvedValue(tournament);

    const result = await getTournamentHandler(createMockEvent());

    expect(result).toMatchObject({ name: "Kubb 2025", type: "COMBINATION" });
  });
});

describe("PATCH /api/admin/tournament", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 404 when no tournament exists", async () => {
    mockTournamentFindFirst.mockResolvedValue(null);
    vi.mocked(readBody).mockResolvedValue({ type: "POOLS" });

    await expect(patchTournamentHandler(createMockEvent())).rejects.toThrow(
      "No tournament found",
    );
  });

  it("returns 400 when type is invalid", async () => {
    mockTournamentFindFirst.mockResolvedValue({ id: "t1" });
    vi.mocked(readBody).mockResolvedValue({ type: "INVALID_TYPE" });

    await expect(patchTournamentHandler(createMockEvent())).rejects.toThrow(
      "Invalid tournament type",
    );
  });

  it("updates tournament type successfully", async () => {
    mockTournamentFindFirst.mockResolvedValue({ id: "t1" });
    vi.mocked(readBody).mockResolvedValue({ type: "POOLS" });
    mockTournamentUpdate.mockResolvedValue({ id: "t1", type: "POOLS" });

    const result = await patchTournamentHandler(createMockEvent());

    expect(mockTournamentUpdate).toHaveBeenCalledWith({
      where: { id: "t1" },
      data: expect.objectContaining({ type: "POOLS" }),
    });
    expect(result).toMatchObject({ type: "POOLS" });
  });

  it("updates point values successfully", async () => {
    mockTournamentFindFirst.mockResolvedValue({ id: "t1" });
    vi.mocked(readBody).mockResolvedValue({
      pointsWin: 2,
      pointsDraw: 1,
      pointsLoss: 0,
    });
    mockTournamentUpdate.mockResolvedValue({
      id: "t1",
      pointsWin: 2,
      pointsDraw: 1,
      pointsLoss: 0,
    });

    const result = await patchTournamentHandler(createMockEvent());

    expect(mockTournamentUpdate).toHaveBeenCalledWith({
      where: { id: "t1" },
      data: expect.objectContaining({ pointsWin: 2 }),
    });
    expect(result).toMatchObject({ pointsWin: 2 });
  });

  it("returns 400 when status is invalid", async () => {
    mockTournamentFindFirst.mockResolvedValue({ id: "t1" });
    vi.mocked(readBody).mockResolvedValue({ status: "PUBLISHED" });

    await expect(patchTournamentHandler(createMockEvent())).rejects.toThrow(
      "Invalid tournament status",
    );
  });

  it("updates status to LIVE successfully", async () => {
    mockTournamentFindFirst.mockResolvedValue({ id: "t1" });
    vi.mocked(readBody).mockResolvedValue({ status: "LIVE" });
    mockTournamentUpdate.mockResolvedValue({ id: "t1", status: "LIVE" });

    const result = await patchTournamentHandler(createMockEvent());

    expect(mockTournamentUpdate).toHaveBeenCalledWith({
      where: { id: "t1" },
      data: expect.objectContaining({ status: "LIVE" }),
    });
    expect(result).toMatchObject({ status: "LIVE" });
  });

  it("updates status to DRAFT successfully", async () => {
    mockTournamentFindFirst.mockResolvedValue({ id: "t1" });
    vi.mocked(readBody).mockResolvedValue({ status: "DRAFT" });
    mockTournamentUpdate.mockResolvedValue({ id: "t1", status: "DRAFT" });

    const result = await patchTournamentHandler(createMockEvent());

    expect(mockTournamentUpdate).toHaveBeenCalledWith({
      where: { id: "t1" },
      data: expect.objectContaining({ status: "DRAFT" }),
    });
    expect(result).toMatchObject({ status: "DRAFT" });
  });
});

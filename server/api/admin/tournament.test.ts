import { describe, it, expect, vi, beforeEach } from "vitest";

const mockTournamentFindFirst = vi.hoisted(() => vi.fn());
const mockTournamentUpdate = vi.hoisted(() => vi.fn());
const mockTournamentUpdateMany = vi.hoisted(() => vi.fn());
const mockTournamentCreate = vi.hoisted(() => vi.fn());
const mockFieldCreateMany = vi.hoisted(() => vi.fn());

// Map error codes to HTTP status codes (must match server/utils/errors.ts)
const codeToStatusCode: Record<string, number> = {
  invalid_input: 400,
  invalid_tournament_type: 400,
  invalid_tournament_id: 400,
  invalid_input: 400,
  tournament_name_exists: 409,
  not_enough_fields: 400,
  tournament_not_found: 404,
  field_not_found: 404,
  team_not_found: 404,
  pool_not_found: 404,
  referee_not_found: 404,
  user_not_found: 404,
  tournament_exists: 409,
  unexpected_error: 500,
  admin_no_password: 500,
};

vi.stubGlobal("defineEventHandler", (handler: any) => handler);
vi.stubGlobal("readBody", vi.fn());
vi.stubGlobal("createApiError", ({ error, code, reason, field }: any) => {
  const statusCode = codeToStatusCode[code] ?? 500;
  const err = new Error(reason) as any;
  err.statusCode = statusCode;
  err.data = { error, code, reason, ...(field !== undefined ? { field } : {}), stacktrace: {} };
  return err;
});

vi.mock("~/server/utils/prisma", () => {
  const mockPrisma: any = {
    tournament: {
      findFirst: mockTournamentFindFirst,
      update: mockTournamentUpdate,
      updateMany: mockTournamentUpdateMany,
      create: mockTournamentCreate,
    },
    field: {
      createMany: mockFieldCreateMany,
    },
  };
  mockPrisma.$transaction = vi.fn((callback: any) => callback(mockPrisma));
  return { prisma: mockPrisma };
});

vi.mock("~/server/utils/logger", () => ({
  logRequest: vi.fn(),
}));

const { default: getTournamentHandler } = await import("./tournament.get");
const { default: patchTournamentHandler } = await import("./tournament.patch");
const { default: postTournamentHandler } = await import("./tournament.post");

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

describe("PATCH /api/admin/tournament (status only)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 404 when no tournament exists", async () => {
    mockTournamentFindFirst.mockResolvedValue(null);
    vi.mocked(readBody).mockResolvedValue({ status: "LIVE" });

    await expect(patchTournamentHandler(createMockEvent())).rejects.toThrow(
      "No tournament found",
    );
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
      data: { status: "LIVE" },
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
      data: { status: "DRAFT" },
    });
    expect(result).toMatchObject({ status: "DRAFT" });
  });

  it("updates poolScheduleLive successfully", async () => {
    mockTournamentFindFirst.mockResolvedValue({ id: "t1" });
    vi.mocked(readBody).mockResolvedValue({ poolScheduleLive: true });
    mockTournamentUpdate.mockResolvedValue({ id: "t1", poolScheduleLive: true });

    const result = await patchTournamentHandler(createMockEvent());

    expect(mockTournamentUpdate).toHaveBeenCalledWith({
      where: { id: "t1" },
      data: { poolScheduleLive: true },
    });
    expect(result).toMatchObject({ poolScheduleLive: true });
  });

  it("returns 400 when no valid fields provided", async () => {
    mockTournamentFindFirst.mockResolvedValue({ id: "t1" });
    vi.mocked(readBody).mockResolvedValue({});

    await expect(patchTournamentHandler(createMockEvent())).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe("POST /api/admin/tournament", () => {
  beforeEach(() => vi.clearAllMocks());

  const validBody = {
    name: "Kubb 2025",
    type: "COMBINATION",
    startTime: "2025-08-15T09:00:00Z",
    matchDuration: 15,
    breakTime: 5,
    pointsWin: 3,
    pointsDraw: 1,
    pointsLoss: 0,
    fieldCount: 3,
  };

  it("creates a tournament and fields when no active tournament exists", async () => {
    mockTournamentFindFirst.mockResolvedValue(null);
    mockTournamentCreate.mockResolvedValue({ id: "t2", name: "Kubb 2025", type: "COMBINATION" });
    mockFieldCreateMany.mockResolvedValue({ count: 3 });
    vi.mocked(readBody).mockResolvedValue(validBody);
    const event = createMockEvent();

    const result = await postTournamentHandler(event);

    expect(mockTournamentUpdateMany).not.toHaveBeenCalled();
    expect(mockTournamentCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ name: "Kubb 2025", type: "COMBINATION" }),
    });
    expect(mockFieldCreateMany).toHaveBeenCalled();
    expect(result).toMatchObject({ name: "Kubb 2025" });
  });

  it("soft-deletes active tournament before creating a new one", async () => {
    mockTournamentFindFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "t1" });
    mockTournamentUpdateMany.mockResolvedValue({ count: 1 });
    mockTournamentCreate.mockResolvedValue({ id: "t2", name: "Kubb 2025", type: "COMBINATION" });
    mockFieldCreateMany.mockResolvedValue({ count: 3 });
    vi.mocked(readBody).mockResolvedValue(validBody);
    const event = createMockEvent();

    await postTournamentHandler(event);

    expect(mockTournamentUpdateMany).toHaveBeenCalledWith({
      where: { isActive: true },
      data: { isActive: false },
    });
  });

  it("rejects duplicate name with 409", async () => {
    mockTournamentFindFirst.mockResolvedValueOnce({ id: "t1", name: "Kubb 2025" });
    vi.mocked(readBody).mockResolvedValue(validBody);
    await expect(postTournamentHandler(createMockEvent())).rejects.toMatchObject({ statusCode: 409, data: { field: "name" } });
  });

  it("rejects missing name", async () => {
    vi.mocked(readBody).mockResolvedValue({ ...validBody, name: "" });
    await expect(postTournamentHandler(createMockEvent())).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects invalid type", async () => {
    vi.mocked(readBody).mockResolvedValue({ ...validBody, type: "INVALID" });
    await expect(postTournamentHandler(createMockEvent())).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects invalid fieldCount", async () => {
    vi.mocked(readBody).mockResolvedValue({ ...validBody, fieldCount: 0 });
    await expect(postTournamentHandler(createMockEvent())).rejects.toMatchObject({ statusCode: 400 });
  });
});

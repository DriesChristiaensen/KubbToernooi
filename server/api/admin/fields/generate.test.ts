import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFieldFindMany = vi.hoisted(() => vi.fn());
const mockFieldDeleteMany = vi.hoisted(() => vi.fn());
const mockFieldCreateMany = vi.hoisted(() => vi.fn());
const mockTournamentFindFirst = vi.hoisted(() => vi.fn());

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
    field: {
      findMany: mockFieldFindMany,
      deleteMany: mockFieldDeleteMany,
      createMany: mockFieldCreateMany,
    },
    tournament: {
      findFirst: mockTournamentFindFirst,
    },
  };
  mockPrisma.$transaction = vi.fn((callback: any) => callback(mockPrisma));
  return { prisma: mockPrisma };
});

vi.mock("~/server/utils/logger", () => ({
  logRequest: vi.fn(),
}));

const { default: generateHandler } = await import("./generate.post");

function createMockEvent(overrides: any = {}) {
  return {
    _url: "http://localhost/api/admin/fields/generate",
    context: {},
    ...overrides,
  } as any;
}

describe("POST /api/admin/fields/generate", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 404 when no tournament exists", async () => {
    mockTournamentFindFirst.mockResolvedValue(null);
    vi.mocked(readBody).mockResolvedValue({ count: 3 });

    await expect(generateHandler(createMockEvent())).rejects.toThrow(
      "No tournament found",
    );
  });

  it("returns 400 when count is missing", async () => {
    mockTournamentFindFirst.mockResolvedValue({ id: "t1" });
    vi.mocked(readBody).mockResolvedValue({});

    await expect(generateHandler(createMockEvent())).rejects.toThrow(
      "Invalid count",
    );
  });

  it("returns 400 when count is zero", async () => {
    mockTournamentFindFirst.mockResolvedValue({ id: "t1" });
    vi.mocked(readBody).mockResolvedValue({ count: 0 });

    await expect(generateHandler(createMockEvent())).rejects.toThrow(
      "Invalid count",
    );
  });

  it("returns 400 when count is negative", async () => {
    mockTournamentFindFirst.mockResolvedValue({ id: "t1" });
    vi.mocked(readBody).mockResolvedValue({ count: -2 });

    await expect(generateHandler(createMockEvent())).rejects.toThrow(
      "Invalid count",
    );
  });

  it("returns 400 when count is not a number", async () => {
    mockTournamentFindFirst.mockResolvedValue({ id: "t1" });
    vi.mocked(readBody).mockResolvedValue({ count: "abc" });

    await expect(generateHandler(createMockEvent())).rejects.toThrow(
      "Invalid count",
    );
  });

  it("returns 409 when existing fields exist and overwrite is false", async () => {
    mockTournamentFindFirst.mockResolvedValue({ id: "t1" });
    vi.mocked(readBody).mockResolvedValue({ count: 3 });
    mockFieldFindMany.mockResolvedValue([{ id: "f1", name: "Veld 1" }]);

    await expect(generateHandler(createMockEvent())).rejects.toThrow(
      "Fields already exist",
    );
  });

  it("generates fields when no existing fields", async () => {
    mockTournamentFindFirst.mockResolvedValue({ id: "t1" });
    vi.mocked(readBody).mockResolvedValue({ count: 3 });
    mockFieldFindMany.mockResolvedValue([]);
    mockFieldCreateMany.mockResolvedValue({ count: 3 });

    const result = await generateHandler(createMockEvent());

    expect(mockFieldCreateMany).toHaveBeenCalledWith({
      data: [
        { name: "Veld 1", tournamentId: "t1" },
        { name: "Veld 2", tournamentId: "t1" },
        { name: "Veld 3", tournamentId: "t1" },
      ],
    });
    expect(result).toEqual({ generated: 3 });
  });

  it("deletes existing fields and regenerates when overwrite is true", async () => {
    mockTournamentFindFirst.mockResolvedValue({ id: "t1" });
    vi.mocked(readBody).mockResolvedValue({ count: 2, overwrite: true });
    mockFieldFindMany.mockResolvedValue([{ id: "f1", name: "Veld 1" }]);
    mockFieldDeleteMany.mockResolvedValue({ count: 1 });
    mockFieldCreateMany.mockResolvedValue({ count: 2 });

    const result = await generateHandler(createMockEvent());

    expect(mockFieldDeleteMany).toHaveBeenCalledWith({
      where: { tournamentId: "t1" },
    });
    expect(mockFieldCreateMany).toHaveBeenCalledWith({
      data: [
        { name: "Veld 1", tournamentId: "t1" },
        { name: "Veld 2", tournamentId: "t1" },
      ],
    });
    expect(result).toEqual({ generated: 2 });
  });
});

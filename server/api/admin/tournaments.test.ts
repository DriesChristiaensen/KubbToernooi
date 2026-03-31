import { describe, it, expect, vi, beforeEach } from "vitest";

const mockTournamentFindMany = vi.hoisted(() => vi.fn());
const mockTournamentFindFirst = vi.hoisted(() => vi.fn());
const mockTournamentUpdateMany = vi.hoisted(() => vi.fn());
const mockTournamentUpdate = vi.hoisted(() => vi.fn());
const mockTournamentDelete = vi.hoisted(() => vi.fn());

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
    tournament: {
      findMany: mockTournamentFindMany,
      findFirst: mockTournamentFindFirst,
      updateMany: mockTournamentUpdateMany,
      update: mockTournamentUpdate,
      delete: mockTournamentDelete,
    },
  },
}));

vi.mock("~/server/utils/logger", () => ({
  logRequest: vi.fn(),
}));

const { default: getInactiveHandler } = await import("./tournaments/inactive.get");
const { default: restoreHandler } = await import("./tournaments/[id]/restore.post");
const { default: deleteHandler } = await import("./tournaments/[id]/index.delete");

function createMockEvent() {
  return {
    _url: "http://localhost/api/admin/tournaments",
    context: {},
  } as any;
}

describe("GET /api/admin/tournaments/inactive", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns list of inactive tournaments", async () => {
    const tournaments = [
      { id: "t1", name: "Old 2024", isActive: false },
      { id: "t2", name: "Old 2023", isActive: false },
    ];
    mockTournamentFindMany.mockResolvedValue(tournaments);

    const result = await getInactiveHandler(createMockEvent());

    expect(mockTournamentFindMany).toHaveBeenCalledWith({
      where: { isActive: false },
      orderBy: { createdAt: "desc" },
      select: expect.objectContaining({ id: true, name: true }),
    });
    expect(result).toHaveLength(2);
  });
});

describe("POST /api/admin/tournaments/:id/restore", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 404 when tournament not found", async () => {
    vi.mocked(getRouterParam).mockReturnValue("t99");
    mockTournamentFindFirst.mockResolvedValue(null);

    await expect(restoreHandler(createMockEvent())).rejects.toThrow("Tournament not found");
  });

  it("deactivates current active tournament and restores target", async () => {
    vi.mocked(getRouterParam).mockReturnValue("t1");
    mockTournamentFindFirst.mockResolvedValue({ id: "t1", name: "Old 2024", isActive: false });
    mockTournamentUpdateMany.mockResolvedValue({ count: 1 });
    mockTournamentUpdate.mockResolvedValue({ id: "t1", name: "Old 2024", isActive: true });

    const result = await restoreHandler(createMockEvent());

    expect(mockTournamentUpdateMany).toHaveBeenCalledWith({
      where: { isActive: true },
      data: { isActive: false },
    });
    expect(mockTournamentUpdate).toHaveBeenCalledWith({
      where: { id: "t1" },
      data: { isActive: true },
    });
    expect(result).toMatchObject({ id: "t1" });
  });
});

describe("DELETE /api/admin/tournaments/:id", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 404 when tournament not found", async () => {
    vi.mocked(getRouterParam).mockReturnValue("t99");
    mockTournamentFindFirst.mockResolvedValue(null);

    await expect(deleteHandler(createMockEvent())).rejects.toThrow("Tournament not found");
  });

  it("returns 400 when trying to delete an active tournament", async () => {
    vi.mocked(getRouterParam).mockReturnValue("t1");
    mockTournamentFindFirst.mockResolvedValue({ id: "t1", isActive: true });

    await expect(deleteHandler(createMockEvent())).rejects.toMatchObject({ statusCode: 400 });
  });

  it("deletes inactive tournament", async () => {
    vi.mocked(getRouterParam).mockReturnValue("t1");
    mockTournamentFindFirst.mockResolvedValue({ id: "t1", isActive: false });
    mockTournamentDelete.mockResolvedValue({ id: "t1" });

    const result = await deleteHandler(createMockEvent());

    expect(mockTournamentDelete).toHaveBeenCalledWith({ where: { id: "t1" } });
    expect(result).toMatchObject({ success: true });
  });
});

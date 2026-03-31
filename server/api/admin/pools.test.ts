import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPoolFindMany = vi.hoisted(() => vi.fn());
const mockPoolCreate = vi.hoisted(() => vi.fn());
const mockPoolUpdate = vi.hoisted(() => vi.fn());
const mockPoolDelete = vi.hoisted(() => vi.fn());
const mockPoolDeleteMany = vi.hoisted(() => vi.fn());
const mockPoolFindFirst = vi.hoisted(() => vi.fn());
const mockPoolTeamCreateMany = vi.hoisted(() => vi.fn());
const mockPoolTeamDeleteMany = vi.hoisted(() => vi.fn());
const mockTeamFindMany = vi.hoisted(() => vi.fn());
const mockTournamentFindFirst = vi.hoisted(() => vi.fn());

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
    pool: {
      findMany: mockPoolFindMany,
      findFirst: mockPoolFindFirst,
      create: mockPoolCreate,
      update: mockPoolUpdate,
      delete: mockPoolDelete,
      deleteMany: mockPoolDeleteMany,
    },
    poolTeam: {
      createMany: mockPoolTeamCreateMany,
      deleteMany: mockPoolTeamDeleteMany,
    },
    team: {
      findMany: mockTeamFindMany,
    },
    tournament: {
      findFirst: mockTournamentFindFirst,
    },
  },
}));

vi.mock("~/server/utils/logger", () => ({
  logRequest: vi.fn(),
}));

const { default: getPoolsHandler } = await import("./pools.get");
const { default: generatePoolsHandler } = await import(
  "./pools/generate.post"
);
const { default: updatePoolHandler } = await import("./pools.[id].put");
const { default: deletePoolHandler } = await import("./pools.[id].delete");

function createMockEvent(overrides: any = {}) {
  return {
    _url: "http://localhost/api/admin/pools",
    context: {},
    ...overrides,
  } as any;
}

describe("GET /api/admin/pools", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 404 when no tournament exists", async () => {
    mockTournamentFindFirst.mockResolvedValue(null);

    await expect(getPoolsHandler(createMockEvent())).rejects.toThrow(
      "No tournament found",
    );
  });

  it("returns pools with teams", async () => {
    mockTournamentFindFirst.mockResolvedValue({ id: "t1" });
    mockPoolFindMany.mockResolvedValue([
      {
        id: "p1",
        name: "Poule A",
        teamsAdvancing: 2,
        poolTeams: [{ team: { id: "1", name: "Team A" } }],
      },
    ]);

    const result = await getPoolsHandler(createMockEvent());

    expect(mockPoolFindMany).toHaveBeenCalledWith({
      where: { tournamentId: "t1" },
      include: { poolTeams: { include: { team: true } } },
      orderBy: { name: "asc" },
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ name: "Poule A" });
  });
});

describe("POST /api/admin/pools/generate", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 404 when no tournament exists", async () => {
    mockTournamentFindFirst.mockResolvedValue(null);
    vi.mocked(readBody).mockResolvedValue({ poolCount: 2 });

    await expect(generatePoolsHandler(createMockEvent())).rejects.toThrow(
      "No tournament found",
    );
  });

  it("returns 400 when poolCount is invalid", async () => {
    mockTournamentFindFirst.mockResolvedValue({ id: "t1" });
    vi.mocked(readBody).mockResolvedValue({ poolCount: 0 });

    await expect(generatePoolsHandler(createMockEvent())).rejects.toThrow(
      "Invalid pool count",
    );
  });

  it("returns 400 when not enough teams", async () => {
    mockTournamentFindFirst.mockResolvedValue({ id: "t1" });
    vi.mocked(readBody).mockResolvedValue({ poolCount: 3 });
    mockTeamFindMany.mockResolvedValue([{ id: "1", name: "Team A" }]);
    mockPoolFindMany.mockResolvedValue([]);

    await expect(generatePoolsHandler(createMockEvent())).rejects.toThrow(
      "Not enough teams",
    );
  });

  it("returns 409 when pools exist and overwrite is false", async () => {
    mockTournamentFindFirst.mockResolvedValue({ id: "t1" });
    vi.mocked(readBody).mockResolvedValue({ poolCount: 2 });
    mockTeamFindMany.mockResolvedValue([
      { id: "1", name: "Team A" },
      { id: "2", name: "Team B" },
    ]);
    mockPoolFindMany.mockResolvedValue([{ id: "p1", name: "Poule A" }]);

    await expect(generatePoolsHandler(createMockEvent())).rejects.toThrow(
      "Pools already exist",
    );
  });

  it("generates pools successfully", async () => {
    mockTournamentFindFirst.mockResolvedValue({ id: "t1" });
    vi.mocked(readBody).mockResolvedValue({ poolCount: 2 });
    mockTeamFindMany.mockResolvedValue([
      { id: "1", name: "Team A" },
      { id: "2", name: "Team B" },
      { id: "3", name: "Team C" },
      { id: "4", name: "Team D" },
    ]);
    mockPoolFindMany.mockResolvedValue([]);
    mockPoolCreate
      .mockResolvedValueOnce({ id: "p1", name: "Poule A" })
      .mockResolvedValueOnce({ id: "p2", name: "Poule B" });
    mockPoolTeamCreateMany.mockResolvedValue({ count: 2 });

    const result = await generatePoolsHandler(createMockEvent());

    expect(mockPoolCreate).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ generated: 2 });
  });

  it("deletes existing pools when overwrite is true", async () => {
    mockTournamentFindFirst.mockResolvedValue({ id: "t1" });
    vi.mocked(readBody).mockResolvedValue({ poolCount: 2, overwrite: true });
    mockTeamFindMany.mockResolvedValue([
      { id: "1", name: "Team A" },
      { id: "2", name: "Team B" },
      { id: "3", name: "Team C" },
      { id: "4", name: "Team D" },
    ]);
    mockPoolFindMany.mockResolvedValue([{ id: "p1", name: "Poule A" }]);
    mockPoolDeleteMany.mockResolvedValue({ count: 1 });
    mockPoolCreate
      .mockResolvedValueOnce({ id: "p2", name: "Poule A" })
      .mockResolvedValueOnce({ id: "p3", name: "Poule B" });
    mockPoolTeamCreateMany.mockResolvedValue({ count: 2 });

    await generatePoolsHandler(createMockEvent());

    expect(mockPoolDeleteMany).toHaveBeenCalledWith({
      where: { tournamentId: "t1" },
    });
  });
});

describe("PUT /api/admin/pools/:id", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 for invalid ID", async () => {
    vi.mocked(getRouterParam).mockReturnValue("");

    await expect(updatePoolHandler(createMockEvent())).rejects.toThrow(
      "Invalid pool ID",
    );
  });

  it("returns 404 when pool not found", async () => {
    vi.mocked(getRouterParam).mockReturnValue("p1");
    mockTournamentFindFirst.mockResolvedValue({ id: "t1" });
    vi.mocked(readBody).mockResolvedValue({ name: "Poule X" });
    mockPoolFindFirst.mockResolvedValue(null);

    await expect(updatePoolHandler(createMockEvent())).rejects.toThrow(
      "Pool not found",
    );
  });

  it("updates pool name and teamsAdvancing", async () => {
    vi.mocked(getRouterParam).mockReturnValue("p1");
    mockTournamentFindFirst.mockResolvedValue({ id: "t1" });
    vi.mocked(readBody).mockResolvedValue({
      name: "Poule X",
      teamsAdvancing: 1,
    });
    mockPoolFindFirst.mockResolvedValue({ id: "p1", name: "Poule A" });
    mockPoolUpdate.mockResolvedValue({
      id: "p1",
      name: "Poule X",
      teamsAdvancing: 1,
    });

    const result = await updatePoolHandler(createMockEvent());

    expect(mockPoolUpdate).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: expect.objectContaining({ name: "Poule X", teamsAdvancing: 1 }),
    });
    expect(result).toMatchObject({ name: "Poule X" });
  });

  it("reassigns teams when teamIds provided", async () => {
    vi.mocked(getRouterParam).mockReturnValue("p1");
    mockTournamentFindFirst.mockResolvedValue({ id: "t1" });
    vi.mocked(readBody).mockResolvedValue({ teamIds: ["t2", "t3"] });
    mockPoolFindFirst.mockResolvedValue({ id: "p1", name: "Poule A" });
    mockPoolUpdate.mockResolvedValue({ id: "p1", name: "Poule A" });
    mockPoolTeamDeleteMany.mockResolvedValue({ count: 2 });
    mockPoolTeamCreateMany.mockResolvedValue({ count: 2 });

    await updatePoolHandler(createMockEvent());

    expect(mockPoolTeamDeleteMany).toHaveBeenCalledWith({
      where: { poolId: "p1" },
    });
    expect(mockPoolTeamCreateMany).toHaveBeenCalledWith({
      data: [
        { poolId: "p1", teamId: "t2" },
        { poolId: "p1", teamId: "t3" },
      ],
    });
  });
});

describe("DELETE /api/admin/pools/:id", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 for invalid ID", async () => {
    vi.mocked(getRouterParam).mockReturnValue("");

    await expect(deletePoolHandler(createMockEvent())).rejects.toThrow(
      "Invalid pool ID",
    );
  });

  it("deletes pool successfully", async () => {
    vi.mocked(getRouterParam).mockReturnValue("p1");
    mockPoolDelete.mockResolvedValue({ id: "p1" });

    const result = await deletePoolHandler(createMockEvent());

    expect(mockPoolDelete).toHaveBeenCalledWith({ where: { id: "p1" } });
    expect(result).toEqual({ success: true });
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockTeamFindMany = vi.hoisted(() => vi.fn());
const mockTeamCreate = vi.hoisted(() => vi.fn());
const mockTeamUpdate = vi.hoisted(() => vi.fn());
const mockTeamDelete = vi.hoisted(() => vi.fn());
const mockTeamFindFirst = vi.hoisted(() => vi.fn());
const mockTournamentFindFirst = vi.hoisted(() => vi.fn());

// Map error codes to HTTP status codes (must match server/utils/errors.ts)
const codeToStatusCode: Record<string, number> = {
  team_name_empty: 400,
  team_name_exists: 409,
  team_not_found: 404,
  invalid_team_id: 400,
  invalid_input: 400,
  tournament_not_found: 404,
  unexpected_error: 500,
};

vi.stubGlobal("defineEventHandler", (handler: any) => handler);
vi.stubGlobal("readBody", vi.fn());
vi.stubGlobal("getRouterParam", vi.fn());
vi.stubGlobal("setResponseStatus", vi.fn());
vi.stubGlobal("getQuery", vi.fn());
vi.stubGlobal("createApiError", ({ error, code, reason }: any) => {
  const statusCode = codeToStatusCode[code] ?? 500;
  const err = new Error(reason) as any;
  err.statusCode = statusCode;
  err.data = { error, code, reason, stacktrace: {} };
  return err;
});

vi.mock("~/server/utils/prisma", () => ({
  prisma: {
    team: {
      findMany: mockTeamFindMany,
      findFirst: mockTeamFindFirst,
      create: mockTeamCreate,
      update: mockTeamUpdate,
      delete: mockTeamDelete,
    },
    tournament: {
      findFirst: mockTournamentFindFirst,
    },
  },
}));

vi.mock("~/server/utils/logger", () => ({
  logRequest: vi.fn(),
}));

const { default: getTeamsHandler } = await import("./teams.get");
const { default: createTeamHandler } = await import("./teams.post");
const { default: updateTeamHandler } = await import("./teams/[id].put");
const { default: deleteTeamHandler } = await import("./teams/[id].delete");

function createMockEvent(overrides: any = {}) {
  return {
    _url: "http://localhost/api/admin/teams",
    context: {},
    ...overrides,
  } as any;
}

describe("GET /api/admin/teams", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 404 when no tournament exists", async () => {
    mockTournamentFindFirst.mockResolvedValue(null);
    vi.mocked(getQuery).mockReturnValue({});

    await expect(getTeamsHandler(createMockEvent())).rejects.toThrow(
      "No tournament found",
    );
  });

  it("returns all teams for the tournament", async () => {
    mockTournamentFindFirst.mockResolvedValue({ id: "t1" });
    vi.mocked(getQuery).mockReturnValue({});
    mockTeamFindMany.mockResolvedValue([
      { id: "1", name: "Team A", tournamentId: "t1" },
      { id: "2", name: "Team B", tournamentId: "t1" },
    ]);

    const result = await getTeamsHandler(createMockEvent());

    expect(mockTeamFindMany).toHaveBeenCalledWith({
      where: { tournamentId: "t1" },
      orderBy: { name: "asc" },
    });
    expect(result).toHaveLength(2);
  });
});

describe("POST /api/admin/teams", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 when name is missing", async () => {
    mockTournamentFindFirst.mockResolvedValue({ id: "t1" });
    vi.mocked(readBody).mockResolvedValue({ name: "" });

    await expect(createTeamHandler(createMockEvent())).rejects.toThrow(
      "Missing name field",
    );
  });

  it("returns 409 when team name already exists", async () => {
    mockTournamentFindFirst.mockResolvedValue({ id: "t1" });
    vi.mocked(readBody).mockResolvedValue({ name: "Team A" });
    mockTeamFindFirst.mockResolvedValue({ id: "1", name: "Team A" });

    await expect(createTeamHandler(createMockEvent())).rejects.toThrow(
      "Duplicate team name",
    );
  });

  it("creates a team successfully", async () => {
    mockTournamentFindFirst.mockResolvedValue({ id: "t1" });
    vi.mocked(readBody).mockResolvedValue({ name: "Team A" });
    mockTeamFindFirst.mockResolvedValue(null);
    mockTeamCreate.mockResolvedValue({
      id: "1",
      name: "Team A",
      tournamentId: "t1",
    });

    const result = await createTeamHandler(createMockEvent());

    expect(mockTeamCreate).toHaveBeenCalledWith({
      data: { name: "Team A", tournamentId: "t1" },
    });
    expect(result).toMatchObject({ name: "Team A" });
  });
});

describe("PUT /api/admin/teams/:id", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 for invalid ID", async () => {
    vi.mocked(getRouterParam).mockReturnValue("");

    await expect(updateTeamHandler(createMockEvent())).rejects.toThrow(
      "Invalid team ID",
    );
  });

  it("returns 400 when name is missing", async () => {
    vi.mocked(getRouterParam).mockReturnValue("1");
    mockTournamentFindFirst.mockResolvedValue({ id: "t1" });
    vi.mocked(readBody).mockResolvedValue({ name: "" });

    await expect(updateTeamHandler(createMockEvent())).rejects.toThrow(
      "Missing name field",
    );
  });

  it("returns 409 when new name is a duplicate", async () => {
    vi.mocked(getRouterParam).mockReturnValue("1");
    mockTournamentFindFirst.mockResolvedValue({ id: "t1" });
    vi.mocked(readBody).mockResolvedValue({ name: "Team B" });
    mockTeamFindFirst.mockResolvedValue({ id: "2", name: "Team B" });

    await expect(updateTeamHandler(createMockEvent())).rejects.toThrow(
      "Duplicate team name",
    );
  });

  it("updates team name successfully", async () => {
    vi.mocked(getRouterParam).mockReturnValue("1");
    mockTournamentFindFirst.mockResolvedValue({ id: "t1" });
    vi.mocked(readBody).mockResolvedValue({ name: "Team B" });
    mockTeamFindFirst.mockResolvedValue(null);
    mockTeamUpdate.mockResolvedValue({
      id: "1",
      name: "Team B",
      tournamentId: "t1",
    });

    const result = await updateTeamHandler(createMockEvent());

    expect(mockTeamUpdate).toHaveBeenCalledWith({
      where: { id: "1" },
      data: { name: "Team B" },
    });
    expect(result).toMatchObject({ name: "Team B" });
  });
});

describe("DELETE /api/admin/teams/:id", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 for invalid ID", async () => {
    vi.mocked(getRouterParam).mockReturnValue("");

    await expect(deleteTeamHandler(createMockEvent())).rejects.toThrow(
      "Invalid team ID",
    );
  });

  it("returns 404 when team does not exist", async () => {
    vi.mocked(getRouterParam).mockReturnValue("999");
    mockTeamFindFirst.mockResolvedValue(null);

    await expect(deleteTeamHandler(createMockEvent())).rejects.toThrow(
      "Team not found",
    );
  });

  it("deletes a team successfully", async () => {
    vi.mocked(getRouterParam).mockReturnValue("5");
    mockTeamFindFirst.mockResolvedValue({ id: "5", name: "Team A" });
    mockTeamDelete.mockResolvedValue({ id: "5" });

    const result = await deleteTeamHandler(createMockEvent());

    expect(mockTeamDelete).toHaveBeenCalledWith({ where: { id: "5" } });
    expect(result).toEqual(null);
  });
});

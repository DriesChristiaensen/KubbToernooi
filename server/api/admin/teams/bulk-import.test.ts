import { describe, it, expect, vi, beforeEach } from "vitest";

const mockTeamFindMany = vi.hoisted(() => vi.fn());
const mockTeamCreateMany = vi.hoisted(() => vi.fn());
const mockTournamentFindFirst = vi.hoisted(() => vi.fn());

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
    team: {
      findMany: mockTeamFindMany,
      createMany: mockTeamCreateMany,
    },
    tournament: {
      findFirst: mockTournamentFindFirst,
    },
  },
}));

vi.mock("~/server/utils/logger", () => ({
  logRequest: vi.fn(),
}));

const { default: bulkImportHandler } = await import("./bulk-import.post");

function createMockEvent(overrides: any = {}) {
  return {
    _url: "http://localhost/api/admin/teams/bulk-import",
    context: {},
    ...overrides,
  } as any;
}

describe("POST /api/admin/teams/bulk-import", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 404 when no tournament exists", async () => {
    mockTournamentFindFirst.mockResolvedValue(null);
    vi.mocked(readBody).mockResolvedValue({ names: ["Team A"] });

    await expect(bulkImportHandler(createMockEvent())).rejects.toThrow(
      "No tournament found",
    );
  });

  it("returns 400 when names list is empty", async () => {
    mockTournamentFindFirst.mockResolvedValue({ id: "t1" });
    vi.mocked(readBody).mockResolvedValue({ names: [] });

    await expect(bulkImportHandler(createMockEvent())).rejects.toThrow(
      "Empty names list",
    );
  });

  it("returns 400 when all names are blank after trimming", async () => {
    mockTournamentFindFirst.mockResolvedValue({ id: "t1" });
    vi.mocked(readBody).mockResolvedValue({ names: ["  ", "", "\t"] });

    await expect(bulkImportHandler(createMockEvent())).rejects.toThrow(
      "Empty names list",
    );
  });

  it("returns 409 when duplicate names exist within the list", async () => {
    mockTournamentFindFirst.mockResolvedValue({ id: "t1" });
    vi.mocked(readBody).mockResolvedValue({
      names: ["Team A", "Team B", "Team A"],
    });
    mockTeamFindMany.mockResolvedValue([]);

    await expect(bulkImportHandler(createMockEvent())).rejects.toThrow(
      "Duplicates within list",
    );
  });

  it("returns 409 when a name already exists in the DB", async () => {
    mockTournamentFindFirst.mockResolvedValue({ id: "t1" });
    vi.mocked(readBody).mockResolvedValue({ names: ["Team A", "Team B"] });
    mockTeamFindMany.mockResolvedValue([{ id: "ta1", name: "Team A" }]);

    await expect(bulkImportHandler(createMockEvent())).rejects.toThrow(
      "Duplicates in database",
    );
  });

  it("creates all teams and returns count", async () => {
    mockTournamentFindFirst.mockResolvedValue({ id: "t1" });
    vi.mocked(readBody).mockResolvedValue({ names: ["Team A", "Team B"] });
    mockTeamFindMany.mockResolvedValue([]);
    mockTeamCreateMany.mockResolvedValue({ count: 2 });

    const result = await bulkImportHandler(createMockEvent());

    expect(mockTeamCreateMany).toHaveBeenCalledWith({
      data: [
        { name: "Team A", tournamentId: "t1" },
        { name: "Team B", tournamentId: "t1" },
      ],
    });
    expect(result).toEqual({ imported: 2 });
  });

  it("parses CSV and extracts first column", async () => {
    mockTournamentFindFirst.mockResolvedValue({ id: "t1" });
    vi.mocked(readBody).mockResolvedValue({
      csv: "Team A,extra\nTeam B,extra\n",
    });
    mockTeamFindMany.mockResolvedValue([]);
    mockTeamCreateMany.mockResolvedValue({ count: 2 });

    const result = await bulkImportHandler(createMockEvent());

    expect(mockTeamCreateMany).toHaveBeenCalledWith({
      data: [
        { name: "Team A", tournamentId: "t1" },
        { name: "Team B", tournamentId: "t1" },
      ],
    });
    expect(result).toEqual({ imported: 2 });
  });

  it("returns 400 when CSV has no valid names", async () => {
    mockTournamentFindFirst.mockResolvedValue({ id: "t1" });
    vi.mocked(readBody).mockResolvedValue({ csv: ",extra\n,other\n" });

    await expect(bulkImportHandler(createMockEvent())).rejects.toThrow(
      "Empty names list",
    );
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockTournamentFindFirst = vi.hoisted(() => vi.fn());
const mockTournamentUpdateMany = vi.hoisted(() => vi.fn());
const mockTournamentCreate = vi.hoisted(() => vi.fn());
const mockTeamCreate = vi.hoisted(() => vi.fn());
const mockFieldCreate = vi.hoisted(() => vi.fn());
const mockPoolCreate = vi.hoisted(() => vi.fn());
const mockPoolTeamCreate = vi.hoisted(() => vi.fn());
const mockMatchCreate = vi.hoisted(() => vi.fn());
const mockMatchUpdate = vi.hoisted(() => vi.fn());
const mockStandingCreate = vi.hoisted(() => vi.fn());
const mockUserFindFirst = vi.hoisted(() => vi.fn());
const mockBcryptCompare = vi.hoisted(() => vi.fn());

vi.stubGlobal("defineEventHandler", (handler: any) => handler);
vi.stubGlobal("readBody", vi.fn());
vi.stubGlobal("setResponseStatus", vi.fn());
vi.stubGlobal("createApiError", ({ error, code, reason }: any) => {
  const err = new Error(reason) as any;
  err.statusCode = code;
  err.data = { error, code, reason, stacktrace: {} };
  return err;
});

vi.mock("~/server/utils/prisma", () => {
  const mockPrisma: any = {
    tournament: {
      findFirst: mockTournamentFindFirst,
      updateMany: mockTournamentUpdateMany,
      create: mockTournamentCreate,
    },
    team: { create: mockTeamCreate },
    field: { create: mockFieldCreate },
    pool: { create: mockPoolCreate },
    poolTeam: { create: mockPoolTeamCreate },
    match: { create: mockMatchCreate, update: mockMatchUpdate },
    standing: { create: mockStandingCreate },
    user: { findFirst: mockUserFindFirst },
  };
  mockPrisma.$transaction = vi.fn((callback: any) => callback(mockPrisma));
  return { prisma: mockPrisma };
});

vi.mock("bcrypt", () => ({ default: { compare: mockBcryptCompare } }));
vi.mock("~/server/utils/logger", () => ({ logRequest: vi.fn() }));

const { default: handler } = await import("./import.post");

function createMockEvent() {
  return { _url: "/api/admin/import", context: {} } as any;
}

const validData = {
  tournament: { name: "Kubb 2025", status: "DRAFT", type: "POOLS", startTime: "2025-06-01T08:00:00Z", matchDuration: 15, breakTime: 5, pointsWin: 3, pointsDraw: 1, pointsLoss: 0 },
  teams: [],
  fields: [],
  pools: [],
  matches: [],
  standings: [],
};

describe("POST /api/admin/import", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 when body is missing data field", async () => {
    vi.mocked(readBody).mockResolvedValue({});

    await expect(handler(createMockEvent())).rejects.toThrow("Invalid import format");
  });

  it("returns 400 when tournament field is missing from data", async () => {
    vi.mocked(readBody).mockResolvedValue({ data: { teams: [] } });

    await expect(handler(createMockEvent())).rejects.toThrow("Invalid import format");
  });

  it("returns 409 when data exists and no password provided", async () => {
    vi.mocked(readBody).mockResolvedValue({ data: validData });
    mockTournamentFindFirst.mockResolvedValue({ id: "t1" });

    await expect(handler(createMockEvent())).rejects.toThrow("Password required");
  });

  it("returns 401 when password is wrong", async () => {
    vi.mocked(readBody).mockResolvedValue({ data: validData, password: "wrong" });
    mockTournamentFindFirst.mockResolvedValue({ id: "t1" });
    mockUserFindFirst.mockResolvedValue({ id: "u1", password: "hash" });
    mockBcryptCompare.mockResolvedValue(false);

    await expect(handler(createMockEvent())).rejects.toThrow("Invalid password");
  });

  it("imports tournament when no existing data", async () => {
    vi.mocked(readBody).mockResolvedValue({ data: validData });
    mockTournamentFindFirst.mockResolvedValue(null);
    mockTournamentCreate.mockResolvedValue({ id: "t10" });

    const result = await handler(createMockEvent());

    expect(mockTournamentUpdateMany).not.toHaveBeenCalled();
    expect(mockTournamentCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ name: "Kubb 2025" }) }),
    );
    expect(result).toMatchObject({ imported: true });
  });

  it("imports KO bye match (null teamBId) and restores nextMatchId", async () => {
    const koMatches = [
      { id: "old-m1", phase: "KO", round: 1, startTime: "2025-06-01T14:00:00Z", fieldId: "f1", teamAId: "team1", teamBId: null, scoreA: null, scoreB: null, status: "PLAYED", koWinnerId: null, nextMatchId: "old-m2", poolId: null },
      { id: "old-m2", phase: "KO", round: 2, startTime: "2025-06-01T15:00:00Z", fieldId: "f1", teamAId: null, teamBId: null, scoreA: null, scoreB: null, status: "SCHEDULED", koWinnerId: null, nextMatchId: null, poolId: null },
    ];
    const dataWithKo = { ...validData, matches: koMatches, teams: [{ id: "team1", name: "Team A" }], fields: [{ id: "f1", name: "Veld 1" }] };

    vi.mocked(readBody).mockResolvedValue({ data: dataWithKo });
    mockTournamentFindFirst.mockResolvedValue(null);
    mockTournamentCreate.mockResolvedValue({ id: "t10" });
    mockTeamCreate.mockResolvedValue({ id: "new-team1" });
    mockFieldCreate.mockResolvedValue({ id: "new-f1" });
    mockMatchCreate
      .mockResolvedValueOnce({ id: "new-m1" })
      .mockResolvedValueOnce({ id: "new-m2" });
    mockMatchUpdate.mockResolvedValue({});

    await handler(createMockEvent());

    // Bye match (null teamBId) must be created
    expect(mockMatchCreate).toHaveBeenCalledTimes(2);
    const byeCall = mockMatchCreate.mock.calls.find((c) => c[0].data.status === "PLAYED");
    expect(byeCall).toBeDefined();
    expect(byeCall![0].data.teamBId).toBeNull();

    // nextMatchId must be restored in a second pass
    expect(mockMatchUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "new-m1" }, data: { nextMatchId: "new-m2" } }),
    );
  });

  it("replaces existing data with correct password", async () => {
    vi.mocked(readBody).mockResolvedValue({ data: validData, password: "correct" });
    mockTournamentFindFirst.mockResolvedValue({ id: "t1" });
    mockUserFindFirst.mockResolvedValue({ id: "u1", password: "hash" });
    mockBcryptCompare.mockResolvedValue(true);
    mockTournamentUpdateMany.mockResolvedValue({ count: 1 });
    mockTournamentCreate.mockResolvedValue({ id: "t10" });

    const result = await handler(createMockEvent());

    expect(mockTournamentUpdateMany).toHaveBeenCalled();
    expect(mockTournamentCreate).toHaveBeenCalled();
    expect(result).toMatchObject({ imported: true });
  });
});

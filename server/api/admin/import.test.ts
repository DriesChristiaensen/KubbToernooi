import { describe, it, expect, vi, beforeEach } from "vitest";

const mockTournamentFindFirst = vi.hoisted(() => vi.fn());
const mockTournamentUpdateMany = vi.hoisted(() => vi.fn());
const mockTournamentCreate = vi.hoisted(() => vi.fn());
const mockTeamCreate = vi.hoisted(() => vi.fn());
const mockFieldCreate = vi.hoisted(() => vi.fn());
const mockPoolCreate = vi.hoisted(() => vi.fn());
const mockPoolTeamCreate = vi.hoisted(() => vi.fn());
const mockMatchCreate = vi.hoisted(() => vi.fn());
const mockStandingCreate = vi.hoisted(() => vi.fn());
const mockUserFindFirst = vi.hoisted(() => vi.fn());
const mockBcryptCompare = vi.hoisted(() => vi.fn());

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
      updateMany: mockTournamentUpdateMany,
      create: mockTournamentCreate,
    },
    team: { create: mockTeamCreate },
    field: { create: mockFieldCreate },
    pool: { create: mockPoolCreate },
    poolTeam: { create: mockPoolTeamCreate },
    match: { create: mockMatchCreate },
    standing: { create: mockStandingCreate },
    user: { findFirst: mockUserFindFirst },
  },
}));

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

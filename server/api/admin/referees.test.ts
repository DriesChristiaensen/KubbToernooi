import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockPrismaUserFindMany = vi.hoisted(() => vi.fn())
const mockPrismaUserCreate = vi.hoisted(() => vi.fn())
const mockPrismaUserDelete = vi.hoisted(() => vi.fn())
const mockPrismaUserFindFirst = vi.hoisted(() => vi.fn())
const mockPrismaUserUpdate = vi.hoisted(() => vi.fn())

vi.stubGlobal('defineEventHandler', (handler: any) => handler)
vi.stubGlobal('readBody', vi.fn())
vi.stubGlobal('getRouterParam', vi.fn())
vi.stubGlobal('createApiError', ({ error, code, reason }: any) => {
  const err = new Error(reason) as any
  err.statusCode = code
  err.data = { error, code, reason, stacktrace: {} }
  return err
})

vi.mock('~/server/utils/prisma', () => ({
  prisma: {
    user: {
      findMany: mockPrismaUserFindMany,
      findFirst: mockPrismaUserFindFirst,
      create: mockPrismaUserCreate,
      delete: mockPrismaUserDelete,
      update: mockPrismaUserUpdate,
    },
  },
}))

vi.mock('~/server/utils/logger', () => ({
  logRequest: vi.fn(),
}))

const { default: getRefereesHandler } = await import('./referees.get')
const { default: createRefereeHandler } = await import('./referees.post')
const { default: deleteRefereeHandler } = await import('./referees/[id].delete')
const { default: resetPasswordHandler } = await import('./referees/[id].reset-password.post')

function createMockEvent(overrides: any = {}) {
  return { _url: 'http://localhost/api/admin/referees', context: {}, ...overrides } as any
}

describe('GET /api/admin/referees', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns list of referees without passwords', async () => {
    mockPrismaUserFindMany.mockResolvedValue([
      { id: 'u2', name: 'Jan', role: 'REFEREE', createdAt: new Date(), updatedAt: new Date(), password: 'hash' },
      { id: 'u3', name: 'Piet', role: 'REFEREE', createdAt: new Date(), updatedAt: new Date(), password: 'hash' },
    ])
    const event = createMockEvent()

    const result = await getRefereesHandler(event)

    expect(mockPrismaUserFindMany).toHaveBeenCalledWith({
      where: { role: 'REFEREE' },
      select: { id: true, name: true, createdAt: true },
    })
    expect(result).toHaveLength(2)
  })
})

describe('POST /api/admin/referees', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates a new referee without password', async () => {
    vi.mocked(readBody).mockResolvedValue({ name: 'Jan' })
    mockPrismaUserFindFirst.mockResolvedValue(null)
    mockPrismaUserCreate.mockResolvedValue({ id: 'u2', name: 'Jan', role: 'REFEREE' })
    const event = createMockEvent()

    const result = await createRefereeHandler(event)

    expect(mockPrismaUserCreate).toHaveBeenCalledWith({
      data: {
        name: 'Jan',
        password: null,
        role: 'REFEREE',
      },
      select: { id: true, name: true, createdAt: true },
    })
    expect(result).toMatchObject({ name: 'Jan' })
  })

  it('rejects duplicate referee name', async () => {
    vi.mocked(readBody).mockResolvedValue({ name: 'Jan' })
    mockPrismaUserFindFirst.mockResolvedValue({ id: 'u2', name: 'Jan' })
    const event = createMockEvent()

    await expect(createRefereeHandler(event)).rejects.toMatchObject({
      statusCode: 409,
    })
  })

  it('rejects missing name', async () => {
    vi.mocked(readBody).mockResolvedValue({})
    const event = createMockEvent()

    await expect(createRefereeHandler(event)).rejects.toMatchObject({
      statusCode: 400,
    })
  })
})

describe('POST /api/admin/referees/:id/reset-password', () => {
  beforeEach(() => vi.clearAllMocks())

  it('resets referee password to null', async () => {
    vi.mocked(getRouterParam).mockReturnValue('u2')
    mockPrismaUserUpdate.mockResolvedValue({ id: 'u2', name: 'Jan' })
    const event = createMockEvent()

    const result = await resetPasswordHandler(event)

    expect(mockPrismaUserUpdate).toHaveBeenCalledWith({
      where: { id: 'u2', role: 'REFEREE' },
      data: { password: null },
    })
    expect(result).toEqual({ success: true })
  })

  it('rejects empty id', async () => {
    vi.mocked(getRouterParam).mockReturnValue('')
    const event = createMockEvent()

    await expect(resetPasswordHandler(event)).rejects.toMatchObject({
      statusCode: 400,
    })
  })
})

describe('DELETE /api/admin/referees/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('deletes a referee by id', async () => {
    vi.mocked(getRouterParam).mockReturnValue('u2')
    mockPrismaUserDelete.mockResolvedValue({ id: 'u2' })
    const event = createMockEvent()

    const result = await deleteRefereeHandler(event)

    expect(mockPrismaUserDelete).toHaveBeenCalledWith({ where: { id: 'u2', role: 'REFEREE' } })
    expect(result).toEqual({ success: true })
  })

  it('rejects empty id', async () => {
    vi.mocked(getRouterParam).mockReturnValue('')
    const event = createMockEvent()

    await expect(deleteRefereeHandler(event)).rejects.toMatchObject({
      statusCode: 400,
    })
  })
})

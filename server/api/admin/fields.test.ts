import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFieldFindMany = vi.hoisted(() => vi.fn())
const mockFieldCreate = vi.hoisted(() => vi.fn())
const mockFieldUpdate = vi.hoisted(() => vi.fn())
const mockFieldDelete = vi.hoisted(() => vi.fn())
const mockFieldFindFirst = vi.hoisted(() => vi.fn())
const mockTournamentFindFirst = vi.hoisted(() => vi.fn())

vi.stubGlobal('defineEventHandler', (handler: any) => handler)
vi.stubGlobal('readBody', vi.fn())
vi.stubGlobal('getRouterParam', vi.fn())
vi.stubGlobal('getQuery', vi.fn())
vi.stubGlobal('createApiError', ({ error, code, reason }: any) => {
  const err = new Error(reason) as any
  err.statusCode = code
  err.data = { error, code, reason, stacktrace: {} }
  return err
})

vi.mock('~/server/utils/prisma', () => ({
  prisma: {
    field: {
      findMany: mockFieldFindMany,
      findFirst: mockFieldFindFirst,
      create: mockFieldCreate,
      update: mockFieldUpdate,
      delete: mockFieldDelete,
    },
    tournament: {
      findFirst: mockTournamentFindFirst,
    },
  },
}))

vi.mock('~/server/utils/logger', () => ({
  logRequest: vi.fn(),
}))

const { default: getFieldsHandler } = await import('./fields.get')
const { default: createFieldHandler } = await import('./fields.post')
const { default: updateFieldHandler } = await import('./fields.[id].put')
const { default: deleteFieldHandler } = await import('./fields.[id].delete')

function createMockEvent(overrides: any = {}) {
  return { _url: 'http://localhost/api/admin/fields', context: {}, ...overrides } as any
}

describe('GET /api/admin/fields', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 404 when no tournament exists', async () => {
    mockTournamentFindFirst.mockResolvedValue(null)

    await expect(getFieldsHandler(createMockEvent())).rejects.toThrow('No tournament found')
  })

  it('returns all fields for the tournament', async () => {
    mockTournamentFindFirst.mockResolvedValue({ id: 1 })
    mockFieldFindMany.mockResolvedValue([
      { id: 1, name: 'Veld 1', tournamentId: 1 },
      { id: 2, name: 'Veld 2', tournamentId: 1 },
    ])

    const result = await getFieldsHandler(createMockEvent())

    expect(mockFieldFindMany).toHaveBeenCalledWith({
      where: { tournamentId: 1 },
      orderBy: { name: 'asc' },
    })
    expect(result).toHaveLength(2)
  })
})

describe('POST /api/admin/fields', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 400 when name is missing', async () => {
    mockTournamentFindFirst.mockResolvedValue({ id: 1 })
    vi.mocked(readBody).mockResolvedValue({ name: '' })

    await expect(createFieldHandler(createMockEvent())).rejects.toThrow('Missing name field')
  })

  it('returns 409 when field name already exists', async () => {
    mockTournamentFindFirst.mockResolvedValue({ id: 1 })
    vi.mocked(readBody).mockResolvedValue({ name: 'Veld 1' })
    mockFieldFindFirst.mockResolvedValue({ id: 1, name: 'Veld 1' })

    await expect(createFieldHandler(createMockEvent())).rejects.toThrow('Duplicate field name')
  })

  it('creates a field successfully', async () => {
    mockTournamentFindFirst.mockResolvedValue({ id: 1 })
    vi.mocked(readBody).mockResolvedValue({ name: 'Veld 1' })
    mockFieldFindFirst.mockResolvedValue(null)
    mockFieldCreate.mockResolvedValue({ id: 1, name: 'Veld 1', tournamentId: 1 })

    const result = await createFieldHandler(createMockEvent())

    expect(mockFieldCreate).toHaveBeenCalledWith({
      data: { name: 'Veld 1', tournamentId: 1 },
    })
    expect(result).toMatchObject({ name: 'Veld 1' })
  })
})

describe('PUT /api/admin/fields/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 400 for invalid ID', async () => {
    vi.mocked(getRouterParam).mockReturnValue('abc')

    await expect(updateFieldHandler(createMockEvent())).rejects.toThrow('Invalid field ID')
  })

  it('returns 400 when name is missing', async () => {
    vi.mocked(getRouterParam).mockReturnValue('1')
    mockTournamentFindFirst.mockResolvedValue({ id: 1 })
    vi.mocked(readBody).mockResolvedValue({ name: '' })

    await expect(updateFieldHandler(createMockEvent())).rejects.toThrow('Missing name field')
  })

  it('returns 409 when new name is a duplicate', async () => {
    vi.mocked(getRouterParam).mockReturnValue('1')
    mockTournamentFindFirst.mockResolvedValue({ id: 1 })
    vi.mocked(readBody).mockResolvedValue({ name: 'Veld 2' })
    mockFieldFindFirst.mockResolvedValue({ id: 2, name: 'Veld 2' })

    await expect(updateFieldHandler(createMockEvent())).rejects.toThrow('Duplicate field name')
  })

  it('updates field name successfully', async () => {
    vi.mocked(getRouterParam).mockReturnValue('1')
    mockTournamentFindFirst.mockResolvedValue({ id: 1 })
    vi.mocked(readBody).mockResolvedValue({ name: 'Veld 2' })
    mockFieldFindFirst.mockResolvedValue(null)
    mockFieldUpdate.mockResolvedValue({ id: 1, name: 'Veld 2', tournamentId: 1 })

    const result = await updateFieldHandler(createMockEvent())

    expect(mockFieldUpdate).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { name: 'Veld 2' },
    })
    expect(result).toMatchObject({ name: 'Veld 2' })
  })
})

describe('DELETE /api/admin/fields/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 400 for invalid ID', async () => {
    vi.mocked(getRouterParam).mockReturnValue('abc')

    await expect(deleteFieldHandler(createMockEvent())).rejects.toThrow('Invalid field ID')
  })

  it('deletes a field successfully', async () => {
    vi.mocked(getRouterParam).mockReturnValue('3')
    mockFieldDelete.mockResolvedValue({ id: 3 })

    const result = await deleteFieldHandler(createMockEvent())

    expect(mockFieldDelete).toHaveBeenCalledWith({ where: { id: 3 } })
    expect(result).toEqual({ success: true })
  })
})



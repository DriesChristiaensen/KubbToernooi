import { describe, it, expect, vi, beforeEach } from 'vitest'
import bcrypt from 'bcrypt'

const mockUserFindFirst = vi.hoisted(() => vi.fn())
const mockResetRateLimitStore = vi.hoisted(() => vi.fn())

vi.stubGlobal('defineEventHandler', (handler: any) => handler)
vi.stubGlobal('readBody', vi.fn())
vi.stubGlobal('createApiError', ({ error, code, reason }: any) => {
  const err = new Error(reason) as any
  err.statusCode = code
  err.data = { error, code, reason, stacktrace: {} }
  return err
})

vi.mock('~/server/utils/prisma', () => ({
  prisma: { user: { findFirst: mockUserFindFirst } },
}))

vi.mock('~/server/utils/rate-limit', () => ({
  resetRateLimitStore: mockResetRateLimitStore,
}))

const { default: handler } = await import('./reset-rate-limit.post')

function createMockEvent() {
  return { _url: '/api/auth/reset-rate-limit', context: {} } as any
}

describe('POST /api/auth/reset-rate-limit', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 400 when no password provided', async () => {
    vi.mocked(readBody).mockResolvedValue({})

    await expect(handler(createMockEvent())).rejects.toThrow('Missing password')
  })

  it('returns 404 when no admin account exists', async () => {
    vi.mocked(readBody).mockResolvedValue({ password: 'admin!' })
    mockUserFindFirst.mockResolvedValue(null)

    await expect(handler(createMockEvent())).rejects.toThrow('Admin not found')
  })

  it('returns 401 for wrong password', async () => {
    const hashed = await bcrypt.hash('correct', 10)
    vi.mocked(readBody).mockResolvedValue({ password: 'wrong' })
    mockUserFindFirst.mockResolvedValue({ id: 1, role: 'ADMIN', password: hashed })

    await expect(handler(createMockEvent())).rejects.toThrow('Invalid password')
  })

  it('resets rate limit store and returns { reset: true } on correct password', async () => {
    const hashed = await bcrypt.hash('admin!', 10)
    vi.mocked(readBody).mockResolvedValue({ password: 'admin!' })
    mockUserFindFirst.mockResolvedValue({ id: 1, role: 'ADMIN', password: hashed })

    const result = await handler(createMockEvent())

    expect(mockResetRateLimitStore).toHaveBeenCalledOnce()
    expect(result).toEqual({ reset: true })
  })
})

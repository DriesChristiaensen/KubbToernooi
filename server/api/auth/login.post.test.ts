import { describe, it, expect, vi, beforeEach } from 'vitest'
import bcrypt from 'bcrypt'

const mockPrismaUserFindFirst = vi.hoisted(() => vi.fn())
const mockReplaceUserSession = vi.hoisted(() => vi.fn())
const mockCheckRateLimit = vi.hoisted(() => vi.fn())
const mockResetRateLimitForIp = vi.hoisted(() => vi.fn())

vi.stubGlobal('defineEventHandler', (handler: any) => handler)
vi.stubGlobal('readBody', vi.fn())
vi.stubGlobal('getRequestIP', vi.fn().mockReturnValue('127.0.0.1'))
vi.stubGlobal('replaceUserSession', mockReplaceUserSession)
vi.stubGlobal('createApiError', ({ error, code, reason }: any) => {
  const err = new Error(reason) as any
  err.statusCode = code
  err.data = { error, code, reason, stacktrace: {} }
  return err
})

vi.mock('~/server/utils/prisma', () => ({
  prisma: {
    user: {
      findFirst: mockPrismaUserFindFirst,
    },
  },
}))

vi.mock('~/server/utils/logger', () => ({
  logRequest: vi.fn(),
}))

vi.mock('~/server/utils/rate-limit', () => ({
  checkRateLimit: mockCheckRateLimit,
  resetRateLimitForIp: mockResetRateLimitForIp,
}))

const { default: loginHandler } = await import('./login.post')

function createMockEvent(body: any) {
  const event = { _url: 'http://localhost/api/auth/login', context: {} } as any
  vi.mocked(readBody).mockResolvedValue(body)
  return event
}

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockReplaceUserSession.mockResolvedValue(undefined)
    mockCheckRateLimit.mockReturnValue(true)
  })

  it('rejects request without password', async () => {
    const event = createMockEvent({})

    await expect(loginHandler(event)).rejects.toMatchObject({
      statusCode: 400,
    })
  })

  describe('admin login (password only, no name)', () => {
    it('authenticates admin with correct password', async () => {
      const hashedPassword = await bcrypt.hash('admin123', 10)
      mockPrismaUserFindFirst.mockResolvedValue({
        id: 'u1', name: 'Admin', role: 'ADMIN', password: hashedPassword,
      })
      const event = createMockEvent({ password: 'admin123' })

      const result = await loginHandler(event)

      expect(mockReplaceUserSession).toHaveBeenCalledWith(event, {
        user: { id: 'u1', name: 'Admin', role: 'ADMIN' },
        loggedInAt: expect.any(Number),
      })
      expect(result).toEqual({ user: { id: 'u1', name: 'Admin', role: 'ADMIN' } })
    })

    it('rejects admin with wrong password', async () => {
      const hashedPassword = await bcrypt.hash('admin123', 10)
      mockPrismaUserFindFirst.mockResolvedValue({
        id: 'u1', name: 'Admin', role: 'ADMIN', password: hashedPassword,
      })
      const event = createMockEvent({ password: 'wrongpassword' })

      await expect(loginHandler(event)).rejects.toMatchObject({
        statusCode: 401,
      })
    })

    it('rejects when no admin account exists', async () => {
      mockPrismaUserFindFirst.mockResolvedValue(null)
      const event = createMockEvent({ password: 'admin123' })

      await expect(loginHandler(event)).rejects.toMatchObject({
        statusCode: 401,
      })
    })
  })

  describe('referee login (name + password)', () => {
    it('authenticates referee with correct name and password', async () => {
      const hashedPassword = await bcrypt.hash('ref456', 10)
      mockPrismaUserFindFirst.mockResolvedValue({
        id: 'u2', name: 'Jan', role: 'REFEREE', password: hashedPassword,
      })
      const event = createMockEvent({ name: 'Jan', password: 'ref456' })

      const result = await loginHandler(event)

      expect(mockReplaceUserSession).toHaveBeenCalledWith(event, {
        user: { id: 'u2', name: 'Jan', role: 'REFEREE' },
        loggedInAt: expect.any(Number),
      })
      expect(result).toEqual({ user: { id: 'u2', name: 'Jan', role: 'REFEREE' } })
    })

    it('rejects referee with wrong password', async () => {
      const hashedPassword = await bcrypt.hash('ref456', 10)
      mockPrismaUserFindFirst.mockResolvedValue({
        id: 'u2', name: 'Jan', role: 'REFEREE', password: hashedPassword,
      })
      const event = createMockEvent({ name: 'Jan', password: 'wrongpass' })

      await expect(loginHandler(event)).rejects.toMatchObject({
        statusCode: 401,
      })
    })

    it('rejects when referee name not found', async () => {
      mockPrismaUserFindFirst.mockResolvedValue(null)
      const event = createMockEvent({ name: 'Unknown', password: 'ref456' })

      await expect(loginHandler(event)).rejects.toMatchObject({
        statusCode: 401,
      })
    })
  })

  it('returns 429 when rate limit exceeded', async () => {
    mockCheckRateLimit.mockReturnValue(false)
    const event = createMockEvent({ password: 'any' })

    await expect(loginHandler(event)).rejects.toMatchObject({
      statusCode: 429,
    })
  })

  it('resets rate limit for ip on successful login', async () => {
    const hashedPassword = await bcrypt.hash('admin123', 10)
    mockPrismaUserFindFirst.mockResolvedValue({
      id: 'u1', name: 'Admin', role: 'ADMIN', password: hashedPassword,
    })
    const event = createMockEvent({ password: 'admin123' })

    await loginHandler(event)

    expect(mockResetRateLimitForIp).toHaveBeenCalledWith('127.0.0.1')
  })
})

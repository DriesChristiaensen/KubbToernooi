import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetUserSession = vi.hoisted(() => vi.fn())

const codeToStatusCode: Record<string, number> = {
  unauthorized: 403,
};

vi.stubGlobal('getUserSession', mockGetUserSession)
vi.stubGlobal('getRequestURL', (event: any) => new URL(event._url))
vi.stubGlobal('createApiError', ({ error, code, reason }: any) => {
  const err = new Error(reason) as any
  err.statusCode = typeof code === 'string' ? (codeToStatusCode[code] ?? 500) : code
  err.data = { error, code, reason, stacktrace: {} }
  return err
})
vi.stubGlobal('defineEventHandler', (handler: any) => handler)
vi.stubGlobal('createError', ({ statusCode, statusMessage, data }: any) => {
  const err = new Error(statusMessage) as any
  err.statusCode = statusCode
  err.data = data
  return err
})

const { default: authMiddleware } = await import('./auth')

function createMockEvent(url: string) {
  return { _url: url, context: {} } as any
}

describe('auth middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('public routes', () => {
    it('allows unauthenticated access to /api/public/*', async () => {
      const event = createMockEvent('http://localhost/api/public/schedule')
      await authMiddleware(event)
      expect(mockGetUserSession).not.toHaveBeenCalled()
    })

    it('allows unauthenticated access to non-API routes', async () => {
      const event = createMockEvent('http://localhost/login')
      await authMiddleware(event)
      expect(mockGetUserSession).not.toHaveBeenCalled()
    })
  })

  describe('/api/admin/* routes', () => {
    it('rejects unauthenticated requests with 403', async () => {
      mockGetUserSession.mockResolvedValue({})
      const event = createMockEvent('http://localhost/api/admin/teams')

      await expect(authMiddleware(event)).rejects.toMatchObject({
        statusCode: 403,
      })
    })

    it('rejects REFEREE role with 403', async () => {
      mockGetUserSession.mockResolvedValue({ user: { id: 'u2', name: 'Ref', role: 'REFEREE' } })
      const event = createMockEvent('http://localhost/api/admin/teams')

      await expect(authMiddleware(event)).rejects.toMatchObject({
        statusCode: 403,
      })
    })

    it('allows ADMIN role and sets event.context.user', async () => {
      const adminUser = { id: 'u1', name: 'Admin', role: 'ADMIN' }
      mockGetUserSession.mockResolvedValue({ user: adminUser })
      const event = createMockEvent('http://localhost/api/admin/teams')

      await authMiddleware(event)
      expect(event.context.user).toEqual(adminUser)
    })
  })

  describe('/api/ref/* routes', () => {
    it('rejects unauthenticated requests with 403', async () => {
      mockGetUserSession.mockResolvedValue({})
      const event = createMockEvent('http://localhost/api/ref/matches')

      await expect(authMiddleware(event)).rejects.toMatchObject({
        statusCode: 403,
      })
    })

    it('allows REFEREE role and sets event.context.user', async () => {
      const refUser = { id: 'u2', name: 'Ref', role: 'REFEREE' }
      mockGetUserSession.mockResolvedValue({ user: refUser })
      const event = createMockEvent('http://localhost/api/ref/matches')

      await authMiddleware(event)
      expect(event.context.user).toEqual(refUser)
    })

    it('allows ADMIN role on referee routes', async () => {
      const adminUser = { id: 'u1', name: 'Admin', role: 'ADMIN' }
      mockGetUserSession.mockResolvedValue({ user: adminUser })
      const event = createMockEvent('http://localhost/api/ref/matches')

      await authMiddleware(event)
      expect(event.context.user).toEqual(adminUser)
    })
  })
})

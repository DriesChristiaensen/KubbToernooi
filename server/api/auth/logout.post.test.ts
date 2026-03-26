import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockClearUserSession = vi.hoisted(() => vi.fn())

vi.stubGlobal('defineEventHandler', (handler: any) => handler)
vi.stubGlobal('clearUserSession', mockClearUserSession)
vi.stubGlobal('createApiError', ({ error, code, reason }: any) => {
  const err = new Error(reason) as any
  err.statusCode = code
  err.data = { error, code, reason, stacktrace: {} }
  return err
})

vi.mock('~/server/utils/logger', () => ({
  logRequest: vi.fn(),
}))

const { default: logoutHandler } = await import('./logout.post')

describe('POST /api/auth/logout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockClearUserSession.mockResolvedValue(undefined)
  })

  it('clears the user session', async () => {
    const event = { _url: 'http://localhost/api/auth/logout', context: { user: { id: 1, name: 'Admin', role: 'ADMIN' } } } as any

    const result = await logoutHandler(event)

    expect(mockClearUserSession).toHaveBeenCalledWith(event)
    expect(result).toEqual({ success: true })
  })
})

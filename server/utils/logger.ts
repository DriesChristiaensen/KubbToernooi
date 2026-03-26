import type { H3Event } from 'h3'

export function logRequest(event: H3Event, outcome: 'success' | 'error', details?: string) {
  const method = getMethod(event)

  if (method === 'GET' && outcome !== 'error') return

  const timestamp = new Date().toISOString()
  const path = getRequestURL(event).pathname
  const role = event.context.user?.role ?? 'anonymous'

  const message = `[${timestamp}] ${method} ${path} | role=${role} | ${outcome}${details ? ` | ${details}` : ''}`

  if (outcome === 'error') {
    console.error(message)
  } else {
    console.log(message)
  }
}

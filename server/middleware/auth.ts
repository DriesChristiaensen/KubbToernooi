export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname

  if (path.startsWith('/api/admin')) {
    const session = await getUserSession(event)
    if (!session.user || session.user.role !== 'ADMIN') {
      throw createApiError({
        error: 'Toegang geweigerd',
        code: 403,
        reason: 'Admin role required',
      })
    }
    event.context.user = session.user
  } else if (path.startsWith('/api/ref')) {
    const session = await getUserSession(event)
    if (!session.user || !['ADMIN', 'REFEREE'].includes(session.user.role)) {
      throw createApiError({
        error: 'Toegang geweigerd',
        code: 403,
        reason: 'Referee or Admin role required',
      })
    }
    event.context.user = session.user
  }
})

import { prisma } from '~/server/utils/prisma'
import { logRequest } from '~/server/utils/logger'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createApiError({
      error: 'Ongeldig ID',
      code: 'invalid_referee_id',
      reason: 'Invalid referee ID',
    })
  }

  const referee = await prisma.user.findFirst({ where: { id, role: 'REFEREE' } })
  if (!referee) {
    throw createApiError({ error: 'Scheidsrechter niet gevonden', code: 'referee_not_found', reason: 'Referee not found' })
  }

  await prisma.user.delete({ where: { id } })

  setResponseStatus(event, 204)
  logRequest(event, 'success', `Referee deleted: id=${id}`)
  return null
})

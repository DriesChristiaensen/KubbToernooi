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

  // Check if referee exists before attempting update
  const referee = await prisma.user.findFirst({
    where: { id, role: 'REFEREE' },
  })

  if (!referee) {
    throw createApiError({
      error: 'Scheidsrechter niet gevonden',
      code: 'referee_not_found',
      reason: 'Referee not found',
    })
  }

  await prisma.user.update({
    where: { id, role: 'REFEREE' },
    data: { password: null },
  })

  logRequest(event, 'success', `Referee password reset: id=${id}`)
  return { success: true }
})

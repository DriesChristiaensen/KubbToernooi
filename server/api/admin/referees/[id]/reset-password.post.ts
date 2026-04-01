import { prisma } from '~/server/utils/prisma'
import { logRequest } from '~/server/utils/logger'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createApiError({
      error: 'Ongeldig ID',
      code: 400,
      reason: 'Invalid referee ID',
    })
  }

  await prisma.user.update({
    where: { id, role: 'REFEREE' },
    data: { password: null },
  })

  logRequest(event, 'success', `Referee password reset: id=${id}`)
  return { success: true }
})

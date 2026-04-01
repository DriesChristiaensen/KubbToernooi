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

  await prisma.user.delete({ where: { id, role: 'REFEREE' } })

  logRequest(event, 'success', `Referee deleted: id=${id}`)
  return { success: true }
})

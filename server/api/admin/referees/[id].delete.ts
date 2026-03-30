import { prisma } from '~/server/utils/prisma'
import { logRequest } from '~/server/utils/logger'

export default defineEventHandler(async (event) => {
  const idParam = getRouterParam(event, 'id')
  const id = Number(idParam)

  if (Number.isNaN(id)) {
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

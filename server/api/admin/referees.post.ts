import { prisma } from '~/server/utils/prisma'
import { logRequest } from '~/server/utils/logger'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  if (!body?.name?.trim()) {
    throw createApiError({
      error: 'Naam is verplicht',
      code: 400,
      reason: 'Missing name field',
    })
  }

  const existing = await prisma.user.findFirst({
    where: { name: body.name.trim(), role: 'REFEREE' },
  })

  if (existing) {
    throw createApiError({
      error: 'Er bestaat al een scheidsrechter met deze naam',
      code: 409,
      reason: 'Duplicate referee name',
    })
  }

  const referee = await prisma.user.create({
    data: {
      name: body.name.trim(),
      password: null,
      role: 'REFEREE',
    },
    select: { id: true, name: true, createdAt: true },
  })

  logRequest(event, 'success', `Referee created: ${referee.name}`)
  return referee
})

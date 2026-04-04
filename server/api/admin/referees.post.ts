import { z } from 'zod'
import { prisma } from '~/server/utils/prisma'
import { logRequest } from '~/server/utils/logger'

const bodySchema = z.object({
  name: z.string().trim().min(1, 'Referee name is required'),
})

export default defineEventHandler(async (event) => {
  const raw = await readBody(event)

  let body
  try {
    body = bodySchema.parse(raw ?? {})
  } catch {
    throw createApiError({
      error: 'Naam is verplicht',
      code: 'referee_name_empty',
      reason: 'Missing name field',
    })
  }

  const existing = await prisma.user.findFirst({
    where: { name: body.name, role: 'REFEREE' },
  })

  if (existing) {
    throw createApiError({
      error: 'Er bestaat al een scheidsrechter met deze naam',
      code: 'referee_name_exists',
      reason: 'Duplicate referee name',
    })
  }

  const referee = await prisma.user.create({
    data: {
      name: body.name,
      password: null,
      role: 'REFEREE',
    },
    select: { id: true, name: true, createdAt: true },
  })

  logRequest(event, 'success', `Referee created: ${referee.name}`)
  return referee
})

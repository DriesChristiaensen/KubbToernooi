import { prisma } from '~/server/utils/prisma'
import { logRequest } from '~/server/utils/logger'
import { getActiveTournament } from '~/server/utils/tournament'

export default defineEventHandler(async (event) => {
  const idParam = getRouterParam(event, 'id')
  const id = Number(idParam)

  if (Number.isNaN(id)) {
    throw createApiError({
      error: 'Ongeldig ID',
      code: 400,
      reason: 'Invalid field ID',
    })
  }

  const tournament = await getActiveTournament()
  const body = await readBody(event)

  if (!body?.name?.trim()) {
    throw createApiError({
      error: 'Veldnaam is verplicht',
      code: 400,
      reason: 'Missing name field',
    })
  }

  const name = body.name.trim()

  const existing = await prisma.field.findFirst({
    where: { name, tournamentId: tournament.id, id: { not: id } },
  })

  if (existing) {
    throw createApiError({
      error: 'Er bestaat al een veld met deze naam',
      code: 409,
      reason: 'Duplicate field name',
    })
  }

  const field = await prisma.field.update({
    where: { id },
    data: { name },
  })

  logRequest(event, 'success', `Field updated: ${field.name}`)
  return field
})

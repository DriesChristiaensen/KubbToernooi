import { prisma } from '~/server/utils/prisma'
import { logRequest } from '~/server/utils/logger'
import { getActiveTournament } from '~/server/utils/tournament'

export default defineEventHandler(async (event) => {
  const tournament = await getActiveTournament()
  const body = await readBody(event)

  if (!body?.name?.trim()) {
    throw createApiError({
      error: 'Teamnaam is verplicht',
      code: 400,
      reason: 'Missing name field',
    })
  }

  const name = body.name.trim()

  const existing = await prisma.team.findFirst({
    where: { name, tournamentId: tournament.id },
  })

  if (existing) {
    throw createApiError({
      error: 'Er bestaat al een team met deze naam',
      code: 409,
      reason: 'Duplicate team name',
    })
  }

  const team = await prisma.team.create({
    data: { name, tournamentId: tournament.id },
  })

  logRequest(event, 'success', `Team created: ${team.name}`)
  return team
})

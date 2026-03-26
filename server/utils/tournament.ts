import { prisma } from '~/server/utils/prisma'

export async function getActiveTournament() {
  const tournament = await prisma.tournament.findFirst({
    orderBy: { createdAt: 'desc' },
  })

  if (!tournament) {
    throw createApiError({
      error: 'Geen toernooi gevonden. Maak eerst een toernooi aan.',
      code: 404,
      reason: 'No tournament found',
    })
  }

  return tournament
}

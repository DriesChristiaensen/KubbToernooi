import { prisma } from '~/server/utils/prisma'

/**
 * Get all referees (admin view).
 * @returns {Array<Object>} Array of referees with id, name, createdAt
 */
export default defineEventHandler(async () => {
  return prisma.user.findMany({
    where: { role: 'REFEREE' },
    select: { id: true, name: true, createdAt: true },
  })
})

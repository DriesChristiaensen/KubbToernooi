import { prisma } from '~/server/utils/prisma'

export default defineEventHandler(async () => {
  return prisma.user.findMany({
    where: { role: 'REFEREE' },
    select: { id: true, name: true, createdAt: true },
  })
})

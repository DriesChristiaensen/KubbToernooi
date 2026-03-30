import bcrypt from 'bcrypt'
import { prisma } from '~/server/utils/prisma'
import { resetRateLimitStore } from '~/server/utils/rate-limit'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  if (!body?.password) {
    throw createApiError({
      error: 'Wachtwoord is verplicht',
      code: 400,
      reason: 'Missing password',
    })
  }

  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } })
  if (!admin) {
    throw createApiError({
      error: 'Admin-account niet gevonden',
      code: 404,
      reason: 'Admin not found',
    })
  }

  const valid = await bcrypt.compare(body.password, admin.password)
  if (!valid) {
    throw createApiError({
      error: 'Ongeldig wachtwoord',
      code: 401,
      reason: 'Invalid password',
    })
  }

  resetRateLimitStore()
  return { reset: true }
})

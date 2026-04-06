import bcrypt from 'bcrypt'
import { prisma } from '~/server/utils/prisma'
import { resetRateLimitStore } from '~/server/utils/rate-limit'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  if (!body?.password) {
    throw createApiError({
      error: 'Wachtwoord is verplicht',
      code: 'invalid_input',
      reason: 'Missing password',
    })
  }

  let admin
  try {
    admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } })
  }
  catch {
    throw createApiError({
      error: 'Database niet bereikbaar',
      code: 'database_unavailable',
      reason: 'Database unavailable',
    })
  }
  if (!admin) {
    throw createApiError({
      error: 'Admin-account niet gevonden',
      code: 'admin_user_not_found',
      reason: 'Admin not found',
    })
  }

  if (!admin.password) {
    throw createApiError({ error: 'Admin-account heeft geen wachtwoord ingesteld', code: 'admin_no_password', reason: 'Admin has no password' })
  }
  const valid = await bcrypt.compare(body.password, admin.password)
  if (!valid) {
    throw createApiError({
      error: 'Ongeldig wachtwoord',
      code: 'admin_password_invalid',
      reason: 'Invalid password',
    })
  }

  resetRateLimitStore()
  return { reset: true }
})

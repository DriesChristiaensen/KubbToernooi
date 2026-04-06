import { z } from 'zod'
import bcrypt from 'bcrypt'
import { prisma } from '~/server/utils/prisma'
import { resetRateLimitStore } from '~/server/utils/rate-limit'

const bodySchema = z.object({
  password: z.string().min(1, 'Password is required'),
})

/**
 * Clear all rate-limit counters (admin only).
 * Requires valid admin password for security.
 * @param {Object} body - Request body
 * @param {string} body.password - Admin password (required)
 * @returns {Object} Reset status: { reset: boolean }
 * @throws {400} If password is missing
 * @throws {401} If password is invalid
 * @throws {404} If admin user not found
 * @throws {503} If database is unavailable
 */
export default defineEventHandler(async (event) => {
  const raw = await readBody(event)

  let body
  try {
    body = bodySchema.parse(raw ?? {})
  } catch {
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

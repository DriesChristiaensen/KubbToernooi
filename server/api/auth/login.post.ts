import { z } from 'zod'
import bcrypt from 'bcrypt'
import { prisma } from '~/server/utils/prisma'
import { logRequest } from '~/server/utils/logger'
import { checkRateLimit, resetRateLimitForIp } from '~/server/utils/rate-limit'

const bodySchema = z.object({
  password: z.string().min(1, 'Password is required'),
  name: z.string().optional(),
  setPassword: z.boolean().optional(),
})

/**
 * Authenticate a user and create a session.
 * Supports both admin login (no name) and referee login (with name).
 * If password is not yet set on the user, can optionally initialize it via setPassword flag.
 * Rate-limited to 5 attempts per IP per minute.
 * @param {Object} body - Request body
 * @param {string} body.password - User password (required)
 * @param {string} [body.name] - Referee name (omit for admin login)
 * @param {boolean} [body.setPassword] - If true and password not set, initialize password
 * @returns {Object} Authenticated user: { user: { id, name, role }, loggedInAt } OR { needsPasswordSetup: true }
 * @throws {400} If password is missing
 * @throws {401} If credentials are invalid or rate limit exceeded
 * @throws {409} If setPassword attempted but password already set
 */
export default defineEventHandler(async (event) => {
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
  if (!checkRateLimit(ip)) {
    throw createApiError({
      error: 'Te veel inlogpogingen. Probeer het later opnieuw.',
      code: 'rate_limit_exceeded',
      reason: 'Too many login attempts',
    })
  }

  const raw = await readBody(event)

  let body
  try {
    body = bodySchema.parse(raw ?? {})
  } catch {
    throw createApiError({
      error: 'Wachtwoord is verplicht',
      code: 'invalid_input',
      reason: 'Missing password field',
    })
  }

  const isRefLogin = !!body.name
  const user = await prisma.user.findFirst({
    where: isRefLogin
      ? { name: body.name, role: 'REFEREE' }
      : { role: 'ADMIN' },
  })

  if (!user) {
    logRequest(event, 'error', 'User not found')
    throw createApiError({
      error: 'Inloggen mislukt. Controleer je gegevens.',
      code: 'invalid_password',
      reason: 'Invalid credentials',
    })
  }

  if (user.password === null) {
    if (body.setPassword) {
      const hashed = await bcrypt.hash(body.password, 12)
      await prisma.user.update({ where: { id: user.id }, data: { password: hashed } })
    } else {
      return { needsPasswordSetup: true }
    }
  } else {
    if (body.setPassword) {
      throw createApiError({
        error: 'Wachtwoord is al ingesteld.',
        code: 'password_required',
        reason: 'Password already set',
      })
    }
    const passwordValid = await bcrypt.compare(body.password, user.password)
    if (!passwordValid) {
      logRequest(event, 'error', 'Invalid password')
      throw createApiError({
        error: 'Inloggen mislukt. Controleer je gegevens.',
        code: 'invalid_password',
        reason: 'Invalid credentials',
      })
    }
  }

  const sessionUser = { id: user.id, name: user.name, role: user.role }

  resetRateLimitForIp(ip)

  await replaceUserSession(event, {
    user: sessionUser,
    loggedInAt: Date.now(),
  })

  logRequest(event, 'success', `${user.role} login: ${user.name}`)

  return { user: sessionUser }
})

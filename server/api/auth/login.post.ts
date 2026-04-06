import bcrypt from 'bcrypt'
import { prisma } from '~/server/utils/prisma'
import { logRequest } from '~/server/utils/logger'
import { checkRateLimit, resetRateLimitForIp } from '~/server/utils/rate-limit'

export default defineEventHandler(async (event) => {
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
  if (!checkRateLimit(ip)) {
    throw createApiError({
      error: 'Te veel inlogpogingen. Probeer het later opnieuw.',
      code: 'rate_limit_exceeded',
      reason: 'Too many login attempts',
    })
  }

  const body = await readBody(event)

  if (!body?.password) {
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

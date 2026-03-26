import bcrypt from 'bcrypt'
import { prisma } from '~/server/utils/prisma'
import { logRequest } from '~/server/utils/logger'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  if (!body?.password) {
    throw createApiError({
      error: 'Wachtwoord is verplicht',
      code: 400,
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
      code: 401,
      reason: 'Invalid credentials',
    })
  }

  const passwordValid = await bcrypt.compare(body.password, user.password)
  if (!passwordValid) {
    logRequest(event, 'error', 'Invalid password')
    throw createApiError({
      error: 'Inloggen mislukt. Controleer je gegevens.',
      code: 401,
      reason: 'Invalid credentials',
    })
  }

  const sessionUser = { id: user.id, name: user.name, role: user.role }

  await replaceUserSession(event, {
    user: sessionUser,
    loggedInAt: Date.now(),
  })

  logRequest(event, 'success', `${user.role} login: ${user.name}`)

  return { user: sessionUser }
})

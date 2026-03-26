import { logRequest } from '~/server/utils/logger'

export default defineEventHandler(async (event) => {
  await clearUserSession(event)
  logRequest(event, 'success', 'User logged out')
  return { success: true }
})

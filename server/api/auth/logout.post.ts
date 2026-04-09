import { logRequest } from '~/server/utils/logger'

/**
 * Clear the user's session.
 * @returns {Object} Logout status: { success: boolean }
 */
export default defineEventHandler(async (event) => {
  await clearUserSession(event)
  logRequest(event, 'success', 'User logged out')
  return { success: true }
})

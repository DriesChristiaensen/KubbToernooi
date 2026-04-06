import { ref } from 'vue'
import { navigateTo } from '#app'
import { nl } from '~/i18n/nl'

/**
 * Authentication composable for login/logout flows.
 * Manages loading state and error messages during authentication.
 * Automatically navigates to role-specific pages post-login.
 * @returns {Object} Object with login, logout, loading, error
 */
export function useAuth() {
  const loading = ref(false)
  const error = ref('')

  /**
   * Authenticate user with credentials and navigate to dashboard.
   * @param {Object} credentials - Login credentials
   * @param {string} [credentials.name] - Referee name (omit for admin login)
   * @param {string} credentials.password - User password
   */
  async function login(credentials: { name?: string, password: string }) {
    loading.value = true
    error.value = ''

    try {
      const data = await $fetch('/api/auth/login', {
        method: 'POST',
        body: credentials,
      })

      const result = data as { user: { role: string } }
      await useUserSession().fetch()
      loading.value = false
      await navigateTo(result.user.role === 'ADMIN' ? '/admin' : '/ref')
    }
    catch (err: unknown) {
      const fetchErr = err as { data?: { data?: { error?: string }, error?: string } }
      error.value = fetchErr?.data?.data?.error || fetchErr?.data?.error || nl.auth.loginFailed
      loading.value = false
    }
  }

  /**
   * Clear session and navigate to login page (role-specific).
   */
  async function logout() {
    const { user, fetch: fetchSession } = useUserSession()
    const isAdmin = user.value?.role === 'ADMIN'
    try {
      await $fetch('/api/auth/logout', { method: 'POST' })
    }
    catch {
      // navigate regardless of fetch outcome
    }
    await fetchSession()
    await navigateTo(isAdmin ? '/admin/admin-login' : '/ref/login')
  }

  return { login, logout, loading, error }
}

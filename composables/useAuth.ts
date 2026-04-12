import { ref } from 'vue'
import { navigateTo } from '#app'
import { nl } from '~/i18n/nl'

export function useAuth() {
  const loading = ref(false)
  const error = ref('')

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

  async function logout() {
    const { user, fetch: fetchSession } = useUserSession()
    const isAdmin = user.value?.role === 'ADMIN'
    try {
      await $fetch('/api/auth/logout', { method: 'POST' })
    }
    catch {
      // navigate regardless of fetch outcome
    }
    // fetchSession uses useRequestFetch → useNuxtApp, which is unavailable
    // after an async boundary on SSR. On SSR we're navigating away anyway and
    // the cleared cookie is sufficient; only refresh state on the client.
    if (import.meta.client) {
      await fetchSession()
    }
    await navigateTo(isAdmin ? '/admin/admin-login' : '/ref/login')
  }

  return { login, logout, loading, error }
}

import { ref } from 'vue'
import { navigateTo } from '#app'

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
      await navigateTo(result.user.role === 'ADMIN' ? '/admin' : '/ref')
    }
    catch (err: unknown) {
      const fetchErr = err as { data?: { data?: { error?: string }, error?: string } }
      error.value = fetchErr?.data?.data?.error || fetchErr?.data?.error || 'Inloggen mislukt'
    }
    finally {
      loading.value = false
    }
  }

  async function logout() {
    await $fetch('/api/auth/logout', { method: 'POST' })
    await navigateTo('/login')
  }

  return { login, logout, loading, error }
}

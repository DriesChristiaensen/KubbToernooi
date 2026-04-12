<script setup lang="ts">
import { ref, computed } from 'vue'
import { nl } from '~/i18n/nl'

definePageMeta({ layout: false })

const { loggedIn, user } = useUserSession()
if (loggedIn.value && user.value?.role === 'ADMIN') {
  await navigateTo('/admin')
} else if (loggedIn.value) {
  await navigateTo('/ref')
}

const { data: refsStatus } = await useAsyncData('refs-status', () =>
  $fetch<{ refsEnabled: boolean }>('/api/public/refs-status'),
)
const refsDisabled = computed(() => !(refsStatus.value?.refsEnabled ?? true))

const name = ref('')
const password = ref('')
const showPassword = ref(false)
const isLoading = ref(false)
const error = ref('')
const showPasswordSetupConfirm = ref(false)

async function handleSubmit() {
  error.value = ''
  isLoading.value = true
  try {
    const result = await $fetch<{ needsPasswordSetup?: boolean; user?: { role: string } }>('/api/auth/login', {
      method: 'POST',
      body: { name: name.value, password: password.value },
    })
    if (result.needsPasswordSetup) {
      showPasswordSetupConfirm.value = true
      isLoading.value = false
      return
    }
    await useUserSession().fetch()
    await navigateTo('/ref')
  } catch (err: unknown) {
    const fetchErr = err as { data?: { data?: { error?: string }; error?: string } }
    error.value = fetchErr?.data?.data?.error || fetchErr?.data?.error || nl.auth.loginFailed
    isLoading.value = false
  }
}

async function confirmPasswordSetup() {
  error.value = ''
  isLoading.value = true
  showPasswordSetupConfirm.value = false
  try {
    await $fetch('/api/auth/login', {
      method: 'POST',
      body: { name: name.value, password: password.value, setPassword: true },
    })
    await useUserSession().fetch()
    await navigateTo('/ref')
  } catch (err: unknown) {
    const fetchErr = err as { data?: { data?: { error?: string }; error?: string } }
    error.value = fetchErr?.data?.data?.error || fetchErr?.data?.error || nl.auth.loginFailed
    isLoading.value = false
  }
}

function cancelPasswordSetup() {
  showPasswordSetupConfirm.value = false
  isLoading.value = false
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-background px-4">
    <div class="w-full max-w-sm rounded-lg bg-surface p-8 shadow-lg">
      <NuxtLink to="/" class="mb-6 block text-center text-heading text-primary hover:opacity-80">
        {{ nl.common.appName }}
      </NuxtLink>

      <!-- Refs disabled message -->
      <div v-if="refsDisabled" class="text-center">
        <p class="text-sm text-text-light">{{ nl.ref.disabled }}</p>
      </div>

      <div v-else-if="showPasswordSetupConfirm" class="text-center">
        <p class="mb-6 text-sm text-text">
          {{ nl.auth.noPasswordSet }}
        </p>
        <div class="flex gap-3">
          <div class="group relative flex-1">
            <button
              :disabled="isLoading"
              class="w-full rounded bg-primary px-4 py-2 font-medium text-white hover:bg-primary-dark disabled:opacity-50"
              @click="confirmPasswordSetup"
            >
              {{ nl.common.confirm }}
            </button>
            <div v-if="isLoading" class="invisible absolute bottom-full left-1/2 z-10 mb-1 w-max max-w-xs -translate-x-1/2 rounded bg-gray-800 px-2 py-1 text-xs text-white group-hover:visible">
              {{ nl.common.submitting }}
            </div>
          </div>
          <button
            class="flex-1 rounded bg-secondary px-4 py-2 font-medium text-white hover:opacity-80"
            @click="cancelPasswordSetup"
          >
            {{ nl.common.cancel }}
          </button>
        </div>
      </div>

      <form v-else-if="!refsDisabled" @submit.prevent="handleSubmit">
        <div class="mb-4">
          <label class="mb-1 block text-sm font-medium text-text" for="name">
            {{ nl.auth.name }}
          </label>
          <input
            id="name"
            v-model="name"
            type="text"
            required
            class="w-full rounded border border-gray-300 px-3 py-2 text-text focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
        </div>

        <div class="mb-4">
          <label class="mb-1 block text-sm font-medium text-text" for="password">
            {{ nl.auth.password }}
          </label>
          <div class="relative">
            <input
              id="password"
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              required
              class="w-full rounded border border-gray-300 px-3 py-2 pr-10 text-text focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
            <button
              type="button"
              class="absolute inset-y-0 right-0 flex items-center px-3 text-text-light hover:text-text"
              :aria-label="showPassword ? nl.auth.hidePassword : nl.auth.showPassword"
              @click="showPassword = !showPassword"
            >
              <svg v-if="!showPassword" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
            </button>
          </div>
        </div>

        <p v-if="error" class="mb-4 text-sm text-error">
          {{ error }}
        </p>

        <div class="group relative w-full">
          <button
            type="submit"
            :disabled="isLoading"
            class="w-full rounded bg-primary px-4 py-2 font-medium text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
          >
            {{ isLoading ? nl.common.loading : nl.auth.login }}
          </button>
          <div v-if="isLoading" class="invisible absolute bottom-full left-1/2 z-10 mb-1 w-max max-w-xs -translate-x-1/2 rounded bg-gray-800 px-2 py-1 text-xs text-white group-hover:visible">
            {{ nl.common.submitting }}
          </div>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { nl } from '~/i18n/nl'
import { useAuth } from '~/composables/useAuth'

const loginMode = ref<'admin' | 'ref'>('admin')
const name = ref('')
const password = ref('')
const { login, loading, error } = useAuth()

async function handleSubmit() {
  const credentials = loginMode.value === 'ref'
    ? { name: name.value, password: password.value }
    : { password: password.value }
  await login(credentials)
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-background px-4">
    <div class="w-full max-w-sm rounded-lg bg-surface p-8 shadow-lg">
      <h1 class="mb-6 text-center text-heading text-text">
        {{ nl.common.appName }}
      </h1>

      <div class="mb-6 flex gap-2">
        <button
          :class="[
            'flex-1 rounded px-4 py-2 text-sm font-medium transition-colors',
            loginMode === 'admin'
              ? 'bg-primary text-white'
              : 'bg-gray-100 text-text-light hover:bg-gray-200',
          ]"
          @click="loginMode = 'admin'"
        >
          Admin
        </button>
        <button
          :class="[
            'flex-1 rounded px-4 py-2 text-sm font-medium transition-colors',
            loginMode === 'ref'
              ? 'bg-primary text-white'
              : 'bg-gray-100 text-text-light hover:bg-gray-200',
          ]"
          @click="loginMode = 'ref'"
        >
          {{ nl.ref.dashboard }}
        </button>
      </div>

      <form @submit.prevent="handleSubmit">
        <div v-if="loginMode === 'ref'" class="mb-4">
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
          <input
            id="password"
            v-model="password"
            type="password"
            required
            class="w-full rounded border border-gray-300 px-3 py-2 text-text focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
        </div>

        <p v-if="error" class="mb-4 text-sm text-error">
          {{ error }}
        </p>

        <button
          type="submit"
          :disabled="loading"
          class="w-full rounded bg-primary px-4 py-2 font-medium text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
        >
          {{ loading ? nl.common.loading : nl.auth.login }}
        </button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nl } from '~/i18n/nl'
import { useAuth } from '~/composables/useAuth'

definePageMeta({ middleware: 'auth' })

const { logout } = useAuth()
</script>

<template>
  <div class="min-h-screen bg-background">
    <header class="flex items-center justify-between bg-primary-dark p-4">
      <h1 class="text-lg font-bold text-white">
        {{ nl.admin.dashboard }}
      </h1>
      <button
        class="rounded bg-white/20 px-3 py-1 text-sm text-white hover:bg-white/30"
        @click="logout"
      >
        {{ nl.auth.logout }}
      </button>
    </header>

    <main class="mx-auto max-w-content p-4">
      <nav class="grid gap-4 md:grid-cols-2">
        <NuxtLink
          to="/admin/referees"
          class="rounded-lg border border-gray-200 bg-surface p-6 shadow-sm transition-shadow hover:shadow-md"
        >
          <h2 class="text-subheading text-text">
            Scheidsrechters
          </h2>
        </NuxtLink>
      </nav>
    </main>
  </div>
</template>

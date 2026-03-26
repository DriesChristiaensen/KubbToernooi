<script setup lang="ts">
import { nl } from '~/i18n/nl'
import { useAuth } from '~/composables/useAuth'

definePageMeta({ middleware: 'auth' })

const { logout } = useAuth()
</script>

<template>
  <div class="min-h-screen bg-background">
    <header class="flex items-center justify-between bg-primary p-4">
      <h1 class="text-lg font-bold text-white">
        {{ nl.ref.dashboard }}
      </h1>
      <button
        class="rounded bg-white/20 px-3 py-1 text-sm text-white hover:bg-white/30"
        @click="logout"
      >
        {{ nl.auth.logout }}
      </button>
    </header>

    <main class="mx-auto max-w-content p-4">
      <h2 class="mb-4 text-subheading text-text">
        {{ nl.ref.matches.title }}
      </h2>
      <p class="text-text-light">
        {{ nl.common.noResults }}
      </p>
    </main>
  </div>
</template>

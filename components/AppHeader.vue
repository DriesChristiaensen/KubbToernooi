<script setup lang="ts">
import { nl } from '~/i18n/nl'
import { useAuth } from '~/composables/useAuth'

const { loggedIn, user } = useUserSession()
const { logout } = useAuth()
</script>

<template>
  <header class="fixed left-0 right-0 top-0 z-50 bg-primary md:relative md:left-auto md:right-auto md:top-auto md:z-auto">
    <div class="mx-auto flex max-w-content items-center justify-between px-4 py-3">
      <NuxtLink to="/" class="flex items-center gap-2 text-lg font-bold text-white">
        <img src="/KubbKing.png" alt="Kubb King logo" class="h-8 w-auto" />
        {{ nl.common.appName }}
      </NuxtLink>

      <nav class="hidden items-center gap-6 md:flex">
        <NuxtLink
          v-if="loggedIn && user?.role === 'ADMIN'"
          to="/admin"
          class="text-sm text-white/90 hover:text-white"
        >
          {{ nl.nav.admin }}
        </NuxtLink>
        <NuxtLink
          v-if="loggedIn"
          to="/ref"
          class="text-sm text-white/90 hover:text-white"
        >
          {{ nl.nav.ref }}
        </NuxtLink>
        <NuxtLink to="/" class="text-sm text-white/90 hover:text-white">
          {{ nl.nav.schedule }}
        </NuxtLink>
        <template v-if="loggedIn">
          <span class="text-sm text-white/70">{{ user?.name }}</span>
          <button
            class="rounded bg-white/20 px-3 py-1.5 text-sm text-white hover:bg-white/30"
            @click="logout"
          >
            {{ nl.auth.logout }}
          </button>
        </template>
      </nav>
    </div>
  </header>
</template>

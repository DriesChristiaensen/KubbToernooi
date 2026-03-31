<script setup lang="ts">
import { ref } from 'vue'
import { nl } from '~/i18n/nl'
import { useAuth } from '~/composables/useAuth'

const { loggedIn, user } = useUserSession()
const { logout } = useAuth()
const isOpen = ref(false)

function close() {
  isOpen.value = false
}
</script>

<template>
  <button
    class="fixed bottom-4 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-lg md:hidden"
    :aria-label="isOpen ? 'Menu sluiten' : 'Menu openen'"
    @click="isOpen = !isOpen"
  >
    <svg v-if="!isOpen" xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
    <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
    </svg>
  </button>

  <div
    v-if="isOpen"
    class="fixed inset-0 z-40 bg-black/40 md:hidden"
    @click="close"
  />

  <nav
    v-if="isOpen"
    class="fixed bottom-20 right-4 z-50 w-48 rounded-lg bg-surface py-2 shadow-xl md:hidden"
  >
    <NuxtLink
      v-if="loggedIn && user?.role === 'ADMIN'"
      to="/admin"
      class="block px-4 py-2 text-sm text-text hover:bg-background"
      @click="close"
    >
      {{ nl.nav.admin }}
    </NuxtLink>
    <NuxtLink
      v-if="loggedIn"
      to="/ref"
      class="block px-4 py-2 text-sm text-text hover:bg-background"
      @click="close"
    >
      {{ nl.nav.ref }}
    </NuxtLink>
    <NuxtLink
      to="/"
      class="block px-4 py-2 text-sm text-text hover:bg-background"
      @click="close"
    >
      {{ nl.nav.schedule }}
    </NuxtLink>
    <template v-if="loggedIn">
      <hr class="my-2 border-gray-100">
      <span class="block px-4 py-1 text-xs text-text-muted">{{ user?.name }}</span>
      <button
        class="block w-full px-4 py-2 text-left text-sm text-text hover:bg-background"
        @click="logout(); close()"
      >
        {{ nl.auth.logout }}
      </button>
    </template>
  </nav>
</template>

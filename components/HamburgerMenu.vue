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
    class="fixed bottom-10 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-lg md:hidden transition-all duration-200 hover:scale-110 active:scale-95"
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

  <Transition name="ripple">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-40 md:hidden ripple-backdrop"
      @click="close"
    />
  </Transition>

  <Transition name="menu-bounce">
  <nav
    v-if="isOpen"
    class="fixed bottom-[6.5rem] right-4 z-50 w-52 rounded-2xl bg-surface py-2 shadow-xl md:hidden overflow-hidden"
  >
    <NuxtLink
      v-if="loggedIn && user?.role === 'ADMIN'"
      to="/admin"
      class="mobile-nav-link"
      exact-active-class="mobile-nav-link--active"
      @click="close"
    >
      {{ nl.nav.admin }}
    </NuxtLink>
    <NuxtLink
      v-if="loggedIn"
      to="/ref"
      class="mobile-nav-link"
      exact-active-class="mobile-nav-link--active"
      @click="close"
    >
      {{ nl.nav.ref }}
    </NuxtLink>
    <NuxtLink
      to="/"
      class="mobile-nav-link"
      exact-active-class="mobile-nav-link--active"
      @click="close"
    >
      {{ nl.nav.schedule }}
    </NuxtLink>
    <NuxtLink
      to="/spelregels"
      class="mobile-nav-link"
      exact-active-class="mobile-nav-link--active"
      @click="close"
    >
      {{ nl.nav.spelregels }}
    </NuxtLink>
    <NuxtLink
      to="/prijslijst"
      class="mobile-nav-link"
      exact-active-class="mobile-nav-link--active"
      @click="close"
    >
      {{ nl.nav.prijslijst }}
    </NuxtLink>
    <template v-if="loggedIn">
      <hr class="my-2 border-gray-100">
      <span class="block px-4 py-1 text-xs text-text-muted">{{ user?.name }}</span>
      <button
        class="block w-full px-4 py-2 text-left text-sm text-text transition-colors duration-150 hover:bg-background"
        @click="logout(); close()"
      >
        {{ nl.auth.logout }}
      </button>
    </template>
  </nav>
  </Transition>
</template>

<style scoped>
.mobile-nav-link {
  position: relative;
  display: flex;
  align-items: center;
  padding: 0.6rem 1rem 0.6rem 1.25rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: #335C1E;
  text-decoration: none;
  transition: background 0.2s ease, color 0.2s ease, padding-left 0.2s ease;
  border-left: 3px solid transparent;
}

.mobile-nav-link:hover {
  background: #DDF7CA;
  padding-left: 1.5rem;
  color: #305D1D;
}

/* Active state: glowing left accent + tinted background */
.mobile-nav-link--active {
  background: linear-gradient(90deg, rgba(85, 154, 50, 0.12) 0%, transparent 100%);
  border-left-color: #559A32;
  color: #305D1D !important;
  font-weight: 700;
  padding-left: 1.5rem;
}

/* Pulsing glow on the left border */
.mobile-nav-link--active::before {
  content: '';
  position: absolute;
  left: -3px;
  top: 20%;
  bottom: 20%;
  width: 3px;
  border-radius: 9999px;
  background: #559A32;
  box-shadow: 0 0 8px 2px rgba(85, 154, 50, 0.5);
  animation: border-glow 1.6s ease-in-out infinite alternate;
}

/* Bouncing star indicator at the right */
.mobile-nav-link--active::after {
  content: '✦';
  position: absolute;
  right: 1rem;
  font-size: 10px;
  color: #559A32;
  text-shadow: 0 0 6px rgba(85, 154, 50, 0.7);
  animation: star-pulse 1.4s ease-in-out infinite alternate;
}

/* ── Menu bounce ── */
/* Transform origin: bottom-right, where the FAB button sits */
.menu-bounce-enter-active {
  animation: menu-bounce-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
  transform-origin: bottom right;
}

.menu-bounce-leave-active {
  animation: menu-bounce-out 0.16s cubic-bezier(0.4, 0, 0.6, 1) forwards;
  transform-origin: bottom right;
}

@keyframes menu-bounce-in {
  from  { transform: scale(0.3); opacity: 0; }
  50%   { transform: scale(1.1); opacity: 1; }
  75%   { transform: scale(0.93); }
  to    { transform: scale(1); opacity: 1; }
}

@keyframes menu-bounce-out {
  from { transform: scale(1); opacity: 1; }
  to   { transform: scale(0.3); opacity: 0; }
}

/* ── Ripple backdrop ── */
/*
  Button position: bottom-10 (2.5rem) right-4 (1rem), size h-14 w-14 (3.5rem)
  Center: calc(100% - 2.75rem) horizontal, calc(100% - 4.25rem) vertical
*/
.ripple-backdrop {
  background: rgba(48, 93, 29, 0.45); /* primary-dark #305D1D */
}

.ripple-enter-active {
  animation: ripple-expand 0.42s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}

.ripple-leave-active {
  animation: ripple-collapse 0.32s cubic-bezier(0.4, 0, 0.6, 1) forwards;
}

@keyframes ripple-expand {
  from { clip-path: circle(28px at calc(100% - 2.75rem) calc(100% - 4.25rem)); }
  to   { clip-path: circle(200vmax at calc(100% - 2.75rem) calc(100% - 4.25rem)); }
}

@keyframes ripple-collapse {
  from { clip-path: circle(200vmax at calc(100% - 2.75rem) calc(100% - 4.25rem)); }
  to   { clip-path: circle(28px at calc(100% - 2.75rem) calc(100% - 4.25rem)); }
}

@keyframes border-glow {
  from { box-shadow: 0 0 4px 1px rgba(85, 154, 50, 0.35); }
  to   { box-shadow: 0 0 12px 3px rgba(126, 245, 75, 0.6); }
}

@keyframes star-pulse {
  from { transform: scale(0.8) rotate(-15deg); opacity: 0.6; }
  to   { transform: scale(1.2) rotate(15deg); opacity: 1; }
}
</style>

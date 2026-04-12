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
        <span class="logo-wrap ml-4">
          <span class="logo-shimmer" aria-hidden="true" />
          <img src="/KubbKing.png" alt="Kubb King logo" class="h-8 w-auto relative" />
        </span>
        {{ nl.common.appName }}
      </NuxtLink>

      <nav class="hidden items-center gap-1 md:flex">
        <NuxtLink
          v-if="loggedIn && user?.role === 'ADMIN'"
          to="/admin"
          class="nav-link"
          exact-active-class="nav-link--active"
        >
          {{ nl.nav.admin }}
        </NuxtLink>
        <NuxtLink
          v-if="loggedIn"
          to="/ref"
          class="nav-link"
          exact-active-class="nav-link--active"
        >
          {{ nl.nav.ref }}
        </NuxtLink>
        <NuxtLink
          to="/"
          class="nav-link"
          exact-active-class="nav-link--active"
        >
          {{ nl.nav.schedule }}
        </NuxtLink>
        <NuxtLink
          to="/spelregels"
          class="nav-link"
          exact-active-class="nav-link--active"
        >
          {{ nl.nav.spelregels }}
        </NuxtLink>
        <NuxtLink
          to="/prijslijst"
          class="nav-link"
          exact-active-class="nav-link--active"
        >
          {{ nl.nav.prijslijst }}
        </NuxtLink>
        <template v-if="loggedIn">
          <span class="ml-2 text-sm text-white/70">{{ user?.name }}</span>
          <button
            class="ml-1 rounded-full bg-white/20 px-3 py-1.5 text-sm text-white transition-all duration-200 hover:bg-white/30 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-95"
            @click="logout"
          >
            {{ nl.auth.logout }}
          </button>
        </template>
      </nav>
    </div>
  </header>
</template>

<style scoped>
.nav-link {
  position: relative;
  display: inline-flex;
  align-items: center;
  padding: 0.375rem 1rem;
  border-radius: 9999px;
  font-size: 0.875rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.82);
  text-decoration: none;
  white-space: nowrap;
  transition: color 0.25s ease, transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.25s ease;
}

/* Animated pill background that sweeps in on hover */
.nav-link::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.14);
  border: 1px solid rgba(255, 255, 255, 0.18);
  transform: scaleX(0.4) scaleY(0.7);
  opacity: 0;
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.25s ease;
}

.nav-link:hover::before {
  transform: scaleX(1) scaleY(1);
  opacity: 1;
}

.nav-link:hover {
  color: #ffffff;
  transform: translateY(-2px);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.18);
}

.nav-link:active {
  transform: translateY(0) scale(0.96);
  box-shadow: none;
}

/* ── Active state ── */
.nav-link--active {
  color: #ffffff !important;
  font-weight: 700;
  transform: none !important;
  box-shadow: none !important;
}

.nav-link--active::before {
  transform: scaleX(1) scaleY(1) !important;
  opacity: 1 !important;
  background: rgba(255, 255, 255, 0.22);
  border: 1px solid rgba(255, 255, 255, 0.38);
  box-shadow:
    0 0 0 1px rgba(126, 245, 75, 0.25),
    0 0 16px rgba(126, 245, 75, 0.35),
    inset 0 0 8px rgba(255, 255, 255, 0.08);
}

/* Fun bouncing star below the active link */
.nav-link--active::after {
  content: '✦';
  position: absolute;
  bottom: -13px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 7px;
  color: #7EF54B;
  text-shadow: 0 0 8px #7EF54B, 0 0 16px rgba(126, 245, 75, 0.5);
  animation: star-pulse 1.4s ease-in-out infinite alternate;
  line-height: 1;
}

@keyframes star-pulse {
  from {
    transform: translateX(-50%) translateY(0) scale(0.85);
    opacity: 0.65;
  }
  to {
    transform: translateX(-50%) translateY(-3px) scale(1.3);
    opacity: 1;
  }
}

/* ── Logo shimmer ── */
.logo-wrap {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

/* 4-armed star shape via clip-path */
.logo-shimmer {
  position: absolute;
  inset: 0;
  margin: auto;
  margin-left: -0.6rem;
  margin-top: -1rem;
  width: 1.9rem;
  height: 1.9rem;
  clip-path: polygon(
    50% 0%,   57% 43%,
    100% 50%, 57% 57%,
    50% 100%, 43% 57%,
    0% 50%,  43% 43%
  );
  background: radial-gradient(circle, rgba(255,255,255,0.65) 0%, rgba(126,245,75,0.45) 50%, transparent 70%);
  opacity: 0;
  animation: logo-flash 10s ease-in-out infinite;
  pointer-events: none;
}

@keyframes logo-flash {
  0%    { opacity: 0; transform: scale(0.6) rotate(0deg); }
  /* flash fires around 1s mark, then fades */
  8%    { opacity: 0; transform: scale(0.6) rotate(0deg); }
  10%   { opacity: 0.6; transform: scale(1.05) rotate(20deg); }
  13%   { opacity: 0; transform: scale(1.3) rotate(40deg); }
  100%  { opacity: 0; transform: scale(1.3) rotate(40deg); }
}
</style>

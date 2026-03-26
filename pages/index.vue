<script setup lang="ts">
import { nl } from '~/i18n/nl'
</script>

<template>
  <div class="min-h-screen bg-background">
    <header class="bg-primary p-4">
      <h1 class="text-center text-xl font-bold text-white">
        {{ nl.common.appName }}
      </h1>
    </header>
    <main class="mx-auto max-w-content p-4">
      <p class="text-text">
        {{ nl.public.schedule.title }}
      </p>
    </main>
  </div>
</template>

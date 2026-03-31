<script setup lang="ts">
import { nl } from '~/i18n/nl'

const { data: tournament } = useFetch<{ status: string }>('/api/admin/tournament')
</script>

<template>
  <div
    v-if="tournament"
    :class="tournament.status === 'LIVE' ? 'bg-success' : 'bg-warning'"
    class="px-4 py-2 text-center text-sm font-medium text-white"
  >
    {{ tournament.status === 'LIVE' ? nl.admin.banner.live : nl.admin.banner.draft }}
  </div>
</template>

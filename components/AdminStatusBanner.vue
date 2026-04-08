<script setup lang="ts">
import { computed } from 'vue'
import { nl } from '~/i18n/nl'

interface StatusBanner {
  status: string
  type: string
  poolScheduleLive: boolean
  koScheduleLive: boolean
  visiblePoolMatchCount: number
  visibleKoMatchCount: number
}

const { data } = useFetch<StatusBanner | null>('/api/admin/status-banner', { key: 'admin-status-banner' })

const hasPools = computed(() => data.value?.type === 'POOLS' || data.value?.type === 'COMBINATION')
const hasKo = computed(() => data.value?.type === 'KNOCKOUT' || data.value?.type === 'COMBINATION')

const tournamentLabel = computed(() => {
  if (!data.value) return ''
  return data.value.status === 'LIVE' ? nl.admin.banner.tournamentLive : nl.admin.banner.tournamentDraft
})

const poolLabel = computed(() => {
  if (!data.value || !hasPools.value) return null
  if (data.value.poolScheduleLive) {
    return nl.admin.banner.poolLive.replace('{count}', String(data.value.visiblePoolMatchCount))
  }
  return nl.admin.banner.poolDraft
})

const koLabel = computed(() => {
  if (!data.value || !hasKo.value) return null
  if (data.value.koScheduleLive) {
    return nl.admin.banner.koLive.replace('{count}', String(data.value.visibleKoMatchCount))
  }
  return nl.admin.banner.koDraft
})

const isLive = computed(() => {
  if (!data.value) return false
  return data.value.status === 'LIVE' || data.value.poolScheduleLive || data.value.koScheduleLive
})
</script>

<template>
  <div
    v-if="data"
    :class="isLive ? 'bg-success' : 'bg-warning'"
    class="px-4 py-2 text-center text-sm font-medium text-white"
  >
    <span>{{ tournamentLabel }}</span>
    <template v-if="poolLabel">
      <span class="mx-2 opacity-60">·</span>
      <span>{{ poolLabel }}</span>
    </template>
    <template v-if="koLabel">
      <span class="mx-2 opacity-60">·</span>
      <span>{{ koLabel }}</span>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { nl } from '~/i18n/nl'

interface Tournament {
  status: string
  type: string
  poolScheduleLive: boolean
  koScheduleLive: boolean
}

const { data: tournament } = useFetch<Tournament>('/api/admin/tournament')

const bannerText = computed(() => {
  if (!tournament.value) return ''
  const t = tournament.value
  const hasPools = t.type === 'POOLS' || t.type === 'COMBINATION'
  const hasKo = t.type === 'KNOCKOUT' || t.type === 'COMBINATION'

  if (hasPools && hasKo) {
    if (t.poolScheduleLive && t.koScheduleLive) return nl.admin.banner.allLive
    if (t.poolScheduleLive && !t.koScheduleLive) return nl.admin.banner.poolLiveKoDraft
    if (!t.poolScheduleLive && t.koScheduleLive) return nl.admin.banner.poolDraftKoLive
    return nl.admin.banner.noneLive
  }
  if (hasPools) return t.poolScheduleLive ? nl.admin.banner.allLive : nl.admin.banner.noneLive
  if (hasKo) return t.koScheduleLive ? nl.admin.banner.allLive : nl.admin.banner.noneLive
  return t.status === 'LIVE' ? nl.admin.banner.live : nl.admin.banner.draft
})

const isLive = computed(() => {
  if (!tournament.value) return false
  const t = tournament.value
  return t.status === 'LIVE' || t.poolScheduleLive || t.koScheduleLive
})
</script>

<template>
  <div
    v-if="tournament"
    :class="isLive ? 'bg-success' : 'bg-warning'"
    class="px-4 py-2 text-center text-sm font-medium text-white"
  >
    {{ bannerText }}
  </div>
</template>

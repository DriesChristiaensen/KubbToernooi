<script setup lang="ts">
import { nl } from '~/i18n/nl'
import { useAuth } from '~/composables/useAuth'

definePageMeta({ middleware: 'auth' })

const { logout } = useAuth()

interface MatchTeam {
  id: number
  name: string
}

interface Match {
  id: number
  phase: 'POOL' | 'KO'
  round: number
  startTime: string
  status: string
  field: { id: number; name: string }
  teamA: MatchTeam
  teamB: MatchTeam
  scoreA: number | null
  scoreB: number | null
  koWinnerId: number | null
}

const matches = ref<Match[]>([])
const isLoading = ref(true)
const errorMsg = ref('')
const saving = ref<number | null>(null)
const saveError = ref('')

const scoreInputs = ref<Record<number, { scoreA: string; scoreB: string; koWinnerId: string }>>({})
const savedScores = ref<Record<number, { scoreA: string | null; scoreB: string | null }>>({})

async function fetchMatches() {
  isLoading.value = true
  try {
    const data = await $fetch<Match[]>('/api/ref/matches')
    matches.value = data
    for (const m of data) {
      const sA = m.scoreA !== null ? String(m.scoreA) : ''
      const sB = m.scoreB !== null ? String(m.scoreB) : ''
      if (!(m.id in scoreInputs.value)) {
        scoreInputs.value[m.id] = {
          scoreA: sA,
          scoreB: sB,
          koWinnerId: m.koWinnerId !== null ? String(m.koWinnerId) : '',
        }
      }
      savedScores.value[m.id] = {
        scoreA: m.scoreA !== null ? sA : null,
        scoreB: m.scoreB !== null ? sB : null,
      }
    }
  } catch {
    errorMsg.value = nl.common.error
  } finally {
    isLoading.value = false
  }
}

function isDirty(m: Match): boolean {
  const input = scoreInputs.value[m.id]
  const saved = savedScores.value[m.id]
  if (!input || !saved) return true
  if (saved.scoreA === null || saved.scoreB === null) return true
  return input.scoreA !== saved.scoreA || input.scoreB !== saved.scoreB
}

function isDraw(m: Match): boolean {
  const a = scoreInputs.value[m.id]
  if (!a) return false
  return a.scoreA !== '' && a.scoreB !== '' && a.scoreA === a.scoreB
}

async function saveScore(match: Match) {
  saving.value = match.id
  saveError.value = ''
  const input = scoreInputs.value[match.id]
  const body: Record<string, unknown> = {
    scoreA: Number(input.scoreA),
    scoreB: Number(input.scoreB),
  }
  if (match.phase === 'KO' && isDraw(match) && input.koWinnerId) {
    body.koWinnerId = Number(input.koWinnerId)
  }
  try {
    const updated = await $fetch<Match>(`/api/ref/matches/${match.id}`, {
      method: 'PATCH',
      body,
    })
    const idx = matches.value.findIndex((m) => m.id === match.id)
    if (idx !== -1) {
      matches.value[idx] = {
        ...matches.value[idx],
        scoreA: updated.scoreA,
        scoreB: updated.scoreB,
        status: updated.status,
        koWinnerId: updated.koWinnerId,
      }
    }
    savedScores.value[match.id] = { scoreA: input.scoreA, scoreB: input.scoreB }
  } catch (err: unknown) {
    const e = err as { data?: { error?: string } }
    saveError.value = e?.data?.error ?? nl.common.error
  } finally {
    saving.value = null
  }
}

function phaseLabel(phase: string): string {
  return phase === 'KO' ? nl.ref.matches.phaseKo : nl.ref.matches.phasePool
}

onMounted(() => { fetchMatches() })
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

      <p v-if="isLoading" class="mb-4 text-text-light">{{ nl.common.loading }}</p>
      <template v-else>
        <p v-if="errorMsg" class="mb-4 text-error">{{ errorMsg }}</p>
        <p v-if="saveError" class="mb-4 text-error">{{ saveError }}</p>

        <p v-if="matches.length === 0 && !errorMsg" class="text-text-light">
          {{ nl.common.noResults }}
        </p>
      </template>

      <div class="space-y-4">
        <div
          v-for="match in matches"
          :key="match.id"
          class="rounded-lg border border-gray-200 bg-surface p-4 shadow-sm"
        >
          <div class="mb-2 flex items-center justify-between text-sm text-text-light">
            <span>{{ phaseLabel(match.phase) }} — R{{ match.round }} — {{ match.field.name }}</span>
            <span>{{ formatDateTime(match.startTime) }}</span>
          </div>

          <div class="mb-3 text-base font-semibold text-text">
            {{ match.teamA.name }} vs {{ match.teamB.name }}
          </div>

          <div class="flex flex-wrap items-end gap-3">
            <div>
              <label class="mb-1 block text-sm text-text-light">{{ nl.ref.matches.scoreA }}</label>
              <input
                v-model="scoreInputs[match.id].scoreA"
                type="number"
                min="0"
                class="w-20 rounded border border-gray-300 bg-white p-2 text-center text-text"
              >
            </div>
            <div>
              <label class="mb-1 block text-sm text-text-light">{{ nl.ref.matches.scoreB }}</label>
              <input
                v-model="scoreInputs[match.id].scoreB"
                type="number"
                min="0"
                class="w-20 rounded border border-gray-300 bg-white p-2 text-center text-text"
              >
            </div>

            <div v-if="match.phase === 'KO' && isDraw(match)">
              <label class="mb-1 block text-sm text-text-light">{{ nl.ref.matches.koWinner }}</label>
              <select
                v-model="scoreInputs[match.id].koWinnerId"
                class="rounded border border-gray-300 bg-white p-2 text-text"
              >
                <option value="">—</option>
                <option :value="String(match.teamA.id)">{{ match.teamA.name }}</option>
                <option :value="String(match.teamB.id)">{{ match.teamB.name }}</option>
              </select>
            </div>

            <button
              class="rounded bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
              :disabled="!isDirty(match) || saving === match.id"
              @click="saveScore(match)"
            >
              {{ nl.ref.matches.saveScore }}
            </button>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

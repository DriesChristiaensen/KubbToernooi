<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { nl } from '~/i18n/nl'

definePageMeta({ middleware: ['auth', 'admin-tournament-guard'], layout: 'admin' })

interface Referee {
  id: string
  name: string
  createdAt: string
}

const referees = ref<Referee[]>([])
const newName = ref('')
const error = ref('')
const loading = ref(false)
const isLoading = ref(true)
const resetSuccess = ref<Set<string>>(new Set())
const resetLoading = ref<Set<string>>(new Set())
const deleteLoading = ref<Set<string>>(new Set())

async function fetchReferees() {
  try {
    referees.value = await $fetch<Referee[]>('/api/admin/referees')
  } catch {
    referees.value = []
  } finally {
    isLoading.value = false
  }
}

async function addReferee() {
  if (!newName.value.trim()) return
  error.value = ''
  loading.value = true
  try {
    await $fetch('/api/admin/referees', {
      method: 'POST',
      body: { name: newName.value.trim() },
    })
    newName.value = ''
    await fetchReferees()
  }
  catch (err: unknown) {
    const fetchErr = err as { data?: { data?: { error?: string } } }
    error.value = fetchErr?.data?.data?.error || nl.common.error
  }
  finally {
    loading.value = false
  }
}

async function resetPassword(id: string) {
  error.value = ''
  resetLoading.value = new Set([...resetLoading.value, id])
  try {
    await $fetch(`/api/admin/referees/${id}/reset-password`, { method: 'POST' })
    resetSuccess.value = new Set([...resetSuccess.value, id])
    setTimeout(() => {
      resetSuccess.value = new Set([...resetSuccess.value].filter(x => x !== id))
    }, 2000)
  }
  catch (err: unknown) {
    const fetchErr = err as { data?: { data?: { error?: string } } }
    error.value = fetchErr?.data?.data?.error || nl.common.error
  }
  finally {
    resetLoading.value = new Set([...resetLoading.value].filter(x => x !== id))
  }
}

async function deleteReferee(id: string) {
  if (!confirm(nl.admin.referees.deleteConfirm)) return
  error.value = ''
  deleteLoading.value = new Set([...deleteLoading.value, id])
  try {
    await $fetch(`/api/admin/referees/${id}`, { method: 'DELETE' })
    await fetchReferees()
  } catch (err: unknown) {
    const fetchErr = err as { data?: { data?: { error?: string } } }
    error.value = fetchErr?.data?.data?.error || nl.common.error
  } finally {
    deleteLoading.value = new Set([...deleteLoading.value].filter(x => x !== id))
  }
}

onMounted(fetchReferees)
</script>

<template>
  <main class="mx-auto max-w-content p-4">
    <div class="mb-4 flex items-center gap-3">
      <NuxtLink to="/admin" class="text-sm text-text-light hover:text-primary">
        &larr; {{ nl.common.back }}
      </NuxtLink>
      <h1 class="text-lg font-bold text-text">
        {{ nl.admin.referees.title }}
      </h1>
    </div>
      <form class="mb-6 flex flex-col gap-3 rounded-lg bg-surface p-4 shadow-sm md:flex-row md:items-end" @submit.prevent="addReferee">
        <div class="flex-1">
          <label class="mb-1 block text-sm font-medium text-text" for="ref-name">{{ nl.auth.name }}</label>
          <input
            id="ref-name"
            v-model="newName"
            type="text"
            required
            class="w-full rounded border border-gray-300 px-3 py-2 text-text focus:border-primary focus:outline-none"
          >
        </div>
        <button
          type="submit"
          :disabled="loading"
          class="rounded bg-primary px-4 py-2 font-medium text-white hover:bg-primary-dark disabled:opacity-50"
        >
          {{ nl.common.add }}
        </button>
      </form>

      <p v-if="error" class="mb-4 text-sm text-error">
        {{ error }}
      </p>

      <p v-if="isLoading" class="text-text">
        {{ nl.common.loading }}
      </p>
      <ul v-else class="space-y-2">
        <li
          v-for="referee in referees"
          :key="referee.id"
          class="flex items-center justify-between rounded-lg bg-surface p-4 shadow-sm"
        >
          <span class="font-medium text-text">{{ referee.name }}</span>
          <div class="flex gap-2">
            <div class="group relative">
              <button
                :disabled="resetLoading.has(referee.id)"
                :class="resetSuccess.has(referee.id) ? 'bg-success' : 'bg-secondary hover:opacity-80'"
                class="rounded px-3 py-1 text-sm text-white transition-colors disabled:opacity-50"
                :aria-label="resetSuccess.has(referee.id) ? nl.common.save : nl.auth.resetPassword"
                @click="resetPassword(referee.id)"
              >
                <span v-if="resetSuccess.has(referee.id)">✓</span>
                <span v-else>{{ nl.auth.resetPassword }}</span>
              </button>
              <div v-if="resetLoading.has(referee.id)" class="invisible absolute bottom-full left-1/2 z-10 mb-1 w-max max-w-xs -translate-x-1/2 rounded bg-gray-800 px-2 py-1 text-xs text-white group-hover:visible">
                {{ nl.common.submitting }}
              </div>
            </div>
            <div class="group relative">
              <button
                :disabled="deleteLoading.has(referee.id)"
                class="rounded bg-error px-3 py-1 text-sm text-white hover:bg-red-700 disabled:opacity-50"
                @click="deleteReferee(referee.id)"
              >
                {{ nl.common.delete }}
              </button>
              <div v-if="deleteLoading.has(referee.id)" class="invisible absolute bottom-full left-1/2 z-10 mb-1 w-max max-w-xs -translate-x-1/2 rounded bg-gray-800 px-2 py-1 text-xs text-white group-hover:visible">
                {{ nl.common.deleting }}
              </div>
            </div>
          </div>
        </li>
        <li v-if="referees.length === 0" class="text-text-light">
          {{ nl.common.noResults }}
        </li>
      </ul>
  </main>
</template>

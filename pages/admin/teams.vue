<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { nl } from '~/i18n/nl'

definePageMeta({ middleware: 'auth' })

interface Team {
  id: number
  name: string
}

const teams = ref<Team[]>([])
const newName = ref('')
const editingId = ref<number | null>(null)
const editingName = ref('')
const error = ref('')
const loading = ref(false)

async function fetchTeams() {
  try {
    teams.value = await $fetch<Team[]>('/api/admin/teams')
  }
  catch {
    error.value = nl.admin.tournament.notFound
  }
}

async function addTeam() {
  if (!newName.value.trim()) return
  error.value = ''
  loading.value = true
  try {
    await $fetch('/api/admin/teams', {
      method: 'POST',
      body: { name: newName.value.trim() },
    })
    newName.value = ''
    await fetchTeams()
  }
  catch (err: unknown) {
    const fetchErr = err as { data?: { data?: { error?: string } } }
    error.value = fetchErr?.data?.data?.error || nl.common.error
  }
  finally {
    loading.value = false
  }
}

function startEdit(team: Team) {
  editingId.value = team.id
  editingName.value = team.name
}

function cancelEdit() {
  editingId.value = null
  editingName.value = ''
}

async function saveEdit() {
  if (!editingName.value.trim() || editingId.value === null) return
  error.value = ''
  loading.value = true
  try {
    await $fetch(`/api/admin/teams/${editingId.value}` as string, {
      method: 'PUT',
      body: { name: editingName.value.trim() },
    })
    editingId.value = null
    editingName.value = ''
    await fetchTeams()
  }
  catch (err: unknown) {
    const fetchErr = err as { data?: { data?: { error?: string } } }
    error.value = fetchErr?.data?.data?.error || nl.common.error
  }
  finally {
    loading.value = false
  }
}

async function deleteTeam(team: Team) {
  if (!confirm(nl.admin.teams.deleteConfirm)) return
  error.value = ''
  try {
    await $fetch(`/api/admin/teams/${team.id}` as string, { method: 'DELETE' })
    await fetchTeams()
  }
  catch (err: unknown) {
    const fetchErr = err as { data?: { data?: { error?: string } } }
    error.value = fetchErr?.data?.data?.error || nl.common.error
  }
}

onMounted(fetchTeams)
</script>

<template>
  <div class="min-h-screen bg-background">
    <header class="flex items-center gap-4 bg-primary-dark p-4">
      <NuxtLink to="/admin" class="text-white hover:underline">
        &larr; {{ nl.common.back }}
      </NuxtLink>
      <h1 class="text-lg font-bold text-white">
        {{ nl.admin.teams.title }}
      </h1>
    </header>

    <main class="mx-auto max-w-content p-4">
      <form class="mb-6 flex flex-col gap-3 rounded-lg bg-surface p-4 shadow-sm md:flex-row md:items-end" @submit.prevent="addTeam">
        <div class="flex-1">
          <label class="mb-1 block text-sm font-medium text-text" for="team-name">{{ nl.admin.teams.nameLabel }}</label>
          <input
            id="team-name"
            v-model="newName"
            type="text"
            required
            :placeholder="nl.admin.teams.namePlaceholder"
            class="w-full rounded border border-gray-300 px-3 py-2 text-text focus:border-primary focus:outline-none"
          >
        </div>
        <button
          type="submit"
          :disabled="loading"
          class="rounded bg-primary px-4 py-2 font-medium text-white hover:bg-primary-dark disabled:opacity-50"
        >
          {{ nl.admin.teams.addButton }}
        </button>
      </form>

      <p v-if="error" class="mb-4 text-sm text-error">
        {{ error }}
      </p>

      <ul class="space-y-2">
        <li
          v-for="team in teams"
          :key="team.id"
          class="flex items-center justify-between rounded-lg bg-surface p-4 shadow-sm"
        >
          <template v-if="editingId === team.id">
            <form class="flex flex-1 items-center gap-2" @submit.prevent="saveEdit">
              <input
                v-model="editingName"
                type="text"
                required
                class="flex-1 rounded border border-gray-300 px-3 py-1 text-text focus:border-primary focus:outline-none"
              >
              <button
                type="submit"
                :disabled="loading"
                class="rounded bg-success px-3 py-1 text-sm text-white hover:opacity-80 disabled:opacity-50"
              >
                {{ nl.common.save }}
              </button>
              <button
                type="button"
                class="rounded bg-secondary px-3 py-1 text-sm text-white hover:opacity-80"
                @click="cancelEdit"
              >
                {{ nl.common.cancel }}
              </button>
            </form>
          </template>
          <template v-else>
            <span class="font-medium text-text">{{ team.name }}</span>
            <div class="flex gap-2">
              <button
                class="rounded bg-primary px-3 py-1 text-sm text-white hover:bg-primary-dark"
                @click="startEdit(team)"
              >
                {{ nl.common.edit }}
              </button>
              <button
                class="rounded bg-error px-3 py-1 text-sm text-white hover:bg-red-700"
                @click="deleteTeam(team)"
              >
                {{ nl.common.delete }}
              </button>
            </div>
          </template>
        </li>
        <li v-if="teams.length === 0" class="text-text-light">
          {{ nl.common.noResults }}
        </li>
      </ul>
    </main>
  </div>
</template>

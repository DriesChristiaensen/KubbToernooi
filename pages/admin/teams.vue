<script setup lang="ts">
import { ref, onMounted } from "vue";
import { nl } from "~/i18n/nl";

definePageMeta({ middleware: ["auth", "admin-tournament-guard"], layout: "admin" });

useHead({ title: 'Teams | Kubb 2026' })

interface Team {
  id: string;
  name: string;
}

const teams = ref<Team[]>([]);
const newName = ref("");
const editingId = ref<string | null>(null);
const editingName = ref("");
const error = ref("");
const loading = ref(false);
const isLoading = ref(true);

const bulkText = ref("");
const bulkError = ref("");
const bulkSuccess = ref("");
const bulkLoading = ref(false);
const deleteLoading = ref<Set<string>>(new Set());
const isLive = ref(false);

async function fetchTeams() {
  try {
    const [teamsData, dashboard] = await Promise.all([
      $fetch<Team[]>("/api/admin/teams"),
      $fetch<{ isLive: boolean }>("/api/admin/dashboard"),
    ]);
    teams.value = teamsData;
    isLive.value = dashboard.isLive;
  } catch {
    teams.value = [];
  } finally {
    isLoading.value = false;
  }
}

async function addTeam() {
  if (!newName.value.trim()) return;
  error.value = "";
  loading.value = true;
  try {
    await $fetch("/api/admin/teams", {
      method: "POST",
      body: { name: newName.value.trim() },
    });
    newName.value = "";
    await fetchTeams();
  } catch (err: unknown) {
    const fetchErr = err as { data?: { data?: { error?: string } } };
    error.value = fetchErr?.data?.data?.error || nl.common.error;
  } finally {
    loading.value = false;
  }
}

function startEdit(team: Team) {
  editingId.value = team.id;
  editingName.value = team.name;
}

function cancelEdit() {
  editingId.value = null;
  editingName.value = "";
}

async function saveEdit() {
  if (!editingName.value.trim() || editingId.value === null) return;
  error.value = "";
  loading.value = true;
  try {
    await $fetch(`/api/admin/teams/${editingId.value}`, {
      method: "PUT",
      body: { name: editingName.value.trim() },
    });
    editingId.value = null;
    editingName.value = "";
    await fetchTeams();
  } catch (err: unknown) {
    const fetchErr = err as { data?: { data?: { error?: string } } };
    error.value = fetchErr?.data?.data?.error || nl.common.error;
  } finally {
    loading.value = false;
  }
}

async function deleteTeam(team: Team) {
  if (!confirm(nl.admin.teams.deleteConfirm)) return;
  error.value = "";
  deleteLoading.value = new Set([...deleteLoading.value, team.id]);
  try {
    await $fetch(`/api/admin/teams/${team.id}`, { method: "DELETE" });
    await fetchTeams();
  } catch (err: unknown) {
    const fetchErr = err as { data?: { data?: { error?: string } } };
    error.value = fetchErr?.data?.data?.error || nl.common.error;
  } finally {
    deleteLoading.value = new Set([...deleteLoading.value].filter(x => x !== team.id));
  }
}

async function bulkImport() {
  bulkError.value = "";
  bulkSuccess.value = "";
  const names = bulkText.value
    .split("\n")
    .map((n) => n.trim())
    .filter((n) => n.length > 0);
  if (names.length === 0) {
    bulkError.value = nl.admin.teams.bulkEmpty;
    return;
  }
  bulkLoading.value = true;
  try {
    const result = await $fetch<{ imported: number }>(
      "/api/admin/teams/bulk-import",
      { method: "POST", body: { names } },
    );
    bulkText.value = "";
    bulkSuccess.value = `${result.imported} ${nl.admin.teams.imported}`;
    await fetchTeams();
  } catch (err: unknown) {
    const fetchErr = err as { data?: { data?: { error?: string } } };
    bulkError.value = fetchErr?.data?.data?.error || nl.common.error;
  } finally {
    bulkLoading.value = false;
  }
}

onMounted(fetchTeams);
</script>

<template>
  <main class="mx-auto max-w-content p-4">
    <div class="mb-4 flex items-center gap-3">
      <NuxtLink to="/admin" class="text-sm text-text-light hover:text-primary">
        &larr; {{ nl.common.back }}
      </NuxtLink>
      <h1 class="text-lg font-bold text-text">
        {{ nl.admin.teams.title }}
      </h1>
    </div>
      <form
        class="mb-6 flex flex-col gap-3 rounded-lg bg-surface p-4 shadow-sm md:flex-row md:items-end"
        @submit.prevent="addTeam"
      >
        <div class="flex-1">
          <label
            class="mb-1 block text-sm font-medium text-text"
            for="team-name"
            >{{ nl.admin.teams.nameLabel }}</label
          >
          <input
            id="team-name"
            v-model="newName"
            type="text"
            required
            :disabled="loading"
            :placeholder="nl.admin.teams.namePlaceholder"
            class="w-full rounded border border-gray-300 px-3 py-2 text-text focus:border-primary focus:outline-none disabled:opacity-50"
          >
        </div>
        <div class="group relative">
          <button
            type="submit"
            :disabled="loading"
            class="rounded bg-primary px-4 py-2 font-medium text-white hover:bg-primary-dark disabled:opacity-50"
          >
            {{ nl.admin.teams.addButton }}
          </button>
          <div v-if="loading" class="invisible absolute bottom-full left-1/2 z-10 mb-1 w-max max-w-xs -translate-x-1/2 rounded bg-gray-800 px-2 py-1 text-xs text-white group-hover:visible">
            {{ nl.common.saving }}
          </div>
        </div>
      </form>

      <p v-if="error" class="mb-4 text-sm text-error">
        {{ error }}
      </p>

      <section class="mb-6 rounded-lg bg-surface p-4 shadow-sm">
        <h2 class="mb-3 font-semibold text-text">
          {{ nl.admin.teams.bulkImport }}
        </h2>
        <textarea
          v-model="bulkText"
          :placeholder="nl.admin.teams.bulkPlaceholder"
          rows="5"
          class="mb-3 w-full rounded border border-gray-300 px-3 py-2 text-text focus:border-primary focus:outline-none"
        />
        <p v-if="bulkError" class="mb-2 text-sm text-error">
          {{ bulkError }}
        </p>
        <p v-if="bulkSuccess" class="mb-2 text-sm text-success">
          {{ bulkSuccess }}
        </p>
        <div class="group relative">
          <button
            :disabled="bulkLoading"
            class="rounded bg-primary px-4 py-2 font-medium text-white hover:bg-primary-dark disabled:opacity-50"
            @click="bulkImport"
          >
            {{ nl.admin.teams.bulkImport }}
          </button>
          <div v-if="bulkLoading" class="invisible absolute bottom-full left-1/2 z-10 mb-1 w-max max-w-xs -translate-x-1/2 rounded bg-gray-800 px-2 py-1 text-xs text-white group-hover:visible">
            {{ nl.common.importing }}
          </div>
        </div>
      </section>

      <p v-if="isLoading" class="text-text">
        {{ nl.common.loading }}
      </p>
      <ul v-else class="space-y-2">
        <li
          v-for="team in teams"
          :key="team.id"
          class="flex items-center justify-between rounded-lg bg-surface p-4 shadow-sm"
        >
          <template v-if="editingId === team.id">
            <form
              class="flex flex-1 items-center gap-2"
              @submit.prevent="saveEdit"
            >
              <input
                v-model="editingName"
                type="text"
                required
                class="flex-1 rounded border border-gray-300 px-3 py-1 text-text focus:border-primary focus:outline-none"
              >
              <div class="group relative">
                <button
                  type="submit"
                  :disabled="loading"
                  class="rounded bg-success px-3 py-1 text-sm text-white hover:opacity-80 disabled:opacity-50"
                >
                  {{ nl.common.save }}
                </button>
                <div v-if="loading" class="invisible absolute bottom-full left-1/2 z-10 mb-1 w-max max-w-xs -translate-x-1/2 rounded bg-gray-800 px-2 py-1 text-xs text-white group-hover:visible">
                  {{ nl.common.saving }}
                </div>
              </div>
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
              <div class="group relative">
                <button
                  :disabled="deleteLoading.has(team.id) || isLive"
                  class="rounded bg-error px-3 py-1 text-sm text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                  @click="deleteTeam(team)"
                >
                  {{ nl.common.delete }}
                </button>
                <div class="pointer-events-none invisible absolute bottom-full left-1/2 z-10 mb-1 w-max max-w-xs -translate-x-1/2 rounded bg-gray-800 px-2 py-1 text-xs text-white group-hover:visible">
                  {{ isLive ? nl.admin.dashboardDisabled.lockedLive : nl.common.deleting }}
                </div>
              </div>
            </div>
          </template>
        </li>
        <li v-if="teams.length === 0" class="text-text-light">
          {{ nl.common.noResults }}
        </li>
      </ul>
  </main>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { nl } from "~/i18n/nl";

definePageMeta({ middleware: "auth" });

interface Tournament {
  id: number;
  name: string;
  status: string;
  type: string;
  startTime: string;
  matchDuration: number;
  breakTime: number;
  pointsWin: number;
  pointsDraw: number;
  pointsLoss: number;
}

interface PoolTeam {
  team: { id: number; name: string };
}

interface Pool {
  id: number;
  name: string;
  teamsAdvancing: number;
  poolTeams: PoolTeam[];
}

const tournament = ref<Tournament | null>(null);
const pools = ref<Pool[]>([]);
const isLoading = ref(true);
const settingsError = ref("");
const settingsSuccess = ref("");
const settingsLoading = ref(false);
const publishLoading = ref(false);
const publishError = ref("");

const poolCount = ref<number | null>(null);
const poolGenError = ref("");
const poolGenSuccess = ref("");
const poolGenLoading = ref(false);
const showPoolOverwrite = ref(false);

const editingPool = ref<Pool | null>(null);
const poolError = ref("");

const hasPools = computed(() =>
  tournament.value?.type === "POOLS" || tournament.value?.type === "COMBINATION",
);

async function fetchTournament() {
  try {
    tournament.value = await $fetch<Tournament>("/api/admin/tournament");
  } catch {
    settingsError.value = nl.admin.tournament.notFound;
  } finally {
    isLoading.value = false;
  }
}

async function fetchPools() {
  try {
    pools.value = await $fetch<Pool[]>("/api/admin/pools");
  } catch {
    poolError.value = nl.common.error;
  }
}

async function saveSettings() {
  if (!tournament.value) return;
  settingsError.value = "";
  settingsSuccess.value = "";
  settingsLoading.value = true;
  try {
    await $fetch("/api/admin/tournament", {
      method: "PATCH",
      body: {
        type: tournament.value.type,
        pointsWin: tournament.value.pointsWin,
        pointsDraw: tournament.value.pointsDraw,
        pointsLoss: tournament.value.pointsLoss,
        matchDuration: tournament.value.matchDuration,
        breakTime: tournament.value.breakTime,
      },
    });
    settingsSuccess.value = nl.admin.tournament.saveSuccess;
  } catch (err: unknown) {
    const fetchErr = err as { data?: { data?: { error?: string } } };
    settingsError.value = fetchErr?.data?.data?.error || nl.common.error;
  } finally {
    settingsLoading.value = false;
  }
}

async function togglePublish() {
  if (!tournament.value) return;
  publishError.value = "";
  publishLoading.value = true;
  const newStatus = tournament.value.status === "LIVE" ? "DRAFT" : "LIVE";
  try {
    await $fetch("/api/admin/tournament", {
      method: "PATCH",
      body: { status: newStatus },
    });
    tournament.value.status = newStatus;
  } catch (err: unknown) {
    const fetchErr = err as { data?: { data?: { error?: string } } };
    publishError.value = fetchErr?.data?.data?.error || nl.common.error;
  } finally {
    publishLoading.value = false;
  }
}

async function generatePools(overwrite = false) {
  poolGenError.value = "";
  poolGenSuccess.value = "";
  showPoolOverwrite.value = false;
  if (!poolCount.value || poolCount.value <= 0) {
    poolGenError.value = nl.admin.pools.poolCountRequired;
    return;
  }
  poolGenLoading.value = true;
  try {
    const result = await $fetch<{ generated: number }>("/api/admin/pools/generate", {
      method: "POST",
      body: { poolCount: poolCount.value, overwrite },
    });
    poolCount.value = null;
    poolGenSuccess.value = `${result.generated} ${nl.admin.pools.generated}`;
    await fetchPools();
  } catch (err: unknown) {
    const fetchErr = err as { data?: { data?: { error?: string; code?: number } } };
    if (fetchErr?.data?.data?.code === 409) {
      showPoolOverwrite.value = true;
      poolGenError.value = nl.admin.pools.existingWarning;
    } else {
      poolGenError.value = fetchErr?.data?.data?.error || nl.common.error;
    }
  } finally {
    poolGenLoading.value = false;
  }
}

function startEditPool(pool: Pool) {
  editingPool.value = { ...pool, poolTeams: [...pool.poolTeams] };
}

function cancelEditPool() {
  editingPool.value = null;
  poolError.value = "";
}

async function savePool() {
  if (!editingPool.value) return;
  poolError.value = "";
  try {
    await $fetch(`/api/admin/pools/${editingPool.value.id}` as string, {
      method: "PUT",
      body: {
        name: editingPool.value.name,
        teamsAdvancing: editingPool.value.teamsAdvancing,
      },
    });
    editingPool.value = null;
    await fetchPools();
  } catch (err: unknown) {
    const fetchErr = err as { data?: { data?: { error?: string } } };
    poolError.value = fetchErr?.data?.data?.error || nl.common.error;
  }
}

async function deletePool(pool: Pool) {
  if (!confirm(nl.admin.pools.deleteConfirm)) return;
  poolError.value = "";
  try {
    await $fetch(`/api/admin/pools/${pool.id}` as string, { method: "DELETE" });
    await fetchPools();
  } catch (err: unknown) {
    const fetchErr = err as { data?: { data?: { error?: string } } };
    poolError.value = fetchErr?.data?.data?.error || nl.common.error;
  }
}

onMounted(async () => {
  await fetchTournament();
  await fetchPools();
});
</script>

<template>
  <div class="min-h-screen bg-background">
    <header class="flex items-center gap-4 bg-primary-dark p-4">
      <NuxtLink to="/admin" class="text-white hover:underline">
        &larr; {{ nl.common.back }}
      </NuxtLink>
      <h1 class="text-lg font-bold text-white">
        {{ nl.admin.tournament.title }}
      </h1>
    </header>

    <main class="mx-auto max-w-content p-4">
      <p v-if="isLoading" class="text-text">
        {{ nl.common.loading }}
      </p>
      <p v-else-if="!tournament" class="text-error">
        {{ nl.admin.tournament.notFound }}
      </p>

      <template v-if="tournament">
        <section class="mb-6 rounded-lg bg-surface p-4 shadow-sm">
          <h2 class="mb-4 font-semibold text-text">
            {{ nl.admin.tournament.title }}
          </h2>

          <div class="mb-3">
            <label class="mb-1 block text-sm font-medium text-text" for="tour-type">
              {{ nl.admin.tournament.type }}
            </label>
            <select
              id="tour-type"
              v-model="tournament.type"
              class="w-full rounded border border-gray-300 px-3 py-2 text-text focus:border-primary focus:outline-none"
            >
              <option value="POOLS">{{ nl.admin.tournament.typePool }}</option>
              <option value="KNOCKOUT">{{ nl.admin.tournament.typeKnockout }}</option>
              <option value="COMBINATION">{{ nl.admin.tournament.typeCombination }}</option>
            </select>
          </div>

          <div class="mb-3 grid gap-3 md:grid-cols-3">
            <div>
              <label class="mb-1 block text-sm font-medium text-text">
                {{ nl.admin.tournament.pointsWin }}
              </label>
              <input
                v-model.number="tournament.pointsWin"
                type="number"
                min="0"
                class="w-full rounded border border-gray-300 px-3 py-2 text-text focus:border-primary focus:outline-none"
              >
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium text-text">
                {{ nl.admin.tournament.pointsDraw }}
              </label>
              <input
                v-model.number="tournament.pointsDraw"
                type="number"
                min="0"
                class="w-full rounded border border-gray-300 px-3 py-2 text-text focus:border-primary focus:outline-none"
              >
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium text-text">
                {{ nl.admin.tournament.pointsLoss }}
              </label>
              <input
                v-model.number="tournament.pointsLoss"
                type="number"
                min="0"
                class="w-full rounded border border-gray-300 px-3 py-2 text-text focus:border-primary focus:outline-none"
              >
            </div>
          </div>

          <div class="mb-4 grid gap-3 md:grid-cols-2">
            <div>
              <label class="mb-1 block text-sm font-medium text-text">
                {{ nl.admin.tournament.matchDuration }}
              </label>
              <input
                v-model.number="tournament.matchDuration"
                type="number"
                min="1"
                class="w-full rounded border border-gray-300 px-3 py-2 text-text focus:border-primary focus:outline-none"
              >
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium text-text">
                {{ nl.admin.tournament.breakTime }}
              </label>
              <input
                v-model.number="tournament.breakTime"
                type="number"
                min="0"
                class="w-full rounded border border-gray-300 px-3 py-2 text-text focus:border-primary focus:outline-none"
              >
            </div>
          </div>

          <p v-if="settingsError" class="mb-2 text-sm text-error">
            {{ settingsError }}
          </p>
          <p v-if="settingsSuccess" class="mb-2 text-sm text-success">
            {{ settingsSuccess }}
          </p>
          <div class="flex flex-wrap items-center gap-3">
            <button
              :disabled="settingsLoading"
              class="rounded bg-primary px-4 py-2 font-medium text-white hover:bg-primary-dark disabled:opacity-50"
              @click="saveSettings"
            >
              {{ nl.admin.tournament.save }}
            </button>

            <span class="text-sm font-medium text-text-light">
              {{ tournament.status === 'LIVE' ? nl.admin.tournament.statusLive : nl.admin.tournament.statusDraft }}
            </span>

            <button
              :disabled="publishLoading"
              :class="tournament.status === 'LIVE'
                ? 'bg-secondary hover:opacity-80'
                : 'bg-success hover:opacity-80'"
              class="rounded px-4 py-2 font-medium text-white disabled:opacity-50"
              @click="togglePublish"
            >
              {{ tournament.status === 'LIVE' ? nl.admin.tournament.unpublish : nl.admin.tournament.publish }}
            </button>

            <p v-if="publishError" class="text-sm text-error">
              {{ publishError }}
            </p>
          </div>
        </section>

        <section v-if="hasPools" class="mb-6 rounded-lg bg-surface p-4 shadow-sm">
          <h2 class="mb-4 font-semibold text-text">
            {{ nl.admin.pools.title }}
          </h2>

          <div class="mb-4 flex flex-col gap-3 md:flex-row md:items-end">
            <div class="flex-1">
              <label class="mb-1 block text-sm font-medium text-text" for="pool-count">
                {{ nl.admin.pools.poolCount }}
              </label>
              <input
                id="pool-count"
                v-model.number="poolCount"
                type="number"
                min="1"
                class="w-full rounded border border-gray-300 px-3 py-2 text-text focus:border-primary focus:outline-none"
              >
            </div>
            <button
              :disabled="poolGenLoading"
              class="rounded bg-primary px-4 py-2 font-medium text-white hover:bg-primary-dark disabled:opacity-50"
              @click="generatePools(false)"
            >
              {{ nl.admin.pools.generateButton }}
            </button>
          </div>

          <p v-if="poolGenError" class="mb-2 text-sm text-error">
            {{ poolGenError }}
          </p>
          <p v-if="poolGenSuccess" class="mb-2 text-sm text-success">
            {{ poolGenSuccess }}
          </p>
          <div v-if="showPoolOverwrite" class="mb-4 flex gap-2">
            <button
              class="rounded bg-error px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              @click="generatePools(true)"
            >
              {{ nl.common.confirm }}
            </button>
            <button
              class="rounded bg-secondary px-4 py-2 text-sm font-medium text-white hover:opacity-80"
              @click="showPoolOverwrite = false; poolGenError = ''"
            >
              {{ nl.common.cancel }}
            </button>
          </div>

          <p v-if="poolError" class="mb-2 text-sm text-error">
            {{ poolError }}
          </p>

          <ul class="space-y-3">
            <li
              v-for="pool in pools"
              :key="pool.id"
              class="rounded-lg border border-gray-200 p-4"
            >
              <template v-if="editingPool?.id === pool.id">
                <div class="flex flex-col gap-2">
                  <input
                    v-model="editingPool.name"
                    type="text"
                    class="rounded border border-gray-300 px-3 py-1 text-text focus:border-primary focus:outline-none"
                  >
                  <div class="flex items-center gap-2">
                    <label class="text-sm text-text">{{ nl.admin.pools.teamsAdvancing }}</label>
                    <input
                      v-model.number="editingPool.teamsAdvancing"
                      type="number"
                      min="1"
                      class="w-20 rounded border border-gray-300 px-2 py-1 text-text focus:border-primary focus:outline-none"
                    >
                  </div>
                  <div class="flex gap-2">
                    <button
                      class="rounded bg-success px-3 py-1 text-sm text-white hover:opacity-80"
                      @click="savePool"
                    >
                      {{ nl.common.save }}
                    </button>
                    <button
                      class="rounded bg-secondary px-3 py-1 text-sm text-white hover:opacity-80"
                      @click="cancelEditPool"
                    >
                      {{ nl.common.cancel }}
                    </button>
                  </div>
                </div>
              </template>
              <template v-else>
                <div class="flex items-start justify-between">
                  <div>
                    <p class="font-semibold text-text">{{ pool.name }}</p>
                    <p v-if="tournament.type === 'COMBINATION'" class="text-sm text-text-light">
                      {{ nl.admin.pools.teamsAdvancing }}: {{ pool.teamsAdvancing }}
                    </p>
                    <ul class="mt-1 text-sm text-text-light">
                      <li v-if="pool.poolTeams.length === 0">
                        {{ nl.admin.pools.noTeams }}
                      </li>
                      <li v-for="pt in pool.poolTeams" :key="pt.team.id">
                        {{ pt.team.name }}
                      </li>
                    </ul>
                  </div>
                  <div class="flex gap-2">
                    <button
                      class="rounded bg-primary px-3 py-1 text-sm text-white hover:bg-primary-dark"
                      @click="startEditPool(pool)"
                    >
                      {{ nl.common.edit }}
                    </button>
                    <button
                      class="rounded bg-error px-3 py-1 text-sm text-white hover:bg-red-700"
                      @click="deletePool(pool)"
                    >
                      {{ nl.common.delete }}
                    </button>
                  </div>
                </div>
              </template>
            </li>
            <li v-if="pools.length === 0" class="text-text-light">
              {{ nl.common.noResults }}
            </li>
          </ul>
        </section>
      </template>
    </main>
  </div>
</template>

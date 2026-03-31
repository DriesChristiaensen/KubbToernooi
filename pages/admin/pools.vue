<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { nl } from "~/i18n/nl";

definePageMeta({ middleware: ["auth", "admin-tournament-guard"], layout: "admin" });

interface Team {
  id: string;
  name: string;
}

interface PoolTeam {
  team: Team;
}

interface Pool {
  id: string;
  name: string;
  teamsAdvancing: number;
  poolTeams: PoolTeam[];
}

interface Tournament {
  type: string;
}

const tournament = ref<Tournament | null>(null);
const pools = ref<Pool[]>([]);
const allTeams = ref<Team[]>([]);
const isLoading = ref(true);
const error = ref("");

const poolCount = ref<number | null>(null);
const poolGenError = ref("");
const poolGenSuccess = ref("");
const poolGenLoading = ref(false);
const showPoolOverwrite = ref(false);

const editingPool = ref<Pool | null>(null);
const editingSelectedTeamIds = ref<string[]>([]);
const assignError = ref("");
const assignSuccess = ref("");
const assignLoading = ref(false);

const poolEditName = ref("");
const poolEditTeamsAdvancing = ref(1);

const hasPools = computed(() =>
  tournament.value?.type === "POOLS" || tournament.value?.type === "COMBINATION",
);

const assignedTeamIds = computed(() => {
  const ids = new Set<string>();
  for (const pool of pools.value) {
    for (const pt of pool.poolTeams) {
      ids.add(pt.team.id);
    }
  }
  return ids;
});

const unassignedCount = computed(() =>
  allTeams.value.filter((t) => !assignedTeamIds.value.has(t.id)).length,
);

async function fetchData() {
  try {
    const [t, p, teams] = await Promise.all([
      $fetch<Tournament>("/api/admin/tournament"),
      $fetch<Pool[]>("/api/admin/pools"),
      $fetch<Team[]>("/api/admin/teams"),
    ]);
    tournament.value = t;
    pools.value = p;
    allTeams.value = teams;
  } catch {
    error.value = nl.common.error;
  } finally {
    isLoading.value = false;
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
    await fetchData();
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

function startAssign(pool: Pool) {
  editingPool.value = pool;
  poolEditName.value = pool.name;
  poolEditTeamsAdvancing.value = pool.teamsAdvancing;
  editingSelectedTeamIds.value = pool.poolTeams.map((pt) => pt.team.id);
  assignError.value = "";
  assignSuccess.value = "";
}

function cancelAssign() {
  editingPool.value = null;
  assignError.value = "";
  assignSuccess.value = "";
}

function isTeamDisabled(teamId: string): boolean {
  if (!editingPool.value) return false;
  if (editingSelectedTeamIds.value.includes(teamId)) return false;
  return assignedTeamIds.value.has(teamId);
}

function toggleTeam(teamId: string) {
  if (isTeamDisabled(teamId)) return;
  const idx = editingSelectedTeamIds.value.indexOf(teamId);
  if (idx === -1) {
    editingSelectedTeamIds.value.push(teamId);
  } else {
    editingSelectedTeamIds.value.splice(idx, 1);
  }
}

async function saveAssignment() {
  if (!editingPool.value) return;
  assignError.value = "";
  assignSuccess.value = "";
  assignLoading.value = true;
  try {
    await $fetch(`/api/admin/pools/${editingPool.value.id}` as string, {
      method: "PUT",
      body: {
        name: poolEditName.value,
        teamsAdvancing: poolEditTeamsAdvancing.value,
        teamIds: editingSelectedTeamIds.value,
      },
    });
    assignSuccess.value = nl.admin.pools.assignSuccess;
    editingPool.value = null;
    await fetchData();
  } catch (err: unknown) {
    const fetchErr = err as { data?: { data?: { error?: string } } };
    assignError.value = fetchErr?.data?.data?.error || nl.common.error;
  } finally {
    assignLoading.value = false;
  }
}

async function deletePool(pool: Pool) {
  if (!confirm(nl.admin.pools.deleteConfirm)) return;
  error.value = "";
  try {
    await $fetch(`/api/admin/pools/${pool.id}` as string, { method: "DELETE" });
    await fetchData();
  } catch (err: unknown) {
    const fetchErr = err as { data?: { data?: { error?: string } } };
    error.value = fetchErr?.data?.data?.error || nl.common.error;
  }
}

onMounted(fetchData);
</script>

<template>
  <main class="mx-auto max-w-content p-4">
    <div class="mb-4 flex items-center gap-3">
      <NuxtLink to="/admin" class="text-sm text-text-light hover:text-primary">
        &larr; {{ nl.common.back }}
      </NuxtLink>
      <h1 class="text-lg font-bold text-text">
        {{ nl.admin.pools.title }}
      </h1>
    </div>

    <p v-if="isLoading" class="text-text">
      {{ nl.common.loading }}
    </p>

    <template v-else-if="!hasPools">
      <p class="text-text-light">
        {{ nl.admin.pools.notAvailableForType }}
      </p>
    </template>

    <template v-else>
      <!-- Unassigned teams warning -->
      <div
        v-if="unassignedCount > 0 && pools.length > 0"
        class="mb-4 rounded-lg border border-warning bg-warning/10 px-4 py-2 text-sm font-medium text-text"
      >
        {{ nl.admin.pools.unassignedWarning.replace("{n}", String(unassignedCount)) }}
      </div>

      <!-- Generate pools -->
      <section class="mb-6 rounded-lg bg-surface p-4 shadow-sm">
        <h2 class="mb-3 font-semibold text-text">
          {{ nl.admin.pools.generate }}
        </h2>
        <div class="mb-3 flex flex-col gap-3 md:flex-row md:items-end">
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
        <div v-if="showPoolOverwrite" class="flex gap-2">
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
      </section>

      <!-- Pool list -->
      <p v-if="error" class="mb-4 text-sm text-error">
        {{ error }}
      </p>

      <ul class="space-y-4">
        <li
          v-for="pool in pools"
          :key="pool.id"
          class="rounded-lg border border-gray-200 bg-surface p-4 shadow-sm"
        >
          <!-- Assignment editor -->
          <template v-if="editingPool?.id === pool.id">
            <div class="mb-3 flex flex-col gap-2 md:flex-row md:items-end">
              <div class="flex-1">
                <label class="mb-1 block text-sm font-medium text-text">{{ nl.admin.pools.nameLabel }}</label>
                <input
                  v-model="poolEditName"
                  type="text"
                  class="w-full rounded border border-gray-300 px-3 py-2 text-text focus:border-primary focus:outline-none"
                >
              </div>
              <div v-if="tournament?.type === 'COMBINATION'" class="w-32">
                <label class="mb-1 block text-sm font-medium text-text">{{ nl.admin.pools.teamsAdvancing }}</label>
                <input
                  v-model.number="poolEditTeamsAdvancing"
                  type="number"
                  min="1"
                  class="w-full rounded border border-gray-300 px-3 py-2 text-text focus:border-primary focus:outline-none"
                >
              </div>
            </div>

            <p class="mb-2 text-sm font-medium text-text">
              {{ nl.admin.pools.assignTeams }}
            </p>
            <div class="mb-3 flex flex-wrap gap-2">
              <button
                v-for="team in allTeams"
                :key="team.id"
                :disabled="isTeamDisabled(team.id)"
                :class="[
                  editingSelectedTeamIds.includes(team.id)
                    ? 'bg-primary text-white'
                    : isTeamDisabled(team.id)
                      ? 'cursor-not-allowed bg-gray-100 text-gray-400'
                      : 'bg-white text-text hover:bg-gray-50 border-gray-300',
                  'rounded border px-3 py-1 text-sm font-medium transition-colors'
                ]"
                @click="toggleTeam(team.id)"
              >
                {{ team.name }}
              </button>
            </div>

            <p v-if="assignError" class="mb-2 text-sm text-error">
              {{ assignError }}
            </p>
            <p v-if="assignSuccess" class="mb-2 text-sm text-success">
              {{ assignSuccess }}
            </p>

            <div class="flex gap-2">
              <button
                :disabled="assignLoading"
                class="rounded bg-success px-4 py-2 text-sm font-medium text-white hover:opacity-80 disabled:opacity-50"
                @click="saveAssignment"
              >
                {{ nl.admin.pools.saveAssignment }}
              </button>
              <button
                class="rounded bg-secondary px-4 py-2 text-sm font-medium text-white hover:opacity-80"
                @click="cancelAssign"
              >
                {{ nl.common.cancel }}
              </button>
            </div>
          </template>

          <!-- Pool view -->
          <template v-else>
            <div class="flex items-start justify-between">
              <div>
                <p class="font-semibold text-text">{{ pool.name }}</p>
                <p v-if="tournament?.type === 'COMBINATION'" class="text-sm text-text-light">
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
                  @click="startAssign(pool)"
                >
                  {{ nl.admin.pools.assignTeams }}
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
    </template>
  </main>
</template>

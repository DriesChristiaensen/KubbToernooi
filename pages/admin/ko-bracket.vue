<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { nl } from "~/i18n/nl";

definePageMeta({ middleware: "auth" });

interface Team {
  id: number;
  name: string;
}

interface KoMatch {
  id: number;
  round: number;
  status: string;
  teamAId: number;
  teamBId: number;
  teamA: Team;
  teamB: Team;
  field: { id: number; name: string };
}

const matches = ref<KoMatch[]>([]);
const generateLoading = ref(false);
const generateError = ref("");
const generateSuccess = ref("");
const showOverwrite = ref(false);

const swapMatchId = ref<number | null>(null);
const swapTeamAId = ref<number>(0);
const swapTeamBId = ref<number>(0);
const swapError = ref("");
const swapSuccess = ref("");

async function fetchMatches() {
  try {
    matches.value = await $fetch<KoMatch[]>("/api/admin/ko-bracket/matches");
  } catch {
    // no matches yet is fine
    matches.value = [];
  }
}

async function generate(overwrite = false) {
  generateError.value = "";
  generateSuccess.value = "";
  generateLoading.value = true;
  try {
    const result = await $fetch<{ generated: number }>("/api/admin/ko-bracket/generate", {
      method: "POST",
      body: overwrite ? { overwrite: true } : {},
    });
    generateSuccess.value = `${result.generated} ${nl.admin.koBracket.generated}`;
    showOverwrite.value = false;
    await fetchMatches();
  } catch (err: unknown) {
    const fetchErr = err as { data?: { data?: { error?: string; code?: number } } };
    if (fetchErr?.data?.data?.code === 409) {
      showOverwrite.value = true;
      generateError.value = nl.admin.koBracket.existingWarning;
    } else {
      generateError.value = fetchErr?.data?.data?.error || nl.common.error;
    }
  } finally {
    generateLoading.value = false;
  }
}

function startSwap(match: KoMatch) {
  swapMatchId.value = match.id;
  swapTeamAId.value = match.teamAId;
  swapTeamBId.value = match.teamBId;
  swapError.value = "";
  swapSuccess.value = "";
}

async function saveSwap() {
  if (!swapMatchId.value) return;
  swapError.value = "";
  try {
    await $fetch(`/api/admin/ko-bracket/matches/${swapMatchId.value}` as string, {
      method: "PATCH",
      body: { teamAId: swapTeamAId.value, teamBId: swapTeamBId.value },
    });
    swapSuccess.value = nl.common.save;
    swapMatchId.value = null;
    await fetchMatches();
  } catch (err: unknown) {
    const fetchErr = err as { data?: { data?: { error?: string } } };
    swapError.value = fetchErr?.data?.data?.error || nl.common.error;
  }
}

const rounds = computed(() => {
  const map = new Map<number, KoMatch[]>();
  for (const m of matches.value) {
    if (!map.has(m.round)) map.set(m.round, []);
    map.get(m.round)!.push(m);
  }
  return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
});

const allTeams = computed(() => {
  const seen = new Set<number>();
  const result: Team[] = [];
  for (const m of matches.value) {
    if (!seen.has(m.teamA.id)) { seen.add(m.teamA.id); result.push(m.teamA); }
    if (!seen.has(m.teamB.id)) { seen.add(m.teamB.id); result.push(m.teamB); }
  }
  return result;
});

onMounted(fetchMatches);
</script>

<template>
  <div class="min-h-screen bg-background">
    <header class="flex items-center justify-between bg-primary-dark p-4">
      <h1 class="text-lg font-bold text-white">
        {{ nl.admin.koBracket.title }}
      </h1>
      <NuxtLink
        to="/admin"
        class="rounded bg-white/20 px-3 py-1 text-sm text-white hover:bg-white/30"
      >
        {{ nl.common.back }}
      </NuxtLink>
    </header>

    <main class="mx-auto max-w-content p-4">
      <div class="mb-6 rounded-lg border border-gray-200 bg-surface p-4 shadow-sm">
        <p v-if="generateError" class="mb-2 text-sm text-error">
          {{ generateError }}
        </p>
        <p v-if="generateSuccess" class="mb-2 text-sm text-success">
          {{ generateSuccess }}
        </p>

        <div v-if="showOverwrite" class="mb-3 flex gap-2">
          <button
            :disabled="generateLoading"
            class="rounded bg-error px-4 py-2 font-medium text-white hover:bg-red-700 disabled:opacity-50"
            @click="generate(true)"
          >
            {{ nl.common.confirm }}
          </button>
          <button
            class="rounded border border-gray-300 px-4 py-2 text-text hover:bg-gray-100"
            @click="showOverwrite = false; generateError = ''"
          >
            {{ nl.common.cancel }}
          </button>
        </div>

        <button
          v-else
          :disabled="generateLoading"
          class="rounded bg-primary px-4 py-2 font-medium text-white hover:bg-primary-dark disabled:opacity-50"
          @click="generate()"
        >
          {{ nl.admin.koBracket.generate }}
        </button>
      </div>

      <div v-if="swapMatchId" class="mb-6 rounded-lg border border-gray-200 bg-surface p-4 shadow-sm">
        <h2 class="mb-3 font-semibold text-text">
          {{ nl.admin.koBracket.swapTeams }}
        </h2>
        <p v-if="swapError" class="mb-2 text-sm text-error">
          {{ swapError }}
        </p>
        <div class="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div>
            <label class="mb-1 block text-sm text-text-light">{{ nl.ref.matches.scoreA }}</label>
            <select
              v-model="swapTeamAId"
              class="rounded border border-gray-300 px-3 py-2 text-text focus:border-primary focus:outline-none"
            >
              <option v-for="team in allTeams" :key="team.id" :value="team.id">
                {{ team.name }}
              </option>
            </select>
          </div>
          <div>
            <label class="mb-1 block text-sm text-text-light">{{ nl.ref.matches.scoreB }}</label>
            <select
              v-model="swapTeamBId"
              class="rounded border border-gray-300 px-3 py-2 text-text focus:border-primary focus:outline-none"
            >
              <option v-for="team in allTeams" :key="team.id" :value="team.id">
                {{ team.name }}
              </option>
            </select>
          </div>
          <div class="flex gap-2">
            <button
              class="rounded bg-primary px-4 py-2 font-medium text-white hover:bg-primary-dark"
              @click="saveSwap"
            >
              {{ nl.admin.schedule.saveMatch }}
            </button>
            <button
              class="rounded border border-gray-300 px-4 py-2 text-text hover:bg-gray-100"
              @click="swapMatchId = null"
            >
              {{ nl.common.cancel }}
            </button>
          </div>
        </div>
      </div>

      <div v-if="rounds.length === 0" class="text-center text-text-light">
        {{ nl.common.noResults }}
      </div>

      <div v-for="[round, roundMatches] in rounds" :key="round" class="mb-6">
        <h2 class="mb-3 font-semibold text-text">
          {{ nl.admin.koBracket.round }} {{ round }}
        </h2>
        <div class="overflow-x-auto">
          <table class="w-full border-collapse rounded-lg border border-gray-200 bg-surface shadow-sm">
            <thead class="bg-primary text-white">
              <tr>
                <th class="px-4 py-2 text-left text-sm">{{ nl.ref.matches.scoreA }}</th>
                <th class="px-4 py-2 text-center text-sm">vs</th>
                <th class="px-4 py-2 text-left text-sm">{{ nl.ref.matches.scoreB }}</th>
                <th class="px-4 py-2 text-left text-sm">{{ nl.admin.schedule.fieldLabel }}</th>
                <th class="px-4 py-2 text-sm" />
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="match in roundMatches"
                :key="match.id"
                class="border-t border-gray-100 hover:bg-gray-50"
              >
                <td class="px-4 py-2 text-text">
                  {{ match.teamA.name }}
                </td>
                <td class="px-4 py-2 text-center text-text-light">vs</td>
                <td class="px-4 py-2 text-text">
                  {{ match.teamB.name }}
                </td>
                <td class="px-4 py-2 text-sm text-text-light">
                  {{ match.field.name }}
                </td>
                <td class="px-4 py-2 text-right">
                  <button
                    v-if="match.status !== 'PLAYED'"
                    class="text-sm text-primary hover:underline"
                    @click="startSwap(match)"
                  >
                    {{ nl.admin.koBracket.swapTeams }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </main>
  </div>
</template>

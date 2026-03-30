<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { VueDatePicker } from "@vuepic/vue-datepicker";
import { nlBE } from "date-fns/locale";
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
  teamAId: number | null;
  teamBId: number | null;
  teamA: Team | null;
  teamB: Team | null;
  nextMatchId: number | null;
  field: { id: number; name: string };
}

const matches = ref<KoMatch[]>([]);
const generateLoading = ref(false);
const generateError = ref("");
const generateSuccess = ref("");
const generateStartDateTime = ref<Date | null>(null);
const showOverwrite = ref(false);
const tournamentType = ref("");
const lastPoolMatchTime = ref<string | null>(null);

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
  if (!generateStartDateTime.value) {
    generateError.value = nl.admin.koBracket.startDateTimeRequired;
    return;
  }
  if (
    tournamentType.value === "COMBINATION" &&
    lastPoolMatchTime.value &&
    generateStartDateTime.value <= new Date(lastPoolMatchTime.value)
  ) {
    generateError.value = nl.admin.koBracket.koStartAfterPool;
    return;
  }
  generateLoading.value = true;
  try {
    const result = await $fetch<{ generated: number }>(
      "/api/admin/ko-bracket/generate",
      {
        method: "POST",
        body: {
          overwrite,
          startDateTime: generateStartDateTime.value.toISOString(),
        },
      },
    );
    generateSuccess.value = `${result.generated} ${nl.admin.koBracket.generated}`;
    showOverwrite.value = false;
    await fetchMatches();
  } catch (err: unknown) {
    const fetchErr = err as {
      data?: { data?: { error?: string; code?: number } };
    };
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
  swapTeamAId.value = match.teamAId ?? 0;
  swapTeamBId.value = match.teamBId ?? 0;
  swapError.value = "";
  swapSuccess.value = "";
}

async function saveSwap() {
  if (!swapMatchId.value) return;
  swapError.value = "";
  try {
    await $fetch(
      `/api/admin/ko-bracket/matches/${swapMatchId.value}` as string,
      {
        method: "PATCH",
        body: { teamAId: swapTeamAId.value, teamBId: swapTeamBId.value },
      },
    );
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

const matchesByRound = computed(() => {
  const map = new Map<number, KoMatch[]>();
  for (const [r, ms] of rounds.value) map.set(r, ms);
  return map;
});

const round1Count = computed(() => matchesByRound.value.get(1)?.length ?? 0);

const totalRounds = computed(() => {
  const c = round1Count.value;
  return c > 0 ? Math.ceil(Math.log2(c)) + 1 : 0;
});

function getMatch(r: number, idx: number): KoMatch | undefined {
  return (matchesByRound.value.get(r) ?? [])[idx - 1];
}

function matchCount(r: number): number {
  return Math.ceil(round1Count.value / Math.pow(2, r - 1));
}

function spanCount(r: number): number {
  return Math.pow(2, r - 1);
}

const allTeams = computed(() => {
  const seen = new Set<number>();
  const result: Team[] = [];
  for (const m of matches.value) {
    if (m.teamA && !seen.has(m.teamA.id)) {
      seen.add(m.teamA.id);
      result.push(m.teamA);
    }
    if (m.teamB && !seen.has(m.teamB.id)) {
      seen.add(m.teamB.id);
      result.push(m.teamB);
    }
  }
  return result;
});

const swapSuggestedTeams = computed(() => {
  if (!swapMatchId.value) return [];
  const seen = new Set<number>();
  const result: Team[] = [];
  for (const m of matches.value.filter((m) => m.nextMatchId === swapMatchId.value)) {
    if (m.teamA && !seen.has(m.teamA.id)) { seen.add(m.teamA.id); result.push(m.teamA); }
    if (m.teamB && !seen.has(m.teamB.id)) { seen.add(m.teamB.id); result.push(m.teamB); }
  }
  return result;
});

const swapOtherTeams = computed(() => {
  const suggested = new Set(swapSuggestedTeams.value.map((t) => t.id));
  return allTeams.value.filter((t) => !suggested.has(t.id));
});

onMounted(async () => {
  await fetchMatches();
  try {
    const t = await $fetch<{ type: string }>("/api/admin/tournament");
    tournamentType.value = t.type;
    if (t.type === "COMBINATION") {
      const poolMatches = await $fetch<{ startTime: string; phase: string }[]>(
        "/api/admin/schedule/matches",
      );
      const poolTimes = poolMatches
        .filter((m) => m.phase === "POOL")
        .map((m) => m.startTime);
      if (poolTimes.length > 0) {
        lastPoolMatchTime.value = poolTimes.sort().at(-1)!;
      }
    }
  } catch {
    // tournament fetch failing is non-critical
  }
});
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
      <div
        class="mb-6 rounded-lg border border-gray-200 bg-surface p-4 shadow-sm"
      >
        <div class="mb-4">
          <label
            class="mb-1 block text-sm font-medium text-text"
            for="ko-start"
          >
            {{ nl.admin.koBracket.startDateTime }}
          </label>
          <ClientOnly>
            <VueDatePicker
              v-model="generateStartDateTime"
              :formats="{ input: 'dd/MM/yyyy HH:mm' }"
              :enable-time-picker="true"
              :is24="true"
              auto-apply
              :locale="nlBE"
            />
          </ClientOnly>
        </div>

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
            @click="
              showOverwrite = false;
              generateError = '';
            "
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

      <div
        v-if="swapMatchId"
        class="mb-6 rounded-lg border border-gray-200 bg-surface p-4 shadow-sm"
      >
        <h2 class="mb-3 font-semibold text-text">
          {{ nl.admin.koBracket.swapTeams }}
        </h2>
        <p v-if="swapError" class="mb-2 text-sm text-error">
          {{ swapError }}
        </p>
        <div class="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div>
            <label class="mb-1 block text-sm text-text-light">{{
              nl.ref.matches.scoreA
            }}</label>
            <select
              v-model="swapTeamAId"
              class="rounded border border-gray-300 px-3 py-2 text-text focus:border-primary focus:outline-none"
            >
              <optgroup v-if="swapSuggestedTeams.length" :label="nl.admin.koBracket.suggestedTeams">
                <option v-for="team in swapSuggestedTeams" :key="team.id" :value="team.id">
                  {{ team.name }}
                </option>
              </optgroup>
              <optgroup v-if="swapOtherTeams.length" :label="nl.admin.koBracket.otherTeams">
                <option v-for="team in swapOtherTeams" :key="team.id" :value="team.id">
                  {{ team.name }}
                </option>
              </optgroup>
            </select>
          </div>
          <div>
            <label class="mb-1 block text-sm text-text-light">{{
              nl.ref.matches.scoreB
            }}</label>
            <select
              v-model="swapTeamBId"
              class="rounded border border-gray-300 px-3 py-2 text-text focus:border-primary focus:outline-none"
            >
              <optgroup v-if="swapSuggestedTeams.length" :label="nl.admin.koBracket.suggestedTeams">
                <option v-for="team in swapSuggestedTeams" :key="team.id" :value="team.id">
                  {{ team.name }}
                </option>
              </optgroup>
              <optgroup v-if="swapOtherTeams.length" :label="nl.admin.koBracket.otherTeams">
                <option v-for="team in swapOtherTeams" :key="team.id" :value="team.id">
                  {{ team.name }}
                </option>
              </optgroup>
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

      <div v-if="round1Count === 0" class="text-center text-text-light">
        {{ nl.common.noResults }}
      </div>

      <div
        v-else
        class="overflow-x-auto rounded-lg border border-gray-200 bg-surface p-4 shadow-sm"
      >
        <div
          :style="{
            display: 'grid',
            gridTemplateColumns: `repeat(${round1Count}, minmax(140px, 1fr))`,
            gap: '8px',
          }"
        >
          <template v-for="r in totalRounds" :key="`row-${r}`">
            <template v-for="idx in matchCount(r)" :key="`r${r}-m${idx}`">
              <div
                :style="{ gridRow: r, gridColumn: `span ${spanCount(r)}` }"
                class="flex flex-col rounded border border-gray-200 bg-background p-3"
              >
                <div class="mb-2 text-xs font-semibold text-text-light">
                  {{ nl.admin.koBracket.round }} {{ r }}
                </div>
                <template v-if="getMatch(r, idx)">
                  <span class="text-sm font-medium text-text">
                    {{
                      getMatch(r, idx)!.teamA?.name ?? nl.admin.koBracket.tbd
                    }}
                  </span>
                  <span class="my-1 text-center text-xs text-text-light"
                    >vs</span
                  >
                  <span class="text-sm font-medium text-text">
                    {{
                      getMatch(r, idx)!.teamB?.name ?? nl.admin.koBracket.tbd
                    }}
                  </span>
                  <div class="mt-2 text-xs text-text-light">
                    {{ getMatch(r, idx)!.field.name }}
                  </div>
                  <div class="mt-1 text-right">
                    <button
                      v-if="getMatch(r, idx)!.status !== 'PLAYED'"
                      class="text-xs text-primary hover:underline"
                      @click="startSwap(getMatch(r, idx)!)"
                    >
                      {{ nl.admin.koBracket.swapTeams }}
                    </button>
                  </div>
                </template>
                <template v-else>
                  <div
                    class="flex grow items-center justify-center text-sm text-text-light"
                  >
                    {{ nl.admin.koBracket.tbd }}
                  </div>
                </template>
              </div>
            </template>
          </template>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { VueDatePicker } from "@vuepic/vue-datepicker";
import { nlBE } from "date-fns/locale";
import { nl } from "~/i18n/nl";

definePageMeta({
  middleware: ["auth", "admin-tournament-guard"],
  layout: "admin",
});

interface Team {
  id: string;
  name: string;
}

interface Tournament {
  type: string;
  status: string;
  koScheduleLive: boolean;
}

interface KoMatch {
  id: string;
  round: number;
  status: string;
  startTime: string;
  scoreA: number | null;
  scoreB: number | null;
  teamAId: string | null;
  teamBId: string | null;
  teamA: Team | null;
  teamB: Team | null;
  nextMatchId: string | null;
  bracketPosition: number | null;
  field: { id: string; name: string };
}

const matches = ref<KoMatch[]>([]);
const generateLoading = ref(false);
const generateError = ref("");
const generateSuccess = ref("");
const generateStartDateTime = ref<Date | null>(null);
const showOverwrite = ref(false);
const tournament = ref<Tournament | null>(null);
const tournamentType = ref("");
const lastPoolMatchTime = ref<string | null>(null);

const phaseToggleLoading = ref(false);
const phaseToggleError = ref("");
const showDraftWarning = ref(false);

const fillTeamsLoading = ref(false);
const fillTeamsError = ref("");
const fillTeamsSuccess = ref("");
const showFillTeamsConfirm = ref(false);

const rankedTournamentTeams = ref<Team[]>([]);
const allTeams = ref<Team[]>([]);
const allPoolMatchesPlayed = ref(true);

interface Field {
  id: string;
  name: string;
}
const allFields = ref<Field[]>([]);

const editMatchId = ref<string | null>(null);
const editStartTime = ref<Date | null>(null);
const editFieldId = ref<string>("");
const editTeamAId = ref<string>("");
const editTeamBId = ref<string>("");
const editError = ref("");
const editSaving = ref(false);
const editSuccess = ref("");

const hasStructure = computed(() => matches.value.length > 0);
const hasTeams = computed(() =>
  matches.value.some((m) => m.teamAId !== null || m.teamBId !== null),
);

function getRoundLabel(matchCount: number): string {
  const labels = nl.admin.koBracket.roundLabels;
  if (matchCount === 1) return labels.final;
  if (matchCount === 2) return labels.semifinal;
  if (matchCount === 4) return labels.quarterfinal;
  if (matchCount === 8) return labels.r8;
  if (matchCount === 16) return labels.r16;
  return nl.public.schedule.finaleFormat.replace("{count}", String(matchCount));
}

async function fetchMatches() {
  try {
    matches.value = await $fetch<KoMatch[]>("/api/admin/ko-bracket/matches");
  } catch {
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
    await refreshNuxtData("admin-status-banner");
  } catch (err: unknown) {
    const fetchErr = err as {
      data?: { data?: { error?: string; code?: number } };
    };
    showOverwrite.value = true;
    if (fetchErr?.data?.data?.code === 409) {
      generateError.value = nl.admin.koBracket.existingWarning;
    } else {
      generateError.value = fetchErr?.data?.data?.error || nl.common.error;
    }
  } finally {
    generateLoading.value = false;
  }
}

function requestFillTeams() {
  if (hasTeams.value) {
    showFillTeamsConfirm.value = true;
  } else {
    fillTeams();
  }
}

async function fillTeams() {
  showFillTeamsConfirm.value = false;
  fillTeamsError.value = "";
  fillTeamsSuccess.value = "";
  fillTeamsLoading.value = true;
  try {
    await $fetch("/api/admin/ko-bracket/fill-teams", { method: "POST" });
    fillTeamsSuccess.value = nl.admin.koBracket.fillTeamsSuccess;
    await fetchMatches();
  } catch (err: unknown) {
    const fetchErr = err as { data?: { data?: { error?: string } } };
    fillTeamsError.value = fetchErr?.data?.data?.error || nl.common.error;
  } finally {
    fillTeamsLoading.value = false;
  }
}


function startEdit(match: KoMatch) {
  editMatchId.value = match.id;
  editStartTime.value = new Date(match.startTime);
  editFieldId.value = match.field.id;
  editTeamAId.value = match.teamAId ?? "";
  editTeamBId.value = match.teamBId ?? "";
  editError.value = "";
  editSuccess.value = "";
}

async function saveEdit() {
  if (!editMatchId.value) return;
  editError.value = "";
  editSaving.value = true;
  try {
    await $fetch(`/api/admin/ko-bracket/matches/${editMatchId.value}`, {
      method: "PATCH",
      body: {
        startTime: editStartTime.value?.toISOString(),
        fieldId: editFieldId.value || undefined,
        teamAId: editTeamAId.value || undefined,
        teamBId: editTeamBId.value || undefined,
      },
    });
    editSuccess.value = nl.admin.koBracket.matchSaved;
    editMatchId.value = null;
    await fetchMatches();
  } catch (err: unknown) {
    const fetchErr = err as { data?: { data?: { error?: string } } };
    editError.value = fetchErr?.data?.data?.error || nl.common.error;
  } finally {
    editSaving.value = false;
  }
}


async function toggleKoPhase() {
  if (!tournament.value) return;
  const newVal = !tournament.value.koScheduleLive;
  if (newVal && !hasTeams.value) {
    phaseToggleError.value = nl.admin.koBracket.noTeamsLive;
    return;
  }
  if (!newVal) {
    const now = Date.now();
    const hasStarted = matches.value.some(
      (m) =>
        m.scoreA !== null ||
        m.scoreB !== null ||
        new Date(m.startTime).getTime() < now,
    );
    if (hasStarted) {
      showDraftWarning.value = true;
      return;
    }
  }
  await executeDraftToggle(newVal);
}

async function executeDraftToggle(newVal: boolean) {
  if (!tournament.value) return;
  phaseToggleError.value = "";
  phaseToggleLoading.value = true;
  try {
    await $fetch("/api/admin/tournament", {
      method: "PATCH",
      body: { koScheduleLive: newVal },
    });
    tournament.value.koScheduleLive = newVal;
    await refreshNuxtData("admin-status-banner");
  } catch (err: unknown) {
    const fetchErr = err as { data?: { data?: { error?: string } } };
    phaseToggleError.value = fetchErr?.data?.data?.error || nl.common.error;
  } finally {
    phaseToggleLoading.value = false;
  }
}

function confirmDraftToggle() {
  showDraftWarning.value = false;
  executeDraftToggle(false);
}

function cancelDraftToggle() {
  showDraftWarning.value = false;
}

const rounds = computed(() => {
  const map = new Map<number, KoMatch[]>();
  for (const m of matches.value) {
    if (!map.has(m.round)) map.set(m.round, []);
    // Safe: Entry guaranteed to exist from has check or set call above
    map.get(m.round)!.push(m);
  }
  for (const ms of map.values()) {
    ms.sort((a, b) => (a.bracketPosition ?? 0) - (b.bracketPosition ?? 0));
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

const swapNonKoTeams = computed(() => {
  const rankedIds = new Set(rankedTournamentTeams.value.map((t) => t.id));
  return allTeams.value.filter((t) => !rankedIds.has(t.id));
});

onMounted(async () => {
  await fetchMatches();
  try {
    const t = await $fetch<Tournament>("/api/admin/tournament");
    tournamentType.value = t.type;
    tournament.value = t;
    if (t.type === "COMBINATION") {
      const poolMatches = await $fetch<{ startTime: string; phase: string; status: string }[]>(
        "/api/admin/schedule/matches",
      );
      const onlyPool = poolMatches.filter((m) => m.phase === "POOL");
      const poolTimes = onlyPool.map((m) => m.startTime);
      if (poolTimes.length > 0) {
        // Safe: poolTimes.length > 0 ensures array has at least one element
        lastPoolMatchTime.value = poolTimes.sort().at(-1)!;
      }
      allPoolMatchesPlayed.value = onlyPool.length > 0 && onlyPool.every((m) => m.status === "PLAYED");
    }
  } catch {
    // tournament fetch failing is non-critical
  }
  try {
    const pools = await $fetch<
      { teamsAdvancing: number; standings: { team: Team }[] }[]
    >("/api/public/standings");
    if (pools.length > 0) {
      const seen = new Set<string>();
      const ranked: Team[] = [];
      for (const pool of pools) {
        for (const s of pool.standings.slice(0, pool.teamsAdvancing)) {
          if (!seen.has(s.team.id)) {
            seen.add(s.team.id);
            ranked.push(s.team);
          }
        }
      }
      rankedTournamentTeams.value = ranked;
    }
  } catch {
    // standings fetch failing is non-critical
  }
  try {
    const teams = await $fetch<Team[]>("/api/admin/teams");
    allTeams.value = [...teams].sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    // allTeams fetch failing is non-critical
  }
  try {
    allFields.value = await $fetch<Field[]>("/api/admin/fields");
  } catch {
    // fields fetch failing is non-critical
  }
});
</script>

<template>
  <main class="mx-auto max-w-content p-4">
    <!-- Fill teams overwrite confirmation modal -->
    <div
      v-if="showFillTeamsConfirm"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
    >
      <div class="mx-4 max-w-md rounded-lg bg-surface p-6 shadow-xl">
        <p class="mb-4 text-text">{{ nl.admin.koBracket.fillTeamsOverwriteWarning }}</p>
        <div class="flex gap-3">
          <button
            class="rounded bg-error px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            @click="fillTeams"
          >
            {{ nl.common.confirm }}
          </button>
          <button
            class="rounded bg-secondary px-4 py-2 text-sm font-medium text-white hover:opacity-80"
            @click="showFillTeamsConfirm = false"
          >
            {{ nl.common.cancel }}
          </button>
        </div>
      </div>
    </div>
    <!-- Draft warning modal -->
    <div
      v-if="showDraftWarning"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
    >
      <div class="mx-4 max-w-md rounded-lg bg-surface p-6 shadow-xl">
        <p class="mb-4 text-text">{{ nl.admin.koBracket.draftWarning }}</p>
        <div class="flex gap-3">
          <button
            class="rounded bg-error px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            @click="confirmDraftToggle"
          >
            {{ nl.common.confirm }}
          </button>
          <button
            class="rounded bg-secondary px-4 py-2 text-sm font-medium text-white hover:opacity-80"
            @click="cancelDraftToggle"
          >
            {{ nl.common.cancel }}
          </button>
        </div>
      </div>
    </div>
    <!-- Edit match modal -->
    <div
      v-if="editMatchId"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
    >
      <div class="mx-4 w-full max-w-md rounded-lg bg-surface p-6 shadow-xl">
        <h2 class="mb-4 font-semibold text-text">{{ nl.admin.koBracket.editMatch }}</h2>
        <p v-if="editError" class="mb-3 text-sm text-error">{{ editError }}</p>
        <div class="flex flex-col gap-3">
          <div>
            <label class="mb-1 block text-sm font-medium text-text">{{ nl.admin.koBracket.timeLabel }}</label>
            <ClientOnly>
              <VueDatePicker
                v-model="editStartTime"
                :formats="{ input: 'dd/MM/yyyy HH:mm' }"
                :enable-time-picker="true"
                :is24="true"
                auto-apply
                :locale="nlBE"
              />
            </ClientOnly>
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium text-text">{{ nl.admin.koBracket.fieldLabel }}</label>
            <select
              v-model="editFieldId"
              class="w-full rounded border border-gray-300 px-3 py-2 text-text focus:border-primary focus:outline-none"
            >
              <option v-for="f in allFields" :key="f.id" :value="f.id">{{ f.name }}</option>
            </select>
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium text-text">{{ nl.ref.matches.scoreA }}</label>
            <select
              v-model="editTeamAId"
              class="w-full rounded border border-gray-300 px-3 py-2 text-text focus:border-primary focus:outline-none"
            >
              <option value="">{{ nl.admin.koBracket.tbd }}</option>
              <template v-if="tournamentType === 'KO'">
                <option v-for="team in allTeams" :key="team.id" :value="team.id">{{ team.name }}</option>
              </template>
              <template v-else>
                <optgroup v-if="rankedTournamentTeams.length" :label="nl.admin.koBracket.winningTeams">
                  <option v-for="team in rankedTournamentTeams" :key="team.id" :value="team.id">{{ team.name }}</option>
                </optgroup>
                <optgroup v-if="swapNonKoTeams.length" :label="nl.admin.koBracket.otherTeams">
                  <option v-for="team in swapNonKoTeams" :key="team.id" :value="team.id">{{ team.name }}</option>
                </optgroup>
              </template>
            </select>
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium text-text">{{ nl.ref.matches.scoreB }}</label>
            <select
              v-model="editTeamBId"
              class="w-full rounded border border-gray-300 px-3 py-2 text-text focus:border-primary focus:outline-none"
            >
              <option value="">{{ nl.admin.koBracket.tbd }}</option>
              <template v-if="tournamentType === 'KO'">
                <option v-for="team in allTeams" :key="team.id" :value="team.id">{{ team.name }}</option>
              </template>
              <template v-else>
                <optgroup v-if="rankedTournamentTeams.length" :label="nl.admin.koBracket.winningTeams">
                  <option v-for="team in rankedTournamentTeams" :key="team.id" :value="team.id">{{ team.name }}</option>
                </optgroup>
                <optgroup v-if="swapNonKoTeams.length" :label="nl.admin.koBracket.otherTeams">
                  <option v-for="team in swapNonKoTeams" :key="team.id" :value="team.id">{{ team.name }}</option>
                </optgroup>
              </template>
            </select>
          </div>
        </div>
        <div class="mt-4 flex gap-2">
          <button
            :disabled="editSaving"
            class="rounded bg-primary px-4 py-2 font-medium text-white hover:bg-primary-dark disabled:opacity-50"
            @click="saveEdit"
          >
            {{ nl.admin.koBracket.saveMatch }}
          </button>
          <button
            class="rounded border border-gray-300 px-4 py-2 text-text hover:bg-gray-100"
            @click="editMatchId = null"
          >
            {{ nl.common.cancel }}
          </button>
        </div>
      </div>
    </div>

    <div class="mb-4 flex items-center gap-3">
      <NuxtLink to="/admin" class="text-sm text-text-light hover:text-primary">
        &larr; {{ nl.common.back }}
      </NuxtLink>
      <h1 class="text-lg font-bold text-text">
        {{ nl.admin.koBracket.title }}
      </h1>
    </div>

    <!-- Step 1: Generate structure -->
    <div
      class="mb-6 rounded-lg border border-gray-200 bg-surface p-4 shadow-sm"
    >
      <h2 class="mb-3 font-semibold text-text">
        {{ nl.admin.koBracket.generateStep }}
      </h2>
      <div class="mb-4">
        <label class="mb-1 block text-sm font-medium text-text" for="ko-start">
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
        {{ hasStructure ? nl.admin.koBracket.newGenerate : nl.admin.koBracket.generate }}
      </button>
    </div>

    <!-- Step 2: Fill teams (only if structure exists and teams not yet filled) -->
    <div
      v-if="hasStructure && !hasTeams"
      class="mb-6 rounded-lg border border-gray-200 bg-surface p-4 shadow-sm"
    >
      <h2 class="mb-3 font-semibold text-text">
        {{ nl.admin.koBracket.fillTeamsStep }}
      </h2>
      <p v-if="fillTeamsError" class="mb-2 text-sm text-error">
        {{ fillTeamsError }}
      </p>
      <p v-if="fillTeamsSuccess" class="mb-2 text-sm text-success">
        {{ fillTeamsSuccess }}
      </p>
      <div class="group relative inline-block">
        <button
          :disabled="fillTeamsLoading || (tournamentType === 'COMBINATION' && !allPoolMatchesPlayed)"
          class="rounded bg-success px-4 py-2 font-medium text-white hover:opacity-80 disabled:opacity-50"
          @click="requestFillTeams"
        >
          {{ nl.admin.koBracket.fillTeams }}
        </button>
        <div
          v-if="tournamentType === 'COMBINATION' && !allPoolMatchesPlayed"
          class="invisible absolute bottom-full left-0 z-10 mb-1 w-max max-w-xs rounded bg-gray-800 px-2 py-1 text-xs text-white group-hover:visible"
        >
          {{ nl.admin.koBracket.poolMatchesNotPlayed }}
        </div>
      </div>
    </div>

    <!-- Publish KO bracket -->
    <div
      v-if="tournament && hasStructure"
      class="mb-6 rounded-lg border border-gray-200 bg-surface p-4 shadow-sm"
    >
      <h2 class="mb-3 font-semibold text-text">
        {{ nl.admin.koBracket.statusSection }}
      </h2>
      <button
        :disabled="phaseToggleLoading || tournament.status === 'DRAFT'"
        :class="tournament.koScheduleLive ? 'bg-success' : 'bg-warning'"
        class="rounded px-4 py-2 text-sm font-medium text-white hover:opacity-80 disabled:opacity-50"
        @click="toggleKoPhase"
      >
        {{
          tournament.koScheduleLive
            ? nl.admin.koBracket.koScheduleLive
            : nl.admin.koBracket.koScheduleDraft
        }}
      </button>
      <p v-if="phaseToggleError" class="mt-2 text-sm text-error">
        {{ phaseToggleError }}
      </p>
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
              <div class="mb-2 text-xs font-semibold text-primary">
                {{ getRoundLabel(matchCount(r)) }}
              </div>
              <template v-if="getMatch(r, idx)">
                <span class="text-sm font-medium text-text">
                  {{ getMatch(r, idx)!.teamA?.name ?? nl.admin.koBracket.tbd }}
                </span>
                <template
                  v-if="
                    getMatch(r, idx)!.teamAId !== null &&
                    getMatch(r, idx)!.teamBId === null
                  "
                >
                  <span
                    class="my-1 rounded bg-primary/10 px-2 py-0.5 text-center text-xs font-medium text-primary"
                  >
                    {{ nl.admin.koBracket.bye }}
                  </span>
                </template>
                <template v-else>
                  <span class="my-1 text-center text-xs text-text-light"
                    >vs</span
                  >
                  <span class="text-sm font-medium text-text">
                    {{
                      getMatch(r, idx)!.teamB?.name ?? nl.admin.koBracket.tbd
                    }}
                  </span>
                </template>
                <div class="mt-2 text-xs text-text-light">
                  {{ getMatch(r, idx)!.field.name }}
                </div>
                <div class="mt-1 text-xs text-text-light">
                  {{ new Date(getMatch(r, idx)!.startTime).toLocaleString("nl-BE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) }}
                </div>
                <div class="mt-1 text-right">
                  <button
                    v-if="getMatch(r, idx)!.status !== 'PLAYED'"
                    class="text-xs text-primary hover:underline"
                    @click="startEdit(getMatch(r, idx)!)"
                  >
                    {{ nl.admin.koBracket.editMatch }}
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
</template>

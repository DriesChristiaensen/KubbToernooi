<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
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
  bKoScheduleLive: boolean;
  hasBKnockout: boolean;
  qualifyGlobally: boolean;
  globalQualifyingTeams: number;
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

const globalQualifyingTeams = ref<number>(8);
const globalQtSaving = ref(false);
const globalQtError = ref("");
const globalQtSuccess = ref("");
const showFillTeamsConfirm = ref(false);

const rankedTournamentTeams = ref<Team[]>([]);
const allTeams = ref<Team[]>([]);
const allPoolMatchesPlayed = ref(true);

// Active bracket: "A" = main KO, "B" = B-finale
const activeBracket = ref<"A" | "B">("A");

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

const activeBracketIsLive = computed(() => {
  if (!tournament.value) return false;
  return activeBracket.value === "A" ? tournament.value.koScheduleLive : tournament.value.bKoScheduleLive;
});

const showBracketSwitcher = computed(
  () => tournament.value?.hasBKnockout && tournament.value.type === "COMBINATION",
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
    matches.value = await $fetch<KoMatch[]>(
      `/api/admin/ko-bracket/matches?bracket=${activeBracket.value}`,
    );
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
          bracket: activeBracket.value,
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
    await $fetch("/api/admin/ko-bracket/fill-teams", {
      method: "POST",
      body: { bracket: activeBracket.value },
    });
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
  const isByeMatch = match.status === "PLAYED";
  editTeamAId.value = match.teamAId ?? (isByeMatch ? "BYE" : "");
  editTeamBId.value = match.teamBId ?? (isByeMatch ? "BYE" : "");
  editError.value = "";
  editSuccess.value = "";
}

async function saveEdit() {
  if (!editMatchId.value) return;
  editError.value = "";
  editSaving.value = true;
  try {
    const isByeA = editTeamAId.value === "BYE";
    const isByeB = editTeamBId.value === "BYE";
    await $fetch(`/api/admin/ko-bracket/matches/${editMatchId.value}`, {
      method: "PATCH",
      body: {
        startTime: editStartTime.value?.toISOString(),
        fieldId: editFieldId.value || undefined,
        teamAId: isByeA ? null : (editTeamAId.value || null),
        teamBId: isByeB ? null : (editTeamBId.value || null),
        isByeA,
        isByeB,
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
  const isB = activeBracket.value === "B";
  const currentLive = isB ? tournament.value.bKoScheduleLive : tournament.value.koScheduleLive;
  const newVal = !currentLive;
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
  const isB = activeBracket.value === "B";
  phaseToggleError.value = "";
  phaseToggleLoading.value = true;
  try {
    await $fetch("/api/admin/tournament", {
      method: "PATCH",
      body: isB ? { bKoScheduleLive: newVal } : { koScheduleLive: newVal },
    });
    if (isB) {
      tournament.value.bKoScheduleLive = newVal;
    } else {
      tournament.value.koScheduleLive = newVal;
    }
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

async function saveGlobalQualifyingTeams() {
  globalQtError.value = "";
  globalQtSuccess.value = "";
  globalQtSaving.value = true;
  try {
    await $fetch("/api/admin/tournament", {
      method: "PATCH",
      body: { globalQualifyingTeams: globalQualifyingTeams.value },
    });
    if (tournament.value) tournament.value.globalQualifyingTeams = globalQualifyingTeams.value;
    globalQtSuccess.value = nl.admin.koBracket.globalQualifyingTeamsSaved;
  } catch (err: unknown) {
    const fetchErr = err as { data?: { data?: { error?: string } } };
    globalQtError.value = fetchErr?.data?.data?.error || nl.common.error;
  } finally {
    globalQtSaving.value = false;
  }
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

// Reset bracket-specific state when switching brackets
watch(activeBracket, async () => {
  generateError.value = "";
  generateSuccess.value = "";
  fillTeamsError.value = "";
  fillTeamsSuccess.value = "";
  phaseToggleError.value = "";
  showOverwrite.value = false;
  showFillTeamsConfirm.value = false;
  await fetchMatches();
});

onMounted(async () => {
  await fetchMatches();
  try {
    const t = await $fetch<Tournament>("/api/admin/tournament");
    tournamentType.value = t.type;
    tournament.value = t;
    globalQualifyingTeams.value = t.globalQualifyingTeams;
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
        <p class="mb-4 text-text">
          {{ activeBracket === "B" ? nl.admin.koBracket.bDraftWarning : nl.admin.koBracket.draftWarning }}
        </p>
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
              <option value="BYE">{{ nl.admin.koBracket.bye }}</option>
              <template v-if="tournamentType === 'KO' || activeBracket === 'B'">
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
              <option value="BYE">{{ nl.admin.koBracket.bye }}</option>
              <template v-if="tournamentType === 'KO' || activeBracket === 'B'">
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
          <div class="group relative">
            <button
              :disabled="editSaving"
              class="rounded bg-primary px-4 py-2 font-medium text-white hover:bg-primary-dark disabled:opacity-50"
              @click="saveEdit"
            >
              {{ nl.admin.koBracket.saveMatch }}
            </button>
            <div v-if="editSaving" class="invisible absolute bottom-full left-1/2 z-10 mb-1 w-max max-w-xs -translate-x-1/2 rounded bg-gray-800 px-2 py-1 text-xs text-white group-hover:visible">
              {{ nl.common.saving }}
            </div>
          </div>
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

    <!-- Bracket switcher button group -->
    <div v-if="showBracketSwitcher" class="mb-6 inline-flex overflow-hidden rounded border border-gray-300">
      <div class="group relative">
        <button
          :class="activeBracket === 'A' ? 'bg-primary text-white' : 'bg-white text-text hover:bg-gray-50'"
          class="flex items-center gap-1.5 border-r border-gray-300 px-4 py-2 text-sm font-medium"
          @click="activeBracket = 'A'"
        >
          {{ nl.admin.koBracket.bracketA }}
          <!-- Warning: B is live but A is not -->
          <span
            v-if="tournament?.bKoScheduleLive && !tournament?.koScheduleLive"
            class="text-warning"
            title="{{ nl.admin.koBracket.bracketWarning }}"
          >⚠</span>
        </button>
      </div>
      <div class="group relative">
        <button
          :class="activeBracket === 'B' ? 'bg-primary text-white' : 'bg-white text-text hover:bg-gray-50'"
          class="flex items-center gap-1.5 px-4 py-2 text-sm font-medium"
          @click="activeBracket = 'B'"
        >
          {{ nl.admin.koBracket.bracketB }}
          <!-- Warning: A is live but B is not -->
          <span
            v-if="tournament?.koScheduleLive && !tournament?.bKoScheduleLive"
            class="text-warning"
            title="{{ nl.admin.koBracket.bracketWarning }}"
          >⚠</span>
        </button>
      </div>
    </div>

    <!-- Step 1: Generate structure -->
    <div
      class="mb-6 rounded-lg border border-gray-200 bg-surface p-4 shadow-sm"
    >
      <h2 class="mb-3 font-semibold text-text">
        {{ nl.admin.koBracket.generateStep }}
      </h2>
      <!-- Global qualifying teams (only for COMBINATION + qualifyGlobally + A bracket) -->
      <div v-if="tournament?.qualifyGlobally && tournamentType === 'COMBINATION' && activeBracket === 'A'" class="mb-4">
        <label class="mb-1 block text-sm font-medium text-text">
          {{ nl.admin.koBracket.globalQualifyingTeams }}
        </label>
        <div class="flex items-center gap-2">
          <input
            v-model.number="globalQualifyingTeams"
            type="number"
            min="2"
            class="w-24 rounded border border-gray-300 px-3 py-2 text-text focus:border-primary focus:outline-none"
          >
          <div class="group relative">
            <button
              :disabled="globalQtSaving"
              class="rounded bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
              @click="saveGlobalQualifyingTeams"
            >
              {{ nl.admin.koBracket.globalQualifyingTeamsSave }}
            </button>
            <div v-if="globalQtSaving" class="invisible absolute bottom-full left-1/2 z-10 mb-1 w-max max-w-xs -translate-x-1/2 rounded bg-gray-800 px-2 py-1 text-xs text-white group-hover:visible">
              {{ nl.common.saving }}
            </div>
          </div>
          <span v-if="globalQtSuccess" class="text-sm text-success">{{ globalQtSuccess }}</span>
          <span v-if="globalQtError" class="text-sm text-error">{{ globalQtError }}</span>
        </div>
      </div>

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

      <div v-else class="group relative inline-block">
        <button
          :disabled="generateLoading"
          class="rounded bg-primary px-4 py-2 font-medium text-white hover:bg-primary-dark disabled:opacity-50"
          @click="generate()"
        >
          {{ hasStructure ? nl.admin.koBracket.newGenerate : nl.admin.koBracket.generate }}
        </button>
        <div v-if="generateLoading" class="invisible absolute bottom-full left-1/2 z-10 mb-1 w-max max-w-xs -translate-x-1/2 rounded bg-gray-800 px-2 py-1 text-xs text-white group-hover:visible">
          {{ nl.common.generating }}
        </div>
      </div>
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

    <!-- Publish bracket -->
    <div
      v-if="tournament && hasStructure"
      class="mb-6 rounded-lg border border-gray-200 bg-surface p-4 shadow-sm"
    >
      <h2 class="mb-3 font-semibold text-text">
        {{ nl.admin.koBracket.statusSection }}
      </h2>
      <div class="group relative inline-block">
        <button
          :disabled="phaseToggleLoading || tournament.status === 'DRAFT'"
          :class="activeBracketIsLive ? 'bg-success' : 'bg-warning'"
          class="rounded px-4 py-2 text-sm font-medium text-white hover:opacity-80 disabled:opacity-50"
          @click="toggleKoPhase"
        >
          <template v-if="activeBracket === 'A'">
            {{ activeBracketIsLive ? nl.admin.koBracket.koScheduleLive : nl.admin.koBracket.koScheduleDraft }}
          </template>
          <template v-else>
            {{ activeBracketIsLive ? nl.admin.koBracket.bKoScheduleLive : nl.admin.koBracket.bKoScheduleDraft }}
          </template>
        </button>
        <div v-if="phaseToggleLoading || tournament.status === 'DRAFT'" class="invisible absolute bottom-full left-1/2 z-10 mb-1 w-max max-w-xs -translate-x-1/2 rounded bg-gray-800 px-2 py-1 text-xs text-white group-hover:visible">
          {{ phaseToggleLoading ? nl.common.submitting : nl.common.draftTooltip }}
        </div>
      </div>
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
                    {{ r === 1 ? nl.admin.koBracket.bye : nl.admin.koBracket.waitingForOpponent }}
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
                    v-if="getMatch(r, idx)!.status !== 'PLAYED' || getMatch(r, idx)!.teamAId === null || getMatch(r, idx)!.teamBId === null"
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

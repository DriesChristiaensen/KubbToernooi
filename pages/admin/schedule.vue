<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { VueDatePicker } from "@vuepic/vue-datepicker";
import { nlBE } from "date-fns/locale";
import { nl } from "~/i18n/nl";

definePageMeta({
  middleware: ["auth", "admin-tournament-guard"],
  layout: "admin",
});

interface Field {
  id: string;
  name: string;
}

interface Match {
  id: string;
  phase: string;
  round: number;
  startTime: string;
  status: string;
  scoreA: number | null;
  scoreB: number | null;
  field: Field;
  teamA: { id: string; name: string };
  teamB: { id: string; name: string };
  pool: { id: string; name: string } | null;
}

interface Tournament {
  type: string;
  status: string;
  matchDuration: number;
  breakTime: number;
  poolScheduleLive: boolean;
  koScheduleLive: boolean;
}

const matches = ref<Match[]>([]);
const fields = ref<Field[]>([]);
const tournament = ref<Tournament | null>(null);
const generateLoading = ref(false);
const generateError = ref("");
const generateSuccess = ref("");
const generateStartDateTime = ref<Date | null>(null);
const showOverwrite = ref(false);

const timeShiftFrom = ref("");
const timeShiftMinutes = ref<number>(0);
const timeShiftLoading = ref(false);
const timeShiftError = ref("");
const timeShiftSuccess = ref("");

const viewMode = ref<"field" | "team" | "slot">("slot");
const switchMatchId = ref<string | null>(null);
const swapLoading = ref(false);
const swapError = ref("");
const swapSuccess = ref("");
const extraSlots = ref<string[]>([]);
const liveSwapWarning = ref(false);
const pendingLiveAction = ref<(() => void) | null>(null);

const phaseToggleLoading = ref(false);
const phaseToggleError = ref("");
const showDraftWarning = ref(false);
const pendingDraftField = ref<"poolScheduleLive" | "koScheduleLive" | null>(
  null,
);

async function fetchMatches() {
  try {
    matches.value = await $fetch<Match[]>("/api/admin/schedule/matches");
  } catch {
    matches.value = [];
  }
}

async function fetchFields() {
  fields.value = await $fetch<Field[]>("/api/admin/fields").catch(() => []);
}

async function fetchTournament() {
  try {
    tournament.value = await $fetch<Tournament>("/api/admin/tournament");
  } catch {
    // non-critical
  }
}

async function generateSchedule(overwrite = false) {
  generateError.value = "";
  generateSuccess.value = "";
  if (!generateStartDateTime.value) {
    generateError.value = nl.admin.schedule.startDateTimeRequired;
    return;
  }
  const parsedStart = generateStartDateTime.value;
  showOverwrite.value = false;
  generateLoading.value = true;
  try {
    const result = await $fetch<{ generated: number }>(
      "/api/admin/schedule/generate",
      {
        method: "POST",
        body: { overwrite, startDateTime: parsedStart.toISOString() },
      },
    );
    generateSuccess.value = `${result.generated} ${nl.admin.schedule.generate}`;
    await fetchMatches();
    await refreshNuxtData('admin-status-banner');
  } catch (err: unknown) {
    const fetchErr = err as {
      data?: { data?: { error?: string; code?: number } };
    };
    if (fetchErr?.data?.data?.code === 409) {
      showOverwrite.value = true;
      generateError.value = fetchErr?.data?.data?.error || nl.common.error;
    } else {
      generateError.value = fetchErr?.data?.data?.error || nl.common.error;
    }
  } finally {
    generateLoading.value = false;
  }
}

async function applyTimeShift() {
  timeShiftError.value = "";
  timeShiftSuccess.value = "";
  if (!timeShiftFrom.value) {
    timeShiftError.value = nl.admin.schedule.shiftFrom;
    return;
  }
  timeShiftLoading.value = true;
  try {
    const result = await $fetch<{ shifted: number }>(
      "/api/admin/schedule/time-shift",
      {
        method: "POST",
        body: {
          fromTime: new Date(timeShiftFrom.value).toISOString(),
          offsetMinutes: timeShiftMinutes.value,
        },
      },
    );
    timeShiftSuccess.value = `${result.shifted} ${nl.admin.schedule.shiftSuccess}`;
    await fetchMatches();
  } catch (err: unknown) {
    const fetchErr = err as { data?: { data?: { error?: string } } };
    timeShiftError.value = fetchErr?.data?.data?.error || nl.common.error;
  } finally {
    timeShiftLoading.value = false;
  }
}

function clickMatch(match: Match) {
  if (match.status === 'PLAYED') return;

  // Deselect: never needs a warning
  if (switchMatchId.value === match.id) {
    switchMatchId.value = null;
    return;
  }

  // Conflict-disabled target: silently block
  if (switchMatchId.value && disabledSwapMatchIds.value.has(match.id)) return;

  const isLive = match.status === 'LIVE' || match.status === 'AWAITING_RESULT';
  if (isLive) {
    if (switchMatchId.value === null) {
      pendingLiveAction.value = () => {
        switchMatchId.value = match.id;
        swapError.value = "";
        swapSuccess.value = "";
      };
    } else {
      const aid = switchMatchId.value;
      pendingLiveAction.value = () => swapMatches(aid, match.id);
    }
    liveSwapWarning.value = true;
    return;
  }

  if (switchMatchId.value === null) {
    switchMatchId.value = match.id;
    swapError.value = "";
    swapSuccess.value = "";
    return;
  }
  swapMatches(switchMatchId.value, match.id);
}

function confirmLiveSwap() {
  liveSwapWarning.value = false;
  pendingLiveAction.value?.();
  pendingLiveAction.value = null;
}

function cancelLiveSwap() {
  liveSwapWarning.value = false;
  pendingLiveAction.value = null;
}

async function swapMatches(matchAId: string, matchBId: string) {
  swapLoading.value = true;
  swapError.value = "";
  swapSuccess.value = "";
  try {
    await $fetch("/api/admin/schedule/matches/swap", {
      method: "POST",
      body: { matchAId, matchBId },
    });
    swapSuccess.value = nl.admin.schedule.swapSuccess;
    switchMatchId.value = null;
    await fetchMatches();
  } catch (err: unknown) {
    const fetchErr = err as { data?: { data?: { error?: string } } };
    swapError.value = fetchErr?.data?.data?.error || nl.common.error;
    switchMatchId.value = null;
  } finally {
    swapLoading.value = false;
  }
}

async function togglePhase(field: "poolScheduleLive" | "koScheduleLive") {
  if (!tournament.value) return;
  const newVal = !tournament.value[field];
  if (!newVal) {
    const now = Date.now();
    const phaseFilter = field === "poolScheduleLive" ? "POOL" : "KO";
    const phaseMatches = matches.value.filter((m) => m.phase === phaseFilter);
    const hasStarted = phaseMatches.some(
      (m) =>
        m.scoreA !== null ||
        m.scoreB !== null ||
        new Date(m.startTime).getTime() < now,
    );
    if (hasStarted) {
      pendingDraftField.value = field;
      showDraftWarning.value = true;
      return;
    }
  }
  await executeDraftToggle(field, newVal);
}

async function executeDraftToggle(
  field: "poolScheduleLive" | "koScheduleLive",
  newVal: boolean,
) {
  if (!tournament.value) return;
  phaseToggleError.value = "";
  phaseToggleLoading.value = true;
  try {
    await $fetch("/api/admin/tournament", {
      method: "PATCH",
      body: { [field]: newVal },
    });
    tournament.value[field] = newVal;
    await refreshNuxtData('admin-status-banner');
  } catch (err: unknown) {
    const fetchErr = err as { data?: { data?: { error?: string } } };
    phaseToggleError.value = fetchErr?.data?.data?.error || nl.common.error;
  } finally {
    phaseToggleLoading.value = false;
  }
}

async function confirmDraftToggle() {
  if (!pendingDraftField.value) return;
  showDraftWarning.value = false;
  await executeDraftToggle(pendingDraftField.value, false);
  pendingDraftField.value = null;
}

function cancelDraftToggle() {
  showDraftWarning.value = false;
  pendingDraftField.value = null;
}

const poolMatchCount = computed(
  () => matches.value.filter((m) => m.phase === "POOL").length,
);

// Computed views
const matchesByField = computed(() => {
  const map = new Map<string, { field: Field; matches: Match[] }>();
  for (const m of matches.value) {
    if (!map.has(m.field.id))
      map.set(m.field.id, { field: m.field, matches: [] });
    // Safe: Entry guaranteed to exist from has check or set call above
    map.get(m.field.id)!.matches.push(m);
  }
  return Array.from(map.values()).sort((a, b) =>
    a.field.name.localeCompare(b.field.name),
  );
});

const matchesByTeam = computed(() => {
  const map = new Map<string, { teamName: string; matches: Match[] }>();
  for (const m of matches.value) {
    if (!m.teamA || !m.teamB) continue;
    [
      { id: m.teamA.id, name: m.teamA.name, opponent: m.teamB.name },
      { id: m.teamB.id, name: m.teamB.name, opponent: m.teamA.name },
    ].forEach(({ id, name }) => {
      if (!map.has(id)) map.set(id, { teamName: name, matches: [] });
      // Safe: Entry guaranteed to exist from has check or set call above
      map.get(id)!.matches.push(m);
    });
  }
  return Array.from(map.values()).sort((a, b) =>
    a.teamName.localeCompare(b.teamName),
  );
});

const uniqueSlots = computed(() => {
  const fromMatches = matches.value.map((m) => m.startTime);
  return [...new Set([...fromMatches, ...extraSlots.value])].sort();
});

interface ConflictPair {
  field: string;
  teamA1: string;
  teamB1: string;
  teamA2: string;
  teamB2: string;
  type: "field" | "team";
}

const conflictPairs = computed(() => {
  const pairs: ConflictPair[] = [];
  const list = matches.value;
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i]!;
      const b = list[j]!;
      if (a.startTime !== b.startTime) continue;
      const fieldConflict = a.field.id === b.field.id;
      const teamConflict =
        a.teamA?.id === b.teamA?.id ||
        a.teamA?.id === b.teamB?.id ||
        a.teamB?.id === b.teamA?.id ||
        a.teamB?.id === b.teamB?.id;
      if (fieldConflict || teamConflict) {
        pairs.push({
          field: a.field.name,
          teamA1: a.teamA?.name ?? "?",
          teamB1: a.teamB?.name ?? "?",
          teamA2: b.teamA?.name ?? "?",
          teamB2: b.teamB?.name ?? "?",
          type: fieldConflict ? "field" : "team",
        });
      }
    }
  }
  return pairs;
});

const conflictingMatchIds = computed(() => {
  const ids = new Set<string>();
  const list = matches.value;
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i]!;
      const b = list[j]!;
      if (a.startTime !== b.startTime) continue;
      const fieldConflict = a.field.id === b.field.id;
      const teamConflict =
        a.teamA?.id === b.teamA?.id ||
        a.teamA?.id === b.teamB?.id ||
        a.teamB?.id === b.teamA?.id ||
        a.teamB?.id === b.teamB?.id;
      if (fieldConflict || teamConflict) {
        ids.add(a.id);
        ids.add(b.id);
      }
    }
  }
  return ids;
});

const switchMatch = computed(
  () => matches.value.find((m) => m.id === switchMatchId.value) ?? null,
);

const matchDurationMs = computed(
  () => (tournament.value?.matchDuration ?? 15) * 60 * 1000,
);

function wouldSwapCauseConflict(sm: Match, target: Match): boolean {
  const smTime = new Date(sm.startTime).getTime();
  const targetTime = new Date(target.startTime).getTime();
  const dur = matchDurationMs.value;
  const exclude = new Set([sm.id, target.id]);
  for (const m of matches.value) {
    if (exclude.has(m.id)) continue;
    const mTime = new Date(m.startTime).getTime();
    const involvesSmTeams =
      m.teamA?.id === sm.teamA?.id ||
      m.teamB?.id === sm.teamA?.id ||
      m.teamA?.id === sm.teamB?.id ||
      m.teamB?.id === sm.teamB?.id;
    const involvesTargetTeams =
      m.teamA?.id === target.teamA?.id ||
      m.teamB?.id === target.teamA?.id ||
      m.teamA?.id === target.teamB?.id ||
      m.teamB?.id === target.teamB?.id;
    if (involvesSmTeams && Math.abs(mTime - targetTime) < dur) return true;
    if (involvesTargetTeams && Math.abs(mTime - smTime) < dur) return true;
  }
  return false;
}

function getSwapConflictReason(sm: Match, target: Match): string {
  const smTime = new Date(sm.startTime).getTime();
  const targetTime = new Date(target.startTime).getTime();
  const dur = matchDurationMs.value;
  const exclude = new Set([sm.id, target.id]);
  const conflicting = new Set<string>();
  for (const m of matches.value) {
    if (exclude.has(m.id)) continue;
    const mTime = new Date(m.startTime).getTime();
    // sm would move to target's slot — check sm's teams at targetTime
    if (Math.abs(mTime - targetTime) < dur) {
      if (m.teamA?.id === sm.teamA?.id || m.teamB?.id === sm.teamA?.id)
        conflicting.add(sm.teamA!.name);
      if (m.teamA?.id === sm.teamB?.id || m.teamB?.id === sm.teamB?.id)
        conflicting.add(sm.teamB!.name);
    }
    // target would move to sm's slot — check target's teams at smTime
    if (Math.abs(mTime - smTime) < dur) {
      if (m.teamA?.id === target.teamA?.id || m.teamB?.id === target.teamA?.id)
        conflicting.add(target.teamA!.name);
      if (m.teamA?.id === target.teamB?.id || m.teamB?.id === target.teamB?.id)
        conflicting.add(target.teamB!.name);
    }
  }
  return Array.from(conflicting).join(", ");
}

const isSelectedMatchScheduleLive = computed(() => {
  const sm = switchMatch.value;
  if (!sm || !tournament.value) return false;
  return sm.phase === "KO"
    ? tournament.value.koScheduleLive
    : tournament.value.poolScheduleLive;
});

const highlightedMatchIds = computed(() => {
  const sm = switchMatch.value;
  if (!sm || isSelectedMatchScheduleLive.value) return new Set<string>();
  const ids = new Set<string>();
  for (const m of matches.value) {
    if (m.id === sm.id) continue;
    if (wouldSwapCauseConflict(sm, m)) ids.add(m.id);
  }
  return ids;
});

const disabledSwapMatchIds = computed(() => {
  const sm = switchMatch.value;
  if (!sm || !isSelectedMatchScheduleLive.value) return new Set<string>();
  const ids = new Set<string>();
  for (const m of matches.value) {
    if (m.id === sm.id) continue;
    if (wouldSwapCauseConflict(sm, m)) ids.add(m.id);
  }
  return ids;
});

const disabledSwapReasons = computed(() => {
  const sm = switchMatch.value;
  if (!sm || !isSelectedMatchScheduleLive.value) return new Map<string, string>();
  const map = new Map<string, string>();
  for (const m of matches.value) {
    if (m.id === sm.id) continue;
    if (wouldSwapCauseConflict(sm, m)) map.set(m.id, getSwapConflictReason(sm, m));
  }
  return map;
});

function rowClass(matchId: string): string {
  const match = matches.value.find(m => m.id === matchId);
  if (match?.status === 'PLAYED')
    return "border-b border-gray-100 opacity-40 cursor-not-allowed transition-colors";
  if (switchMatchId.value === matchId)
    return "cursor-pointer border-b border-gray-100 bg-primary/10 outline outline-2 outline-primary transition-colors";
  if (switchMatchId.value && disabledSwapMatchIds.value.has(matchId))
    return "cursor-not-allowed border-b border-gray-100 bg-gray-100 opacity-50 transition-colors";
  if (switchMatchId.value && highlightedMatchIds.value.has(matchId))
    return "cursor-pointer border-b border-gray-100 bg-orange-50 outline outline-2 outline-orange-400 transition-colors";
  if (conflictingMatchIds.value.has(matchId))
    return "cursor-pointer border-b border-gray-100 bg-red-50 outline outline-1 outline-red-400 transition-colors";
  return "cursor-pointer border-b border-gray-100 hover:bg-gray-50 transition-colors";
}

function cellClass(matchId: string): string {
  const match = matches.value.find(m => m.id === matchId);
  if (match?.status === 'PLAYED')
    return "w-full rounded p-1 text-left text-xs transition-colors bg-gray-200 text-gray-400 cursor-not-allowed line-through";
  if (switchMatchId.value === matchId)
    return "w-full rounded p-1 text-left text-xs transition-colors bg-primary text-white";
  if (switchMatchId.value && disabledSwapMatchIds.value.has(matchId))
    return "w-full rounded p-1 text-left text-xs transition-colors bg-gray-200 text-gray-400 cursor-not-allowed";
  if (switchMatchId.value && highlightedMatchIds.value.has(matchId))
    return "w-full rounded p-1 text-left text-xs transition-colors bg-orange-200 text-orange-900 outline outline-2 outline-orange-400";
  if (conflictingMatchIds.value.has(matchId))
    return "w-full rounded p-1 text-left text-xs transition-colors bg-red-100 text-red-800 outline outline-1 outline-red-400";
  return "w-full rounded p-1 text-left text-xs transition-colors bg-gray-100 hover:bg-gray-200 text-text";
}

function getMatchForSlot(fieldId: string, slot: string): Match | undefined {
  return matches.value.find(
    (m) => m.field.id === fieldId && m.startTime === slot,
  );
}

function addTimeslot() {
  const slots = uniqueSlots.value;
  if (slots.length === 0) return;
  const latest = slots[slots.length - 1]!;
  const slotDuration = (tournament.value?.matchDuration ?? 15) + (tournament.value?.breakTime ?? 5);
  const next = new Date(
    new Date(latest).getTime() + slotDuration * 60 * 1000,
  ).toISOString();
  if (!extraSlots.value.includes(next)) {
    extraSlots.value.push(next);
  }
}

function wouldMoveToSlotCauseConflict(sm: Match, targetSlot: string): boolean {
  const targetTime = new Date(targetSlot).getTime();
  const dur = matchDurationMs.value;
  for (const m of matches.value) {
    if (m.id === sm.id) continue;
    const mTime = new Date(m.startTime).getTime();
    const involvesSmTeams =
      m.teamA?.id === sm.teamA?.id ||
      m.teamB?.id === sm.teamA?.id ||
      m.teamA?.id === sm.teamB?.id ||
      m.teamB?.id === sm.teamB?.id;
    if (involvesSmTeams && Math.abs(mTime - targetTime) < dur) return true;
  }
  return false;
}

function isEmptySlotDisabled(slot: string): boolean {
  const sm = switchMatch.value;
  if (!sm || !isSelectedMatchScheduleLive.value) return false;
  return wouldMoveToSlotCauseConflict(sm, slot);
}

function emptySlotCellClass(slot: string): string {
  const sm = switchMatch.value;
  if (!sm) return "";
  if (isSelectedMatchScheduleLive.value && wouldMoveToSlotCauseConflict(sm, slot)) {
    return "w-full rounded p-1 text-left text-xs border border-dashed border-gray-300 text-gray-300 cursor-not-allowed";
  }
  if (!isSelectedMatchScheduleLive.value && wouldMoveToSlotCauseConflict(sm, slot)) {
    return "w-full rounded p-1 text-left text-xs border border-dashed border-orange-400 text-orange-500 hover:bg-orange-50 transition-colors";
  }
  return "w-full rounded p-1 text-left text-xs border border-dashed border-primary/40 text-primary/60 hover:border-primary hover:bg-primary/5 transition-colors";
}

async function moveMatchToSlot(matchId: string, fieldId: string, slot: string) {
  if (!matchId) return;
  swapLoading.value = true;
  swapError.value = "";
  swapSuccess.value = "";
  try {
    await $fetch(`/api/admin/schedule/matches/${matchId}`, {
      method: "PATCH",
      body: { fieldId, startTime: slot },
    });
    swapSuccess.value = nl.admin.schedule.moveSuccess;
    switchMatchId.value = null;
    await fetchMatches();
    const realSlots = new Set(matches.value.map((m) => m.startTime));
    extraSlots.value = extraSlots.value.filter((s) => !realSlots.has(s));
  } catch (err: unknown) {
    const fetchErr = err as { data?: { data?: { error?: string } } };
    swapError.value = fetchErr?.data?.data?.error || nl.common.error;
    switchMatchId.value = null;
  } finally {
    swapLoading.value = false;
  }
}

function clickEmptySlot(fieldId: string, slot: string) {
  if (!switchMatchId.value || !switchMatch.value) return;
  if (isEmptySlotDisabled(slot)) return;
  moveMatchToSlot(switchMatchId.value, fieldId, slot);
}

onMounted(async () => {
  await Promise.all([fetchMatches(), fetchFields(), fetchTournament()]);
});
</script>

<template>
  <main class="mx-auto max-w-content p-4">
    <!-- Draft warning modal -->
    <div
      v-if="showDraftWarning"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
    >
      <div class="mx-4 max-w-md rounded-lg bg-surface p-6 shadow-xl">
        <p class="mb-4 text-text">{{ nl.admin.schedule.draftWarning }}</p>
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
    <!-- Live match warning modal -->
    <div
      v-if="liveSwapWarning"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
    >
      <div class="mx-4 max-w-md rounded-lg bg-surface p-6 shadow-xl">
        <p class="mb-4 text-text">{{ nl.common.liveMatchWarning }}</p>
        <div class="flex gap-3">
          <button
            class="rounded bg-warning px-4 py-2 text-sm font-medium text-white hover:opacity-80"
            @click="confirmLiveSwap"
          >
            {{ nl.common.confirm }}
          </button>
          <button
            class="rounded bg-secondary px-4 py-2 text-sm font-medium text-white hover:opacity-80"
            @click="cancelLiveSwap"
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
        {{ nl.admin.schedule.title }}
      </h1>
    </div>

    <!-- Generate schedule -->
    <section class="mb-6 rounded-lg bg-surface p-4 shadow-sm">
      <h2 class="mb-4 font-semibold text-text">
        {{ nl.admin.schedule.generate }}
      </h2>
      <div class="mb-4">
        <label
          class="mb-1 block text-sm font-medium text-text"
          for="sched-start"
        >
          {{ nl.admin.schedule.startDateTime }}
        </label>
        <ClientOnly>
          <VueDatePicker
            v-model="generateStartDateTime"
            :formats="{ input: 'dd/MM/yyyy HH:mm' }"
            :enable-time-picker="true"
            :is24="true"
            auto-apply
            :locale="nlBE"
            :disabled="generateLoading"
          />
        </ClientOnly>
      </div>
      <p v-if="generateError" class="mb-2 text-sm text-error">
        {{ generateError }}
      </p>
      <p v-if="generateSuccess" class="mb-2 text-sm text-success">
        {{ generateSuccess }}
      </p>
      <div class="flex flex-wrap gap-3">
        <div class="group relative">
          <button
            :disabled="generateLoading"
            class="rounded bg-primary px-4 py-2 font-medium text-white hover:bg-primary-dark disabled:opacity-50"
            @click="generateSchedule(false)"
          >
            {{ nl.admin.schedule.generate }}
          </button>
          <div v-if="generateLoading" class="invisible absolute bottom-full left-1/2 z-10 mb-1 w-max max-w-xs -translate-x-1/2 rounded bg-gray-800 px-2 py-1 text-xs text-white group-hover:visible">
            {{ nl.common.generating }}
          </div>
        </div>
        <template v-if="showOverwrite">
          <button
            class="rounded bg-error px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            @click="generateSchedule(true)"
          >
            {{ nl.common.confirm }}
          </button>
          <button
            class="rounded bg-secondary px-4 py-2 text-sm font-medium text-white hover:opacity-80"
            @click="
              showOverwrite = false;
              generateError = '';
            "
          >
            {{ nl.common.cancel }}
          </button>
        </template>
      </div>
    </section>

    <!-- Phase live toggles -->
    <section
      v-if="
        tournament &&
        (tournament.type === 'POOLS' || tournament.type === 'COMBINATION') &&
        poolMatchCount > 0
      "
      class="mb-6 rounded-lg bg-surface p-4 shadow-sm"
    >
      <h2 class="mb-3 font-semibold text-text">
        {{ nl.admin.schedule.statusSection }}
      </h2>
      <div class="flex flex-wrap gap-2">
        <div class="group relative">
          <button
            :disabled="phaseToggleLoading || tournament.status === 'DRAFT'"
            :class="tournament.poolScheduleLive ? 'bg-success' : 'bg-warning'"
            class="rounded px-4 py-2 text-sm font-medium text-white hover:opacity-80 disabled:opacity-50"
            @click="togglePhase('poolScheduleLive')"
          >
            {{
              tournament.poolScheduleLive
                ? nl.admin.schedule.poolScheduleLive
                : nl.admin.schedule.poolScheduleDraft
            }}
          </button>
          <div v-if="phaseToggleLoading || tournament.status === 'DRAFT'" class="invisible absolute bottom-full left-1/2 z-10 mb-1 w-max max-w-xs -translate-x-1/2 rounded bg-gray-800 px-2 py-1 text-xs text-white group-hover:visible">
            {{ phaseToggleLoading ? nl.common.submitting : nl.common.draftTooltip }}
          </div>
        </div>
      </div>
      <p v-if="phaseToggleError" class="mt-2 text-sm text-error">
        {{ phaseToggleError }}
      </p>
    </section>

    <!-- Time shift -->
    <section class="mb-6 rounded-lg bg-surface p-4 shadow-sm">
      <h2 class="mb-4 font-semibold text-text">
        {{ nl.admin.schedule.timeShift }}
      </h2>
      <div class="grid gap-3 md:grid-cols-3">
        <div>
          <label class="mb-1 block text-sm font-medium text-text">{{
            nl.admin.schedule.shiftFrom
          }}</label>
          <select
            v-model="timeShiftFrom"
            class="w-full rounded border border-gray-300 px-3 py-2 text-text focus:border-primary focus:outline-none"
          >
            <option value="" disabled>—</option>
            <option
              v-for="time in [
                ...new Set(matches.map((m) => m.startTime)),
              ].sort()"
              :key="time"
              :value="time"
            >
              {{ formatDateTime(time) }}
            </option>
          </select>
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium text-text">{{
            nl.admin.schedule.shiftMinutes
          }}</label>
          <input
            v-model.number="timeShiftMinutes"
            type="number"
            class="w-full rounded border border-gray-300 px-3 py-2 text-text focus:border-primary focus:outline-none"
          >
        </div>
        <div class="flex items-end">
          <div class="group relative">
            <button
              :disabled="timeShiftLoading"
              class="rounded bg-primary px-4 py-2 font-medium text-white hover:bg-primary-dark disabled:opacity-50"
              @click="applyTimeShift"
            >
              {{ nl.admin.schedule.shiftApply }}
            </button>
            <div v-if="timeShiftLoading" class="invisible absolute bottom-full left-1/2 z-10 mb-1 w-max max-w-xs -translate-x-1/2 rounded bg-gray-800 px-2 py-1 text-xs text-white group-hover:visible">
              {{ nl.common.submitting }}
            </div>
          </div>
        </div>
      </div>
      <p v-if="timeShiftError" class="mt-2 text-sm text-error">
        {{ timeShiftError }}
      </p>
      <p v-if="timeShiftSuccess" class="mt-2 text-sm text-success">
        {{ timeShiftSuccess }}
      </p>
    </section>

    <!-- Match schedule views -->
    <section
      v-if="matches.length > 0"
      class="rounded-lg bg-surface p-4 shadow-sm"
    >
      <!-- View mode tabs -->
      <div class="mb-4 flex gap-1 border-b border-gray-200">
        <button
          v-for="(label, mode) in {
            slot: nl.admin.schedule.viewPerSlot,
            field: nl.admin.schedule.viewPerField,
            team: nl.admin.schedule.viewPerTeam,
          }"
          :key="mode"
          :class="
            viewMode === mode
              ? 'border-b-2 border-primary font-semibold text-primary'
              : 'text-text-light hover:text-text'
          "
          class="-mb-px px-4 py-2 text-sm"
          @click="viewMode = mode as typeof viewMode"
        >
          {{ label }}
        </button>
      </div>

      <!-- Conflict warning (persistent across all tabs) -->
      <div
        v-if="conflictPairs.length > 0"
        class="mb-3 rounded-lg border border-error bg-error/10 px-4 py-2 text-sm text-error"
      >
        <p class="mb-1 font-medium">{{ nl.admin.schedule.swapConflictWarning }}</p>
        <ul class="list-disc pl-4">
          <li v-for="(c, i) in conflictPairs" :key="i">
            <span class="font-medium">{{ c.field }}</span>:
            {{ c.teamA1 }} vs {{ c.teamB1 }}
            &amp;
            {{ c.teamA2 }} vs {{ c.teamB2 }}
          </li>
        </ul>
      </div>

      <!-- Switch mode status -->
      <div
        v-if="switchMatchId"
        class="mb-3 space-y-1 rounded-lg border border-primary bg-primary/5 px-4 py-2 text-sm text-primary"
      >
        <div>{{ nl.admin.schedule.switchModeHint }}</div>
        <div v-if="viewMode === 'slot'" class="text-primary/70">
          {{ nl.admin.schedule.switchEmptySlotHint }}
        </div>
        <div v-if="!isSelectedMatchScheduleLive" class="text-orange-500">
          {{ nl.admin.schedule.switchHighlightHint }}
        </div>
      </div>
      <p v-if="swapError" class="mb-2 text-sm text-error">
        {{ swapError }}
      </p>
      <p v-if="swapSuccess" class="mb-2 text-sm text-success">
        {{ swapSuccess }}
      </p>

      <!-- View: Per field -->
      <template v-if="viewMode === 'field'">
        <div v-for="group in matchesByField" :key="group.field.id" class="mb-6">
          <h3 class="mb-2 font-semibold text-text">{{ group.field.name }}</h3>
          <table class="w-full table-fixed text-sm">
            <thead>
              <tr class="border-b border-gray-200 text-left text-text-light">
                <th class="w-36 pb-1 pr-4">{{ nl.admin.schedule.timeLabel }}</th>
                <th class="w-2/5 pb-1 pr-4">{{ nl.admin.schedule.teamAHeader }}</th>
                <th class="pb-1">{{ nl.admin.schedule.teamBHeader }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="m in group.matches.sort((a, b) =>
                  a.startTime.localeCompare(b.startTime),
                )"
                :key="m.id"
                :class="rowClass(m.id)"
                class="group"
                :title="disabledSwapMatchIds.has(m.id) ? `${nl.admin.schedule.swapDisabledHint} ${disabledSwapReasons.get(m.id)}` : undefined"
                @click="clickMatch(m)"
              >
                <td class="py-2 pr-4 text-text-light">
                  {{ formatDateTime(m.startTime) }}
                </td>
                <td class="py-2 pr-4 font-medium text-text">
                  {{ m.teamA?.name ?? "?" }}
                </td>
                <td class="relative py-2 font-medium text-text">
                  {{ m.teamB?.name ?? "?" }}
                  <div
                    v-if="m.status === 'PLAYED'"
                    class="pointer-events-none absolute bottom-full right-0 z-10 mb-1 hidden w-max rounded bg-gray-800 px-2 py-1 text-xs text-white group-hover:block"
                  >
                    {{ nl.common.playedMatchBlocked }}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>

      <!-- View: Per team -->
      <template v-else-if="viewMode === 'team'">
        <div v-for="group in matchesByTeam" :key="group.teamName" class="mb-6">
          <h3 class="mb-2 font-semibold text-text">{{ group.teamName }}</h3>
          <table class="w-full table-fixed text-sm">
            <thead>
              <tr class="border-b border-gray-200 text-left text-text-light">
                <th class="w-36 pb-1 pr-4">{{ nl.admin.schedule.timeLabel }}</th>
                <th class="w-28 pb-1 pr-4">{{ nl.admin.schedule.fieldLabel }}</th>
                <th class="pb-1">{{ nl.admin.schedule.opponent }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="m in group.matches.sort((a, b) =>
                  a.startTime.localeCompare(b.startTime),
                )"
                :key="m.id"
                :class="rowClass(m.id)"
                class="group"
                :title="disabledSwapMatchIds.has(m.id) ? `${nl.admin.schedule.swapDisabledHint} ${disabledSwapReasons.get(m.id)}` : undefined"
                @click="clickMatch(m)"
              >
                <td class="py-2 pr-4 text-text-light">
                  {{ formatDateTime(m.startTime) }}
                </td>
                <td class="py-2 pr-4 text-text">{{ m.field.name }}</td>
                <td class="relative py-2 font-medium text-text">
                  {{
                    m.teamA?.name === group.teamName
                      ? m.teamB?.name
                      : m.teamA?.name
                  }}
                  <div
                    v-if="m.status === 'PLAYED'"
                    class="pointer-events-none absolute bottom-full right-0 z-10 mb-1 hidden w-max rounded bg-gray-800 px-2 py-1 text-xs text-white group-hover:block"
                  >
                    {{ nl.common.playedMatchBlocked }}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>

      <!-- View: Per time slot (grid) -->
      <template v-else>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-gray-200 text-left">
                <th class="pb-1 pr-4 text-text-light">
                  {{ nl.admin.schedule.timeLabel }}
                </th>
                <th
                  v-for="f in fields"
                  :key="f.id"
                  class="pb-1 pr-4 font-semibold text-text"
                >
                  {{ f.name }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="slot in uniqueSlots"
                :key="slot"
                class="border-b border-gray-100"
              >
                <td class="py-2 pr-4 text-text-light">
                  {{ formatDateTime(slot) }}
                </td>
                <td v-for="f in fields" :key="f.id" class="py-2 pr-4">
                  <template v-if="getMatchForSlot(f.id, slot)">
                    <div class="group relative">
                      <button
                        :class="cellClass(getMatchForSlot(f.id, slot)!.id)"
                        @click="clickMatch(getMatchForSlot(f.id, slot)!)"
                      >
                        {{ getMatchForSlot(f.id, slot)!.teamA?.name ?? "?" }} vs
                        {{ getMatchForSlot(f.id, slot)!.teamB?.name ?? "?" }}
                      </button>
                      <div
                        v-if="getMatchForSlot(f.id, slot)!.status === 'PLAYED'"
                        class="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden w-max -translate-x-1/2 rounded bg-gray-800 px-2 py-1 text-xs text-white group-hover:block"
                      >
                        {{ nl.common.playedMatchBlocked }}
                      </div>
                      <div
                        v-else-if="disabledSwapMatchIds.has(getMatchForSlot(f.id, slot)!.id)"
                        class="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden w-48 -translate-x-1/2 rounded bg-gray-800 px-2 py-1 text-center text-xs text-white group-hover:block"
                      >
                        {{ nl.admin.schedule.swapDisabledHint }}
                        {{ disabledSwapReasons.get(getMatchForSlot(f.id, slot)!.id) }}
                      </div>
                    </div>
                  </template>
                  <template v-else-if="switchMatchId && switchMatch">
                    <button
                      :class="emptySlotCellClass(slot)"
                      :disabled="isEmptySlotDisabled(slot)"
                      @click="clickEmptySlot(f.id, slot)"
                    >
                      —
                    </button>
                  </template>
                  <span v-else class="text-text-light">—</span>
                </td>
              </tr>
            </tbody>
          </table>
          <div class="mt-3">
            <button
              class="rounded border border-dashed border-primary/50 px-3 py-1 text-sm text-primary/70 hover:border-primary hover:bg-primary/5 transition-colors"
              @click="addTimeslot"
            >
              + {{ nl.admin.schedule.addTimeslot }}
            </button>
          </div>
        </div>
      </template>
    </section>

    <p v-else-if="matches.length === 0" class="text-text-light">
      {{ nl.common.noResults }}
    </p>
  </main>
</template>

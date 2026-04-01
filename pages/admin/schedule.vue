<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { VueDatePicker } from "@vuepic/vue-datepicker";
import { nlBE } from "date-fns/locale";
import { nl } from "~/i18n/nl";

definePageMeta({ middleware: ["auth", "admin-tournament-guard"], layout: "admin" });

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
  field: Field;
  teamA: { id: string; name: string };
  teamB: { id: string; name: string };
  pool: { id: string; name: string } | null;
}

interface Tournament {
  type: string;
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

const viewMode = ref<"field" | "team" | "slot">("field");
const switchMatchId = ref<string | null>(null);
const swapLoading = ref(false);
const swapError = ref("");
const swapSuccess = ref("");

const phaseToggleLoading = ref(false);
const phaseToggleError = ref("");

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
  if (switchMatchId.value === null) {
    switchMatchId.value = match.id;
    swapError.value = "";
    swapSuccess.value = "";
    return;
  }
  if (switchMatchId.value === match.id) {
    switchMatchId.value = null;
    return;
  }
  swapMatches(switchMatchId.value, match.id);
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
  phaseToggleError.value = "";
  phaseToggleLoading.value = true;
  const newVal = !tournament.value[field];
  try {
    await $fetch("/api/admin/tournament", {
      method: "PATCH",
      body: { [field]: newVal },
    });
    tournament.value[field] = newVal;
  } catch (err: unknown) {
    const fetchErr = err as { data?: { data?: { error?: string } } };
    phaseToggleError.value = fetchErr?.data?.data?.error || nl.common.error;
  } finally {
    phaseToggleLoading.value = false;
  }
}

// Computed views
const matchesByField = computed(() => {
  const map = new Map<string, { field: Field; matches: Match[] }>();
  for (const m of matches.value) {
    if (!map.has(m.field.id)) map.set(m.field.id, { field: m.field, matches: [] });
    map.get(m.field.id)!.matches.push(m);
  }
  return Array.from(map.values()).sort((a, b) => a.field.name.localeCompare(b.field.name));
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
      map.get(id)!.matches.push(m);
    });
  }
  return Array.from(map.values()).sort((a, b) => a.teamName.localeCompare(b.teamName));
});

const uniqueSlots = computed(() =>
  [...new Set(matches.value.map((m) => m.startTime))].sort(),
);

const conflictingMatchIds = computed(() => {
  const ids = new Set<string>();
  const list = matches.value;
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i]!;
      const b = list[j]!;
      if (a.startTime !== b.startTime) continue;
      const fieldConflict = a.field.id === b.field.id;
      const teamConflict
        = a.teamA?.id === b.teamA?.id
        || a.teamA?.id === b.teamB?.id
        || a.teamB?.id === b.teamA?.id
        || a.teamB?.id === b.teamB?.id;
      if (fieldConflict || teamConflict) {
        ids.add(a.id);
        ids.add(b.id);
      }
    }
  }
  return ids;
});

const switchMatch = computed(() =>
  matches.value.find((m) => m.id === switchMatchId.value) ?? null,
);

const highlightedMatchIds = computed(() => {
  const sm = switchMatch.value;
  if (!sm) return new Set<string>();
  const ids = new Set<string>();
  const teamIds = [sm.teamA?.id, sm.teamB?.id].filter(Boolean);
  for (const m of matches.value) {
    if (m.id === sm.id) continue;
    if (
      m.field.id === sm.field.id
      || teamIds.includes(m.teamA?.id)
      || teamIds.includes(m.teamB?.id)
    ) {
      ids.add(m.id);
    }
  }
  return ids;
});

function rowClass(matchId: string): string {
  if (switchMatchId.value === matchId)
    return "cursor-pointer border-b border-gray-100 bg-primary/10 outline outline-2 outline-primary transition-colors";
  if (switchMatchId.value && highlightedMatchIds.value.has(matchId))
    return "cursor-pointer border-b border-gray-100 bg-orange-50 outline outline-2 outline-orange-400 transition-colors";
  if (conflictingMatchIds.value.has(matchId))
    return "cursor-pointer border-b border-gray-100 bg-red-50 outline outline-1 outline-red-400 transition-colors";
  return "cursor-pointer border-b border-gray-100 hover:bg-gray-50 transition-colors";
}

function cellClass(matchId: string): string {
  if (switchMatchId.value === matchId)
    return "w-full rounded p-1 text-left text-xs transition-colors bg-primary text-white";
  if (switchMatchId.value && highlightedMatchIds.value.has(matchId))
    return "w-full rounded p-1 text-left text-xs transition-colors bg-orange-200 text-orange-900 outline outline-2 outline-orange-400";
  if (conflictingMatchIds.value.has(matchId))
    return "w-full rounded p-1 text-left text-xs transition-colors bg-red-100 text-red-800 outline outline-1 outline-red-400";
  return "w-full rounded p-1 text-left text-xs transition-colors bg-gray-100 hover:bg-gray-200 text-text";
}

function getMatchForSlot(fieldId: string, slot: string): Match | undefined {
  return matches.value.find((m) => m.field.id === fieldId && m.startTime === slot);
}

onMounted(async () => {
  await Promise.all([fetchMatches(), fetchFields(), fetchTournament()]);
});
</script>

<template>
  <main class="mx-auto max-w-content p-4">
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
        <label class="mb-1 block text-sm font-medium text-text" for="sched-start">
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
        <button
          :disabled="generateLoading"
          class="rounded bg-primary px-4 py-2 font-medium text-white hover:bg-primary-dark disabled:opacity-50"
          @click="generateSchedule(false)"
        >
          {{ nl.admin.schedule.generate }}
        </button>
        <template v-if="showOverwrite">
          <button
            class="rounded bg-error px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            @click="generateSchedule(true)"
          >
            {{ nl.common.confirm }}
          </button>
          <button
            class="rounded bg-secondary px-4 py-2 text-sm font-medium text-white hover:opacity-80"
            @click="showOverwrite = false; generateError = ''"
          >
            {{ nl.common.cancel }}
          </button>
        </template>
      </div>
    </section>

    <!-- Phase live toggles -->
    <section v-if="tournament && matches.length > 0" class="mb-6 rounded-lg bg-surface p-4 shadow-sm">
      <h2 class="mb-3 font-semibold text-text">{{ nl.admin.schedule.statusSection }}</h2>
      <div class="flex flex-wrap gap-2">
        <button
          v-if="tournament.type === 'POOLS' || tournament.type === 'COMBINATION'"
          :disabled="phaseToggleLoading"
          :class="tournament.poolScheduleLive ? 'bg-success' : 'bg-warning'"
          class="rounded px-4 py-2 text-sm font-medium text-white hover:opacity-80 disabled:opacity-50"
          @click="togglePhase('poolScheduleLive')"
        >
          {{ tournament.poolScheduleLive ? nl.admin.schedule.poolScheduleLive : nl.admin.schedule.poolScheduleDraft }}
        </button>
        <button
          v-if="tournament.type === 'KNOCKOUT' || tournament.type === 'COMBINATION'"
          :disabled="phaseToggleLoading"
          :class="tournament.koScheduleLive ? 'bg-success' : 'bg-warning'"
          class="rounded px-4 py-2 text-sm font-medium text-white hover:opacity-80 disabled:opacity-50"
          @click="togglePhase('koScheduleLive')"
        >
          {{ tournament.koScheduleLive ? nl.admin.schedule.koScheduleLive : nl.admin.schedule.koScheduleDraft }}
        </button>
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
          <label class="mb-1 block text-sm font-medium text-text">{{ nl.admin.schedule.shiftFrom }}</label>
          <select
            v-model="timeShiftFrom"
            class="w-full rounded border border-gray-300 px-3 py-2 text-text focus:border-primary focus:outline-none"
          >
            <option value="" disabled>—</option>
            <option
              v-for="time in [...new Set(matches.map((m) => m.startTime))].sort()"
              :key="time"
              :value="time"
            >
              {{ formatDateTime(time) }}
            </option>
          </select>
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium text-text">{{ nl.admin.schedule.shiftMinutes }}</label>
          <input
            v-model.number="timeShiftMinutes"
            type="number"
            class="w-full rounded border border-gray-300 px-3 py-2 text-text focus:border-primary focus:outline-none"
          >
        </div>
        <div class="flex items-end">
          <button
            :disabled="timeShiftLoading"
            class="rounded bg-primary px-4 py-2 font-medium text-white hover:bg-primary-dark disabled:opacity-50"
            @click="applyTimeShift"
          >
            {{ nl.admin.schedule.shiftApply }}
          </button>
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
    <section v-if="matches.length > 0" class="rounded-lg bg-surface p-4 shadow-sm">
      <!-- View mode tabs -->
      <div class="mb-4 flex gap-1 border-b border-gray-200">
        <button
          v-for="(label, mode) in { field: nl.admin.schedule.viewPerField, team: nl.admin.schedule.viewPerTeam, slot: nl.admin.schedule.viewPerSlot }"
          :key="mode"
          :class="viewMode === mode ? 'border-b-2 border-primary font-semibold text-primary' : 'text-text-light hover:text-text'"
          class="-mb-px px-4 py-2 text-sm"
          @click="viewMode = mode as typeof viewMode"
        >
          {{ label }}
        </button>
      </div>

      <!-- Conflict warning (persistent across all tabs) -->
      <div v-if="conflictingMatchIds.size > 0" class="mb-3 rounded-lg border border-error bg-error/10 px-4 py-2 text-sm font-medium text-error">
        {{ nl.admin.schedule.swapConflictWarning }}
      </div>

      <!-- Switch mode status -->
      <div v-if="switchMatchId" class="mb-3 space-y-1 rounded-lg border border-primary bg-primary/5 px-4 py-2 text-sm text-primary">
        <div>{{ nl.admin.schedule.switchModeHint }}</div>
        <div class="text-orange-500">{{ nl.admin.schedule.switchHighlightHint }}</div>
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
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-gray-200 text-left text-text-light">
                <th class="pb-1 pr-4">{{ nl.admin.schedule.timeLabel }}</th>
                <th class="pb-1 pr-4">{{ nl.admin.teams.nameLabel ?? 'Team A' }}</th>
                <th class="pb-1">{{ nl.admin.teams.nameLabel ?? 'Team B' }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="m in group.matches.sort((a, b) => a.startTime.localeCompare(b.startTime))"
                :key="m.id"
                :class="rowClass(m.id)"
                @click="clickMatch(m)"
              >
                <td class="py-2 pr-4 text-text-light">{{ formatDateTime(m.startTime) }}</td>
                <td class="py-2 pr-4 font-medium text-text">{{ m.teamA?.name ?? '?' }}</td>
                <td class="py-2 font-medium text-text">{{ m.teamB?.name ?? '?' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>

      <!-- View: Per team -->
      <template v-else-if="viewMode === 'team'">
        <div v-for="group in matchesByTeam" :key="group.teamName" class="mb-6">
          <h3 class="mb-2 font-semibold text-text">{{ group.teamName }}</h3>
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-gray-200 text-left text-text-light">
                <th class="pb-1 pr-4">{{ nl.admin.schedule.timeLabel }}</th>
                <th class="pb-1 pr-4">{{ nl.admin.schedule.fieldLabel }}</th>
                <th class="pb-1">{{ nl.admin.schedule.opponent }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="m in group.matches.sort((a, b) => a.startTime.localeCompare(b.startTime))"
                :key="m.id"
                :class="rowClass(m.id)"
                @click="clickMatch(m)"
              >
                <td class="py-2 pr-4 text-text-light">{{ formatDateTime(m.startTime) }}</td>
                <td class="py-2 pr-4 text-text">{{ m.field.name }}</td>
                <td class="py-2 font-medium text-text">
                  {{ m.teamA?.name === group.teamName ? m.teamB?.name : m.teamA?.name }}
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
                <th class="pb-1 pr-4 text-text-light">{{ nl.admin.schedule.timeLabel }}</th>
                <th v-for="f in fields" :key="f.id" class="pb-1 pr-4 font-semibold text-text">
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
                <td class="py-2 pr-4 text-text-light">{{ formatDateTime(slot) }}</td>
                <td
                  v-for="f in fields"
                  :key="f.id"
                  class="py-2 pr-4"
                >
                  <template v-if="getMatchForSlot(f.id, slot)">
                    <button
                      :class="cellClass(getMatchForSlot(f.id, slot)!.id)"
                      @click="clickMatch(getMatchForSlot(f.id, slot)!)"
                    >
                      {{ getMatchForSlot(f.id, slot)!.teamA?.name ?? '?' }} vs {{ getMatchForSlot(f.id, slot)!.teamB?.name ?? '?' }}
                    </button>
                  </template>
                  <span v-else class="text-text-light">—</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </section>

    <p v-else-if="matches.length === 0" class="text-text-light">
      {{ nl.common.noResults }}
    </p>
  </main>
</template>

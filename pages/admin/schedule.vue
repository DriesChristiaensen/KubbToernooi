<script setup lang="ts">
import { ref, onMounted } from "vue";
import { nl } from "~/i18n/nl";

definePageMeta({ middleware: "auth" });

interface Field {
  id: number;
  name: string;
}

interface Match {
  id: number;
  phase: string;
  round: number;
  startTime: string;
  status: string;
  field: Field;
  teamA: { id: number; name: string };
  teamB: { id: number; name: string };
  pool: { id: number; name: string } | null;
}

const matches = ref<Match[]>([]);
const fields = ref<Field[]>([]);
const generateLoading = ref(false);
const generateError = ref("");
const generateSuccess = ref("");
const showOverwrite = ref(false);

const editingMatch = ref<Match | null>(null);
const editFieldId = ref<number>(0);
const editStartTime = ref("");
const editError = ref("");
const editSuccess = ref("");
const conflictResult = ref<{ ok: boolean; conflicts: string[] } | null>(null);
const conflictLoading = ref(false);

const timeShiftFrom = ref("");
const timeShiftMinutes = ref<number>(0);
const timeShiftLoading = ref(false);
const timeShiftError = ref("");
const timeShiftSuccess = ref("");

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

async function generateSchedule(overwrite = false) {
  generateError.value = "";
  generateSuccess.value = "";
  showOverwrite.value = false;
  generateLoading.value = true;
  try {
    const result = await $fetch<{ generated: number }>("/api/admin/schedule/generate", {
      method: "POST",
      body: { overwrite },
    });
    generateSuccess.value = `${result.generated} ${nl.admin.schedule.generate}`;
    await fetchMatches();
  } catch (err: unknown) {
    const fetchErr = err as { data?: { data?: { error?: string; code?: number } } };
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

function startEditMatch(match: Match) {
  editingMatch.value = match;
  editFieldId.value = match.field.id;
  editStartTime.value = new Date(match.startTime).toISOString().slice(0, 16);
  editError.value = "";
  editSuccess.value = "";
  conflictResult.value = null;
}

function cancelEditMatch() {
  editingMatch.value = null;
  conflictResult.value = null;
}

async function checkConflict() {
  if (!editingMatch.value) return;
  conflictLoading.value = true;
  conflictResult.value = null;
  try {
    conflictResult.value = await $fetch<{ ok: boolean; conflicts: string[] }>(
      `/api/admin/schedule/conflict-check?matchId=${editingMatch.value.id}&fieldId=${editFieldId.value}&startTime=${new Date(editStartTime.value).toISOString()}`,
    );
  } catch {
    conflictResult.value = { ok: false, conflicts: [nl.common.error] };
  } finally {
    conflictLoading.value = false;
  }
}

async function saveMatch() {
  if (!editingMatch.value) return;
  editError.value = "";
  editSuccess.value = "";
  try {
    await $fetch(`/api/admin/schedule/matches/${editingMatch.value.id}` as string, {
      method: "PATCH",
      body: {
        fieldId: editFieldId.value,
        startTime: new Date(editStartTime.value).toISOString(),
      },
    });
    editSuccess.value = nl.admin.schedule.matchSaved;
    editingMatch.value = null;
    await fetchMatches();
  } catch (err: unknown) {
    const fetchErr = err as { data?: { data?: { error?: string } } };
    editError.value = fetchErr?.data?.data?.error || nl.common.error;
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
    const result = await $fetch<{ shifted: number }>("/api/admin/schedule/time-shift", {
      method: "POST",
      body: {
        fromTime: new Date(timeShiftFrom.value).toISOString(),
        offsetMinutes: timeShiftMinutes.value,
      },
    });
    timeShiftSuccess.value = `${result.shifted} wedstrijden verschoven`;
    await fetchMatches();
  } catch (err: unknown) {
    const fetchErr = err as { data?: { data?: { error?: string } } };
    timeShiftError.value = fetchErr?.data?.data?.error || nl.common.error;
  } finally {
    timeShiftLoading.value = false;
  }
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("nl-BE", { hour: "2-digit", minute: "2-digit" });
}

onMounted(async () => {
  await Promise.all([fetchMatches(), fetchFields()]);
});
</script>

<template>
  <div class="min-h-screen bg-background">
    <header class="flex items-center gap-4 bg-primary-dark p-4">
      <NuxtLink to="/admin" class="text-white hover:underline">
        &larr; {{ nl.common.back }}
      </NuxtLink>
      <h1 class="text-lg font-bold text-white">
        {{ nl.admin.schedule.title }}
      </h1>
    </header>

    <main class="mx-auto max-w-content p-4">
      <section class="mb-6 rounded-lg bg-surface p-4 shadow-sm">
        <h2 class="mb-4 font-semibold text-text">
          {{ nl.admin.schedule.generate }}
        </h2>

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

      <section class="mb-6 rounded-lg bg-surface p-4 shadow-sm">
        <h2 class="mb-4 font-semibold text-text">
          {{ nl.admin.schedule.timeShift }}
        </h2>
        <div class="grid gap-3 md:grid-cols-3">
          <div>
            <label class="mb-1 block text-sm font-medium text-text">
              {{ nl.admin.schedule.shiftFrom }}
            </label>
            <select
              v-model="timeShiftFrom"
              class="w-full rounded border border-gray-300 px-3 py-2 text-text focus:border-primary focus:outline-none"
            >
              <option value="" disabled>
                —
              </option>
              <option
                v-for="time in [...new Set(matches.map(m => m.startTime))].sort()"
                :key="time"
                :value="time"
              >
                {{ formatTime(time) }}
              </option>
            </select>
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium text-text">
              {{ nl.admin.schedule.shiftMinutes }}
            </label>
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

      <section class="rounded-lg bg-surface p-4 shadow-sm">
        <p v-if="editSuccess" class="mb-2 text-sm text-success">
          {{ editSuccess }}
        </p>

        <p v-if="matches.length === 0" class="text-text-light">
          {{ nl.common.noResults }}
        </p>

        <ul v-else class="divide-y divide-gray-200">
          <li
            v-for="match in matches"
            :key="match.id"
            class="py-3"
          >
            <template v-if="editingMatch?.id === match.id">
              <div class="flex flex-col gap-3 rounded-lg border border-primary p-3">
                <div class="grid gap-3 md:grid-cols-2">
                  <div>
                    <label class="mb-1 block text-sm font-medium text-text">
                      {{ nl.admin.schedule.fieldLabel }}
                    </label>
                    <select
                      v-model="editFieldId"
                      class="w-full rounded border border-gray-300 px-3 py-2 text-text focus:border-primary focus:outline-none"
                    >
                      <option v-for="f in fields" :key="f.id" :value="f.id">
                        {{ f.name }}
                      </option>
                    </select>
                  </div>
                  <div>
                    <label class="mb-1 block text-sm font-medium text-text">
                      {{ nl.admin.schedule.timeLabel }}
                    </label>
                    <input
                      v-model="editStartTime"
                      type="datetime-local"
                      class="w-full rounded border border-gray-300 px-3 py-2 text-text focus:border-primary focus:outline-none"
                    >
                  </div>
                </div>

                <div
                  v-if="conflictResult"
                  :class="conflictResult.ok ? 'text-success' : 'text-error'"
                  class="text-sm"
                >
                  <span v-if="conflictResult.ok">{{ nl.admin.schedule.noConflict }}</span>
                  <ul v-else>
                    <li v-for="c in conflictResult.conflicts" :key="c">{{ c }}</li>
                  </ul>
                </div>

                <p v-if="editError" class="text-sm text-error">
                  {{ editError }}
                </p>

                <div class="flex flex-wrap gap-2">
                  <button
                    :disabled="conflictLoading"
                    class="rounded bg-secondary px-3 py-1 text-sm text-white hover:opacity-80 disabled:opacity-50"
                    @click="checkConflict"
                  >
                    {{ nl.admin.schedule.checkConflict }}
                  </button>
                  <button
                    class="rounded bg-success px-3 py-1 text-sm text-white hover:opacity-80"
                    @click="saveMatch"
                  >
                    {{ nl.admin.schedule.saveMatch }}
                  </button>
                  <button
                    class="rounded bg-gray-400 px-3 py-1 text-sm text-white hover:opacity-80"
                    @click="cancelEditMatch"
                  >
                    {{ nl.common.cancel }}
                  </button>
                </div>
              </div>
            </template>
            <template v-else>
              <div class="flex items-center justify-between gap-2">
                <div class="flex flex-col gap-1 md:flex-row md:items-center md:gap-4">
                  <span class="text-sm font-medium text-text-light">
                    {{ formatTime(match.startTime) }}
                  </span>
                  <span class="font-semibold text-text">
                    {{ match.teamA.name }} vs {{ match.teamB.name }}
                  </span>
                  <span class="text-sm text-text-light">
                    {{ match.field.name }}
                  </span>
                  <span v-if="match.pool" class="text-sm text-text-light">
                    {{ match.pool.name }}
                  </span>
                </div>
                <button
                  class="rounded bg-primary px-2 py-1 text-sm text-white hover:bg-primary-dark"
                  @click="startEditMatch(match)"
                >
                  {{ nl.common.edit }}
                </button>
              </div>
            </template>
          </li>
        </ul>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { VueDatePicker } from "@vuepic/vue-datepicker";
import { nlBE } from "date-fns/locale";
import { nl } from "~/i18n/nl";

definePageMeta({ middleware: "auth", layout: "admin" });

interface Tournament {
  id: string;
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

interface InactiveTournament {
  id: string;
  name: string;
  type: string;
  status: string;
  createdAt: string;
}

const tournament = ref<Tournament | null>(null);
const inactiveTournaments = ref<InactiveTournament[]>([]);
const isLoading = ref(true);
const showWizard = ref(false);
const showReplaceConfirm = ref(false);
const showRestoreScreen = ref(false);

const wizardStep = ref(1);
const createError = ref("");
const createLoading = ref(false);

const publishLoading = ref(false);
const publishError = ref("");

const restoreError = ref("");
const restoreLoading = ref<string | null>(null);
const deleteLoading = ref<string | null>(null);

const startDateTimePicker = ref<Date | null>(null);
const touched = ref({ name: false, startTime: false, matchDuration: false, breakTime: false });
const fieldErrors = ref({ name: '' });

const form = ref({
  name: "",
  type: "COMBINATION",
  matchDuration: 15,
  breakTime: 5,
  pointsWin: 3,
  pointsDraw: 1,
  pointsLoss: 0,
  fieldCount: 4,
});

const typeOptions = [
  { value: "POOLS", label: nl.admin.tournament.typePool },
  { value: "KNOCKOUT", label: nl.admin.tournament.typeKnockout },
  { value: "COMBINATION", label: nl.admin.tournament.typeCombination },
];

const breakTimeValid = computed(() =>
  Number.isInteger(form.value.breakTime) && form.value.breakTime >= 0,
);

const step1Valid = computed(() =>
  form.value.name.trim().length > 0
  && !fieldErrors.value.name
  && startDateTimePicker.value !== null
  && form.value.matchDuration >= 1
  && breakTimeValid.value,
);

const step2Valid = computed(() => form.value.fieldCount >= 1);

async function fetchTournament() {
  try {
    tournament.value = await $fetch<Tournament>("/api/admin/tournament");
  } catch {
    tournament.value = null;
  }
}

async function fetchInactive() {
  try {
    inactiveTournaments.value = await $fetch<InactiveTournament[]>("/api/admin/tournaments/inactive");
  } catch {
    inactiveTournaments.value = [];
  }
}

function openWizard() {
  if (tournament.value) {
    showReplaceConfirm.value = true;
  } else {
    startWizard();
  }
}

function startWizard() {
  showReplaceConfirm.value = false;
  wizardStep.value = 1;
  createError.value = "";
  startDateTimePicker.value = null;
  touched.value = { name: false, startTime: false, matchDuration: false, breakTime: false };
  fieldErrors.value = { name: '' };
  showWizard.value = true;
}

function cancelWizard() {
  showWizard.value = false;
  createError.value = "";
  touched.value = { name: false, startTime: false, matchDuration: false, breakTime: false };
  fieldErrors.value = { name: '' };
}

function goToStep2() {
  touched.value.name = true;
  touched.value.startTime = true;
  touched.value.matchDuration = true;
  touched.value.breakTime = true;
  if (step1Valid.value) wizardStep.value = 2;
}

function touchName() {
  touched.value.name = true;
  const trimmed = form.value.name.trim().toLowerCase();
  const existing = [
    ...(tournament.value ? [tournament.value.name] : []),
    ...inactiveTournaments.value.map(t => t.name),
  ];
  if (trimmed && existing.some(n => n.toLowerCase() === trimmed)) {
    fieldErrors.value.name = nl.admin.tournament.duplicateName;
  } else {
    fieldErrors.value.name = '';
  }
}

async function createTournament() {
  createError.value = "";
  createLoading.value = true;
  try {
    tournament.value = await $fetch<Tournament>("/api/admin/tournament", {
      method: "POST",
      body: {
        name: form.value.name.trim(),
        type: form.value.type,
        startTime: startDateTimePicker.value?.toISOString() ?? '',
        matchDuration: form.value.matchDuration,
        breakTime: form.value.breakTime,
        pointsWin: form.value.pointsWin,
        pointsDraw: form.value.pointsDraw,
        pointsLoss: form.value.pointsLoss,
        fieldCount: form.value.fieldCount,
      },
    });
    showWizard.value = false;
    await fetchInactive();
  } catch (err: unknown) {
    const fetchErr = err as { data?: { data?: { error?: string; field?: string } } };
    const errField = fetchErr?.data?.data?.field;
    const errMsg = fetchErr?.data?.data?.error || nl.common.error;
    if (errField === 'name') {
      fieldErrors.value.name = errMsg;
      wizardStep.value = 1;
    } else {
      createError.value = errMsg;
    }
  } finally {
    createLoading.value = false;
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

async function restoreTournament(id: string) {
  if (!confirm(nl.admin.tournament.restoreConfirm)) return;
  restoreError.value = "";
  restoreLoading.value = id;
  try {
    await $fetch(`/api/admin/tournaments/${id}/restore`, { method: "POST" });
    await fetchTournament();
    await fetchInactive();
  } catch (err: unknown) {
    const fetchErr = err as { data?: { data?: { error?: string } } };
    restoreError.value = fetchErr?.data?.data?.error || nl.common.error;
  } finally {
    restoreLoading.value = null;
  }
}

async function deleteTournament(id: string) {
  if (!confirm(nl.admin.tournament.deleteConfirm)) return;
  restoreError.value = "";
  deleteLoading.value = id;
  try {
    await $fetch(`/api/admin/tournaments/${id}`, { method: "DELETE" });
    await fetchInactive();
  } catch (err: unknown) {
    const fetchErr = err as { data?: { data?: { error?: string } } };
    restoreError.value = fetchErr?.data?.data?.error || nl.common.error;
  } finally {
    deleteLoading.value = null;
  }
}

onMounted(async () => {
  await Promise.all([fetchTournament(), fetchInactive()]);
  isLoading.value = false;
});
</script>

<template>
  <main class="mx-auto max-w-content p-4">
    <div class="mb-4 flex items-center gap-3">
      <NuxtLink to="/admin" class="text-sm text-text-light hover:text-primary">
        &larr; {{ nl.common.back }}
      </NuxtLink>
      <h1 class="text-lg font-bold text-text">
        {{ nl.admin.tournament.title }}
      </h1>
    </div>

    <p v-if="isLoading" class="text-text">
      {{ nl.common.loading }}
    </p>

    <template v-else>
      <!-- Replace confirmation -->
      <div
        v-if="showReplaceConfirm"
        class="mb-6 rounded-lg border border-warning bg-warning/10 p-4"
      >
        <p class="mb-3 font-medium text-text">
          {{ nl.admin.tournament.replaceConfirm }}
        </p>
        <div class="flex gap-2">
          <button
            class="rounded bg-error px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            @click="startWizard"
          >
            {{ nl.common.confirm }}
          </button>
          <button
            class="rounded bg-secondary px-4 py-2 text-sm font-medium text-white hover:opacity-80"
            @click="showReplaceConfirm = false"
          >
            {{ nl.common.cancel }}
          </button>
        </div>
      </div>

      <!-- Creation wizard -->
      <div v-if="showWizard" class="mb-6 rounded-lg bg-surface p-4 shadow-sm">
        <div class="mb-4 flex items-center gap-2">
          <span
            v-for="step in 2"
            :key="step"
            :class="wizardStep >= step ? 'bg-primary text-white' : 'bg-gray-200 text-text-light'"
            class="flex h-7 w-7 items-center justify-center rounded-full text-sm font-medium"
          >
            {{ step }}
          </span>
          <span class="ml-2 font-semibold text-text">
            {{ wizardStep === 1 ? nl.admin.tournament.wizardStep1 : nl.admin.tournament.wizardStep2 }}
          </span>
        </div>

        <!-- Step 1: Tournament settings -->
        <template v-if="wizardStep === 1">
          <div class="mb-3">
            <label class="mb-1 block text-sm font-medium text-text" for="t-name">
              {{ nl.admin.tournament.name }}
            </label>
            <input
              id="t-name"
              v-model="form.name"
              type="text"
              required
              class="w-full rounded border border-gray-300 px-3 py-2 text-text focus:border-primary focus:outline-none"
              @blur="touchName"
            >
            <p v-if="touched.name && !form.name.trim()" class="mt-1 text-xs text-error">{{ nl.admin.tournament.nameRequired }}</p>
            <p v-if="fieldErrors.name" class="mt-1 text-xs text-error">{{ fieldErrors.name }}</p>
          </div>

          <div class="mb-3">
            <label class="mb-1 block text-sm font-medium text-text" for="t-type">
              {{ nl.admin.tournament.type }}
            </label>
            <select
              id="t-type"
              v-model="form.type"
              class="w-full rounded border border-gray-300 px-3 py-2 text-text focus:border-primary focus:outline-none"
            >
              <option v-for="opt in typeOptions" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </option>
            </select>
          </div>

          <div class="mb-3">
            <label class="mb-1 block text-sm font-medium text-text">
              {{ nl.admin.tournament.startTime }}
            </label>
            <ClientOnly>
              <VueDatePicker
                v-model="startDateTimePicker"
                :formats="{ input: 'dd/MM/yyyy HH:mm' }"
                :enable-time-picker="true"
                :is24="true"
                auto-apply
                :locale="nlBE"
                @closed="touched.startTime = true"
              />
            </ClientOnly>
            <p v-if="touched.startTime && !startDateTimePicker" class="mt-1 text-xs text-error">{{ nl.admin.tournament.startTimeRequired }}</p>
          </div>

          <div class="mb-3 grid gap-3 md:grid-cols-2">
            <div>
              <label class="mb-1 block text-sm font-medium text-text">
                {{ nl.admin.tournament.matchDuration }}
              </label>
              <input
                v-model.number="form.matchDuration"
                type="number"
                min="1"
                class="w-full rounded border border-gray-300 px-3 py-2 text-text focus:border-primary focus:outline-none"
                @blur="touched.matchDuration = true"
              >
              <p v-if="touched.matchDuration && form.matchDuration < 1" class="mt-1 text-xs text-error">{{ nl.admin.tournament.matchDurationRequired }}</p>
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium text-text">
                {{ nl.admin.tournament.breakTime }}
              </label>
              <input
                v-model.number="form.breakTime"
                type="number"
                min="0"
                class="w-full rounded border border-gray-300 px-3 py-2 text-text focus:border-primary focus:outline-none"
                @blur="touched.breakTime = true"
              >
              <p v-if="touched.breakTime && !breakTimeValid" class="mt-1 text-xs text-error">{{ nl.admin.tournament.breakTimeInvalid }}</p>
            </div>
          </div>

          <div class="mb-4 grid gap-3 md:grid-cols-3">
            <div>
              <label class="mb-1 block text-sm font-medium text-text">{{ nl.admin.tournament.pointsWin }}</label>
              <input v-model.number="form.pointsWin" type="number" class="w-full rounded border border-gray-300 px-3 py-2 text-text focus:border-primary focus:outline-none">
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium text-text">{{ nl.admin.tournament.pointsDraw }}</label>
              <input v-model.number="form.pointsDraw" type="number" class="w-full rounded border border-gray-300 px-3 py-2 text-text focus:border-primary focus:outline-none">
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium text-text">{{ nl.admin.tournament.pointsLoss }}</label>
              <input v-model.number="form.pointsLoss" type="number" class="w-full rounded border border-gray-300 px-3 py-2 text-text focus:border-primary focus:outline-none">
            </div>
          </div>

          <div class="flex gap-2">
            <button
              class="rounded bg-primary px-4 py-2 font-medium text-white hover:bg-primary-dark disabled:opacity-50"
              @click="goToStep2"
            >
              {{ nl.admin.tournament.wizardNext }}
            </button>
            <button
              class="rounded bg-secondary px-4 py-2 font-medium text-white hover:opacity-80"
              @click="cancelWizard"
            >
              {{ nl.common.cancel }}
            </button>
          </div>
        </template>

        <!-- Step 2: Fields -->
        <template v-if="wizardStep === 2">
          <div class="mb-4">
            <label class="mb-1 block text-sm font-medium text-text" for="t-fields">
              {{ nl.admin.tournament.fieldCount }}
            </label>
            <input
              id="t-fields"
              v-model.number="form.fieldCount"
              type="number"
              min="1"
              class="w-full rounded border border-gray-300 px-3 py-2 text-text focus:border-primary focus:outline-none"
            >
          </div>

          <p v-if="createError" class="mb-2 text-sm text-error">
            {{ createError }}
          </p>

          <div class="flex gap-2">
            <button
              class="rounded bg-secondary px-4 py-2 font-medium text-white hover:opacity-80"
              @click="wizardStep = 1"
            >
              {{ nl.admin.tournament.wizardBack }}
            </button>
            <button
              :disabled="!step2Valid || createLoading"
              class="rounded bg-success px-4 py-2 font-medium text-white hover:opacity-80 disabled:opacity-50"
              @click="createTournament"
            >
              {{ nl.admin.tournament.wizardCreate }}
            </button>
            <button
              class="rounded bg-secondary px-4 py-2 font-medium text-white hover:opacity-80"
              @click="cancelWizard"
            >
              {{ nl.common.cancel }}
            </button>
          </div>
        </template>
      </div>

      <!-- Current tournament info -->
      <section v-if="tournament && !showWizard" class="mb-6 rounded-lg bg-surface p-4 shadow-sm">
        <h2 class="mb-3 font-semibold text-text">
          {{ nl.admin.tournament.currentTournament }}
        </h2>
        <dl class="mb-4 grid gap-2 text-sm md:grid-cols-2">
          <div><dt class="text-text-light">{{ nl.admin.tournament.name }}</dt><dd class="font-medium text-text">{{ tournament.name }}</dd></div>
          <div><dt class="text-text-light">{{ nl.admin.tournament.type }}</dt><dd class="font-medium text-text">{{ typeOptions.find(o => o.value === tournament?.type)?.label }}</dd></div>
          <div><dt class="text-text-light">{{ nl.admin.tournament.matchDuration }}</dt><dd class="font-medium text-text">{{ tournament.matchDuration }} min</dd></div>
          <div><dt class="text-text-light">{{ nl.admin.tournament.breakTime }}</dt><dd class="font-medium text-text">{{ tournament.breakTime }} min</dd></div>
          <div><dt class="text-text-light">{{ nl.admin.tournament.pointsWin }} / {{ nl.admin.tournament.pointsDraw }} / {{ nl.admin.tournament.pointsLoss }}</dt><dd class="font-medium text-text">{{ tournament.pointsWin }} / {{ tournament.pointsDraw }} / {{ tournament.pointsLoss }}</dd></div>
          <div><dt class="text-text-light">{{ nl.admin.tournament.statusLabel }}</dt><dd class="font-medium" :class="tournament.status === 'LIVE' ? 'text-success' : 'text-warning'">{{ tournament.status === 'LIVE' ? nl.admin.tournament.statusLive : nl.admin.tournament.statusDraft }}</dd></div>
        </dl>
        <div class="flex flex-wrap gap-2">
          <button
            :disabled="publishLoading"
            :class="tournament.status === 'LIVE' ? 'bg-secondary' : 'bg-success'"
            class="rounded px-4 py-2 font-medium text-white hover:opacity-80 disabled:opacity-50"
            @click="togglePublish"
          >
            {{ tournament.status === 'LIVE' ? nl.admin.tournament.unpublish : nl.admin.tournament.publish }}
          </button>
          <button
            class="rounded bg-primary px-4 py-2 font-medium text-white hover:bg-primary-dark"
            @click="openWizard"
          >
            {{ nl.admin.tournament.createNew }}
          </button>
        </div>
        <p v-if="publishError" class="mt-2 text-sm text-error">
          {{ publishError }}
        </p>
      </section>

      <!-- No tournament -->
      <div v-if="!tournament && !showWizard" class="mb-6 rounded-lg bg-surface p-4 shadow-sm">
        <p class="mb-3 text-text-light">
          {{ nl.admin.tournament.notFound }}
        </p>
        <button
          class="rounded bg-primary px-4 py-2 font-medium text-white hover:bg-primary-dark"
          @click="openWizard"
        >
          {{ nl.admin.tournament.createNew }}
        </button>
      </div>

      <!-- Restore screen toggle -->
      <div v-if="inactiveTournaments.length > 0 || showRestoreScreen" class="rounded-lg bg-surface p-4 shadow-sm">
        <button
          class="mb-3 flex items-center gap-2 font-semibold text-text hover:text-primary"
          @click="showRestoreScreen = !showRestoreScreen"
        >
          {{ nl.admin.tournament.restoreTitle }}
          <span class="rounded-full bg-gray-200 px-2 py-0.5 text-xs text-text-light">{{ inactiveTournaments.length }}</span>
        </button>

        <template v-if="showRestoreScreen">
          <p v-if="inactiveTournaments.length === 0" class="text-sm text-text-light">
            {{ nl.admin.tournament.noInactive }}
          </p>
          <p v-if="restoreError" class="mb-2 text-sm text-error">
            {{ restoreError }}
          </p>
          <ul class="space-y-2">
            <li
              v-for="t in inactiveTournaments"
              :key="t.id"
              class="flex items-center justify-between rounded border border-gray-200 p-3"
            >
              <div>
                <p class="font-medium text-text">{{ t.name }}</p>
                <p class="text-xs text-text-light">{{ typeOptions.find(o => o.value === t.type)?.label }}</p>
              </div>
              <div class="flex gap-2">
                <button
                  :disabled="restoreLoading === t.id"
                  class="rounded bg-primary px-3 py-1 text-sm text-white hover:bg-primary-dark disabled:opacity-50"
                  @click="restoreTournament(t.id)"
                >
                  {{ nl.admin.tournament.restoreButton }}
                </button>
                <button
                  :disabled="deleteLoading === t.id"
                  class="rounded bg-error px-3 py-1 text-sm text-white hover:bg-red-700 disabled:opacity-50"
                  @click="deleteTournament(t.id)"
                >
                  {{ nl.admin.tournament.deleteButton }}
                </button>
              </div>
            </li>
          </ul>
        </template>
      </div>
    </template>
  </main>
</template>

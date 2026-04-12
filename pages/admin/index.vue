<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { nl } from "~/i18n/nl";

definePageMeta({
  middleware: ["auth", "admin-tournament-guard"],
  layout: "admin",
});

const tournamentType = ref<string | null>(null);
const teamCount = ref(0);
const fieldCount = ref(0);
const poolCount = ref(0);

const hasTournament = computed(() => tournamentType.value !== null);
const isPoolBased = computed(
  () =>
    tournamentType.value === "POOLS" || tournamentType.value === "COMBINATION",
);
const isKoBased = computed(
  () =>
    tournamentType.value === "KNOCKOUT" ||
    tournamentType.value === "COMBINATION",
);
const hasEnoughTeams = computed(() => teamCount.value >= 2);
const hasField = computed(() => fieldCount.value >= 1);
const hasPool = computed(() => poolCount.value >= 1);

const d = nl.admin.dashboardDisabled;

const teamsEnabled = computed(() => hasTournament.value);
const fieldsEnabled = computed(() => hasTournament.value);
const poolsEnabled = computed(() => isPoolBased.value && hasEnoughTeams.value);
const koEnabled = computed(
  () => isKoBased.value && hasEnoughTeams.value && hasField.value,
);
const scheduleEnabled = computed(
  () =>
    isPoolBased.value &&
    hasEnoughTeams.value &&
    hasField.value &&
    hasPool.value,
);

const teamsReason = computed(() =>
  !hasTournament.value ? d.needsTournament : "",
);
const fieldsReason = computed(() =>
  !hasTournament.value ? d.needsTournament : "",
);
const poolsReason = computed(() => {
  if (!hasTournament.value) return d.needsTournament;
  if (!isPoolBased.value) return d.needsPoolType;
  if (!hasEnoughTeams.value) return d.needsTeams;
  return "";
});
const koReason = computed(() => {
  if (!hasTournament.value) return d.needsTournament;
  if (!isKoBased.value) return d.needsKoType;
  if (!hasEnoughTeams.value) return d.needsTeams;
  if (!hasField.value) return d.needsFields;
  return "";
});
const scheduleReason = computed(() => {
  if (!hasTournament.value) return d.needsTournament;
  if (!isPoolBased.value) return d.needsPoolType;
  if (!hasEnoughTeams.value) return d.needsTeams;
  if (!hasField.value) return d.needsFields;
  if (!hasPool.value) return d.needsPool;
  return "";
});

onMounted(async () => {
  try {
    const data = await $fetch("/api/admin/dashboard");
    tournamentType.value = data.type;
    teamCount.value = data.teamCount;
    fieldCount.value = data.fieldCount;
    poolCount.value = data.poolCount;
  } catch {
    // Dashboard data unavailable; buttons stay in default state
  }
});

const exportLoading = ref(false);
const exportError = ref("");

const importError = ref("");
const importSuccess = ref("");
const importPassword = ref("");
const importNeedsPassword = ref(false);
const importLoading = ref(false);
let pendingImportData: unknown = null;

async function downloadExport() {
  exportLoading.value = true;
  exportError.value = "";
  try {
    const data = await $fetch("/api/admin/export");
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "kubb-toernooi-export.json";
    a.click();
    URL.revokeObjectURL(url);
  } catch (err: unknown) {
    const fetchErr = err as { data?: { data?: { error?: string } } };
    exportError.value = fetchErr?.data?.data?.error || nl.common.error;
  } finally {
    exportLoading.value = false;
  }
}

async function submitImport(password?: string) {
  importError.value = "";
  importSuccess.value = "";
  importLoading.value = true;
  try {
    const body: Record<string, unknown> = { data: pendingImportData };
    if (password) body.password = password;
    await $fetch("/api/admin/import", { method: "POST", body });
    importSuccess.value = nl.admin.import.button;
    importNeedsPassword.value = false;
    importPassword.value = "";
    pendingImportData = null;
  } catch (err: unknown) {
    const fetchErr = err as {
      data?: { data?: { error?: string; code?: number } };
    };
    if (fetchErr?.data?.data?.code === "existing_data_overwrite_required") {
      importNeedsPassword.value = true;
      importError.value = nl.admin.import.existingDataWarning;
    } else {
      importError.value = fetchErr?.data?.data?.error || nl.common.error;
    }
  } finally {
    importLoading.value = false;
  }
}

function handleImportFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      pendingImportData = JSON.parse(e.target?.result as string);
      await submitImport();
    } catch {
      importError.value = nl.common.error;
    }
  };
  reader.readAsText(file);
}
</script>

<template>
  <main class="mx-auto max-w-content p-4">
    <h1 class="mb-4 text-heading text-text">
      {{ nl.admin.dashboard }}
    </h1>
    <!-- Setup navigation grid: row 1=tournament+refs, row 2=teams+fields, row 3=pools+ko, row 4=schedule -->
    <nav class="grid grid-cols-2 gap-4">
      <!-- Row 1: Tournament (always enabled) -->
      <NuxtLink
        to="/admin/tournament"
        class="rounded-lg border border-gray-200 bg-surface p-6 shadow-sm transition-shadow hover:shadow-md"
      >
        <h2 class="text-subheading text-text">
          {{ nl.admin.tournament.title }}
        </h2>
      </NuxtLink>

      <!-- Row 1: Referees (always enabled) -->
      <NuxtLink
        to="/admin/referees"
        class="rounded-lg border border-gray-200 bg-surface p-6 shadow-sm transition-shadow hover:shadow-md"
      >
        <h2 class="text-subheading text-text">{{ nl.admin.referees.title }}</h2>
      </NuxtLink>

      <!-- Row 2: Teams -->
      <NuxtLink
        v-if="teamsEnabled"
        to="/admin/teams"
        class="rounded-lg border border-gray-200 bg-surface p-6 shadow-sm transition-shadow hover:shadow-md"
      >
        <h2 class="text-subheading text-text">{{ nl.admin.teams.title }}</h2>
      </NuxtLink>
      <div
        v-else
        aria-disabled="true"
        class="group relative cursor-not-allowed rounded-lg border border-gray-200 bg-surface p-6 shadow-sm"
      >
        <h2 class="text-subheading text-text opacity-40">
          {{ nl.admin.teams.title }}
        </h2>
        <div
          class="pointer-events-none invisible absolute bottom-full left-0 z-10 mb-2 max-w-xs rounded bg-gray-800 px-3 py-1.5 text-xs text-white group-hover:visible"
        >
          {{ teamsReason }}
        </div>
      </div>

      <!-- Row 2: Fields -->
      <NuxtLink
        v-if="fieldsEnabled"
        to="/admin/fields"
        class="rounded-lg border border-gray-200 bg-surface p-6 shadow-sm transition-shadow hover:shadow-md"
      >
        <h2 class="text-subheading text-text">{{ nl.admin.fields.title }}</h2>
      </NuxtLink>
      <div
        v-else
        aria-disabled="true"
        class="group relative cursor-not-allowed rounded-lg border border-gray-200 bg-surface p-6 shadow-sm"
      >
        <h2 class="text-subheading text-text opacity-40">
          {{ nl.admin.fields.title }}
        </h2>
        <div
          class="pointer-events-none invisible absolute bottom-full left-0 z-10 mb-2 max-w-xs rounded bg-gray-800 px-3 py-1.5 text-xs text-white group-hover:visible"
        >
          {{ fieldsReason }}
        </div>
      </div>

      <!-- Row 3: Pools -->
      <NuxtLink
        v-if="poolsEnabled"
        to="/admin/pools"
        class="rounded-lg border border-gray-200 bg-surface p-6 shadow-sm transition-shadow hover:shadow-md"
      >
        <h2 class="text-subheading text-text">{{ nl.admin.pools.title }}</h2>
      </NuxtLink>
      <div
        v-else
        aria-disabled="true"
        class="group relative cursor-not-allowed rounded-lg border border-gray-200 bg-surface p-6 shadow-sm"
      >
        <h2 class="text-subheading text-text opacity-40">
          {{ nl.admin.pools.title }}
        </h2>
        <div
          class="pointer-events-none invisible absolute bottom-full left-0 z-10 mb-2 max-w-xs rounded bg-gray-800 px-3 py-1.5 text-xs text-white group-hover:visible"
        >
          {{ poolsReason }}
        </div>
      </div>

      <div/>

      <!-- Row 4: Schedule -->
      <NuxtLink
        v-if="scheduleEnabled"
        to="/admin/schedule"
        class="rounded-lg border border-gray-200 bg-surface p-6 shadow-sm transition-shadow hover:shadow-md"
      >
        <h2 class="text-subheading text-text">{{ nl.admin.schedule.title }}</h2>
      </NuxtLink>
      <div
        v-else
        aria-disabled="true"
        class="group relative cursor-not-allowed rounded-lg border border-gray-200 bg-surface p-6 shadow-sm"
      >
        <h2 class="text-subheading text-text opacity-40">
          {{ nl.admin.schedule.title }}
        </h2>
        <div
          class="pointer-events-none invisible absolute bottom-full left-0 z-10 mb-2 max-w-xs rounded bg-gray-800 px-3 py-1.5 text-xs text-white group-hover:visible"
        >
          {{ scheduleReason }}
        </div>
      </div>

      <!-- Row 3: KO-bracket -->
      <NuxtLink
        v-if="koEnabled"
        to="/admin/ko-bracket"
        class="rounded-lg border border-gray-200 bg-surface p-6 shadow-sm transition-shadow hover:shadow-md"
      >
        <h2 class="text-subheading text-text">
          {{ nl.admin.koBracket.title }}
        </h2>
      </NuxtLink>
      <div
        v-else
        aria-disabled="true"
        class="group relative cursor-not-allowed rounded-lg border border-gray-200 bg-surface p-6 shadow-sm"
      >
        <h2 class="text-subheading text-text opacity-40">
          {{ nl.admin.koBracket.title }}
        </h2>
        <div
          class="pointer-events-none invisible absolute bottom-full left-0 z-10 mb-2 max-w-xs rounded bg-gray-800 px-3 py-1.5 text-xs text-white group-hover:visible"
        >
          {{ koReason }}
        </div>
      </div>
    </nav>

    <hr class="mt-6 border-gray-200">

    <div class="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
      <!-- Export -->
      <div class="rounded-lg border border-gray-200 bg-surface p-4 shadow-sm">
        <h2 class="mb-3 font-semibold text-text">
          {{ nl.admin.export.title }}
        </h2>
        <p v-if="exportError" class="mb-2 text-sm text-error">
          {{ exportError }}
        </p>
        <div class="group relative inline-block">
          <button
            :disabled="exportLoading"
            class="rounded bg-primary px-4 py-2 font-medium text-white hover:bg-primary-dark disabled:opacity-50"
            @click="downloadExport"
          >
            {{ nl.admin.export.button }}
          </button>
          <div v-if="exportLoading" class="invisible absolute bottom-full left-1/2 z-10 mb-1 w-max max-w-xs -translate-x-1/2 rounded bg-gray-800 px-2 py-1 text-xs text-white group-hover:visible">
            {{ nl.common.submitting }}
          </div>
        </div>
      </div>

      <!-- Import -->
      <div class="rounded-lg border border-gray-200 bg-surface p-4 shadow-sm">
        <h2 class="mb-3 font-semibold text-text">
          {{ nl.admin.import.title }}
        </h2>

        <p v-if="importError" class="mb-2 text-sm text-error">
          {{ importError }}
        </p>
        <p v-if="importSuccess" class="mb-2 text-sm text-success">
          {{ importSuccess }}
        </p>

        <label
          class="inline-block cursor-pointer rounded bg-primary px-4 py-2 font-medium text-white hover:bg-primary-dark"
        >
          {{ nl.admin.import.button }}
          <input
            type="file"
            accept=".json"
            class="hidden"
            @change="handleImportFile"
          >
        </label>

        <template v-if="importNeedsPassword">
          <p class="mt-3 mb-2 text-sm text-text">
            {{ nl.admin.import.confirmPassword }}
          </p>
          <div class="flex gap-2">
            <input
              v-model="importPassword"
              type="password"
              :placeholder="nl.auth.password"
              class="rounded border border-gray-300 px-3 py-2 text-text focus:border-primary focus:outline-none"
            >
            <div class="group relative">
              <button
                :disabled="importLoading"
                class="rounded bg-error px-4 py-2 font-medium text-white hover:bg-red-700 disabled:opacity-50"
                @click="submitImport(importPassword)"
              >
                {{ nl.common.confirm }}
              </button>
              <div v-if="importLoading" class="invisible absolute bottom-full left-1/2 z-10 mb-1 w-max max-w-xs -translate-x-1/2 rounded bg-gray-800 px-2 py-1 text-xs text-white group-hover:visible">
                {{ nl.common.importing }}
              </div>
            </div>
          </div>
        </template>
      </div>

      <!-- Regels -->
      <div class="rounded-lg border border-gray-200 bg-surface p-4 shadow-sm">
        <h2 class="mb-3 font-semibold text-text">
          {{ nl.admin.spelregels.title }}
        </h2>
        <NuxtLink
          to="/admin/spelregels"
          class="inline-block rounded bg-primary px-4 py-2 font-medium text-white hover:bg-primary-dark"
        >
          {{ nl.admin.spelregels.button }}
        </NuxtLink>
      </div>

      <!-- Prijzen -->
      <div class="rounded-lg border border-gray-200 bg-surface p-4 shadow-sm">
        <h2 class="mb-3 font-semibold text-text">
          {{ nl.admin.prijslijst.title }}
        </h2>
        <NuxtLink
          to="/admin/prijslijst"
          class="inline-block rounded bg-primary px-4 py-2 font-medium text-white hover:bg-primary-dark"
        >
          {{ nl.admin.prijslijst.button }}
        </NuxtLink>
      </div>
    </div>
  </main>
</template>

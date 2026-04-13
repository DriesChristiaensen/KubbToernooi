<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { nl } from "~/i18n/nl";

definePageMeta({
  middleware: ["auth", "admin-tournament-guard"],
  layout: "admin",
});

useHead({ title: 'Admin Dashboard | Kubb 2026' })

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

      <!-- Row 3: Scores (always enabled) -->
      <NuxtLink
        to="/admin/scores"
        class="rounded-lg border border-gray-200 bg-surface p-6 shadow-sm transition-shadow hover:shadow-md"
      >
        <h2 class="text-subheading text-text">{{ nl.admin.scores.title }}</h2>
      </NuxtLink>

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

    <div class="mt-6 grid grid-cols-2 gap-4">
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

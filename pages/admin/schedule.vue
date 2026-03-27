<script setup lang="ts">
import { ref, onMounted } from "vue";
import { nl } from "~/i18n/nl";

definePageMeta({ middleware: "auth" });

interface Match {
  id: number;
  phase: string;
  round: number;
  startTime: string;
  status: string;
  field: { id: number; name: string };
  teamA: { id: number; name: string };
  teamB: { id: number; name: string };
  pool: { id: number; name: string } | null;
}

const matches = ref<Match[]>([]);
const generateLoading = ref(false);
const generateError = ref("");
const generateSuccess = ref("");
const showOverwrite = ref(false);

async function fetchMatches() {
  try {
    matches.value = await $fetch<Match[]>("/api/admin/schedule/matches");
  } catch {
    generateError.value = nl.common.error;
  }
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

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("nl-BE", { hour: "2-digit", minute: "2-digit" });
}

onMounted(fetchMatches);
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

      <section class="rounded-lg bg-surface p-4 shadow-sm">
        <p v-if="matches.length === 0" class="text-text-light">
          {{ nl.common.noResults }}
        </p>

        <ul v-else class="divide-y divide-gray-200">
          <li
            v-for="match in matches"
            :key="match.id"
            class="py-3"
          >
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
          </li>
        </ul>
      </section>
    </main>
  </div>
</template>

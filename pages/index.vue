<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { nl } from "~/i18n/nl";
import { usePolling } from "~/composables/usePolling";

interface Match {
  id: string;
  phase: string;
  round: number;
  startTime: string;
  status: string;
  scoreA: number | null;
  scoreB: number | null;
  field: { id: string; name: string };
  teamA: { id: string; name: string };
  teamB: { id: string; name: string };
  pool: { id: string; name: string } | null;
}

const STORAGE_KEY = "kubb-team-filter";
const matches = ref<Match[]>([]);
const isLoading = ref(true);
const searchQuery = ref("");
const now = ref(Date.now());

const MATCH_DURATION_MS = 15 * 60 * 1000;

async function fetchSchedule() {
  matches.value = await $fetch<Match[]>("/api/public/schedule").catch(() => []);
  now.value = Date.now();
  isLoading.value = false;
}

usePolling(fetchSchedule, { interval: 60_000 });

function matchStatus(match: Match): "live" | "played" | "awaiting" | "scheduled" {
  if (match.status === "PLAYED") return "played";
  const start = new Date(match.startTime).getTime();
  const end = start + MATCH_DURATION_MS;
  if (now.value >= start && now.value < end) return "live";
  if (now.value >= end) return "awaiting";
  return "scheduled";
}

const filteredMatches = computed(() => {
  const q = searchQuery.value.toLowerCase().trim();
  if (!q) return matches.value;
  return matches.value.filter(
    (m) =>
      m.teamA.name.toLowerCase().includes(q) ||
      m.teamB.name.toLowerCase().includes(q),
  );
});

function saveSearch() {
  if (searchQuery.value) {
    localStorage.setItem(STORAGE_KEY, searchQuery.value);
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

onMounted(() => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) searchQuery.value = saved;
  setInterval(() => { now.value = Date.now(); }, 30_000);
});
</script>

<template>
  <div class="min-h-screen bg-background">
    <header class="bg-primary p-4">
      <h1 class="text-center text-xl font-bold text-white">
        {{ nl.common.appName }}
      </h1>
    </header>

    <main class="mx-auto max-w-content p-4">
      <h2 class="mb-4 text-lg font-semibold text-text">
        {{ nl.public.schedule.title }}
      </h2>

      <div class="mb-4">
        <input
          v-model="searchQuery"
          type="text"
          :placeholder="nl.public.schedule.filterPlaceholder"
          class="w-full rounded border border-gray-300 px-3 py-2 text-text focus:border-primary focus:outline-none"
          @input="saveSearch"
        >
      </div>

      <p v-if="isLoading" class="text-text-light">{{ nl.common.loading }}</p>
      <p v-else-if="filteredMatches.length === 0" class="text-text-light">
        {{ nl.public.schedule.noMatches }}
      </p>

      <ul class="space-y-3">
        <li
          v-for="match in filteredMatches"
          :key="match.id"
          class="rounded-lg border border-gray-200 bg-surface p-3 shadow-sm"
        >
          <div class="mb-1 flex items-center justify-between text-sm text-text-light">
            <span>{{ match.field.name }}</span>
            <span>{{ formatDateTime(match.startTime) }}</span>
          </div>

          <div class="flex items-center justify-between">
            <span class="font-semibold text-text">
              {{ match.teamA.name }} vs {{ match.teamB.name }}
            </span>

            <span
              :class="{
                'bg-success text-white': matchStatus(match) === 'live',
                'bg-secondary text-white': matchStatus(match) === 'played',
                'bg-warning text-white': matchStatus(match) === 'awaiting',
                'bg-gray-200 text-text': matchStatus(match) === 'scheduled',
              }"
              class="rounded px-2 py-0.5 text-xs font-medium"
            >
              <span v-if="matchStatus(match) === 'live'">{{ nl.public.schedule.liveLabel }}</span>
              <span v-else-if="matchStatus(match) === 'played'">
                {{ match.scoreA }} - {{ match.scoreB }} ({{ nl.public.schedule.playedLabel }})
              </span>
              <span v-else-if="matchStatus(match) === 'awaiting'">{{ nl.public.schedule.awaitingLabel }}</span>
              <span v-else>{{ nl.public.schedule.scheduledLabel }}</span>
            </span>
          </div>
        </li>
      </ul>

      <div class="mt-6">
        <NuxtLink
          to="/standings"
          class="text-sm text-primary underline"
        >
          {{ nl.public.standings.title }}
        </NuxtLink>
      </div>
    </main>
  </div>
</template>

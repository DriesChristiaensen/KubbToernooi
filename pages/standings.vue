<script setup lang="ts">
import { ref } from "vue";
import { nl } from "~/i18n/nl";
import { usePolling } from "~/composables/usePolling";

interface Standing {
  teamId: string;
  team: { id: string; name: string };
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

interface Pool {
  id: string;
  name: string;
  standings: Standing[];
}

const pools = ref<Pool[]>([]);

async function fetchStandings() {
  pools.value = await $fetch<Pool[]>("/api/public/standings").catch(() => []);
}

usePolling(fetchStandings, { interval: 60_000 });
</script>

<template>
  <main class="mx-auto max-w-content p-4">
    <h1 class="mb-4 text-heading text-text">
      {{ nl.public.standings.title }}
    </h1>

      <p v-if="pools.length === 0" class="text-text-light">
        {{ nl.common.noResults }}
      </p>

      <div v-for="pool in pools" :key="pool.id" class="mb-6">
        <h2 class="mb-2 font-semibold text-text">
          {{ nl.public.standings.pool }}: {{ pool.name }}
        </h2>

        <div class="overflow-x-auto rounded-lg border border-gray-200 bg-surface shadow-sm">
          <table class="w-full text-sm">
            <thead class="border-b border-gray-200 bg-gray-50">
              <tr>
                <th class="px-3 py-2 text-left font-medium text-text">{{ nl.public.standings.team }}</th>
                <th class="px-2 py-2 text-center font-medium text-text">{{ nl.public.standings.played }}</th>
                <th class="px-2 py-2 text-center font-medium text-text">{{ nl.public.standings.won }}</th>
                <th class="px-2 py-2 text-center font-medium text-text">{{ nl.public.standings.drawn }}</th>
                <th class="px-2 py-2 text-center font-medium text-text">{{ nl.public.standings.lost }}</th>
                <th class="px-2 py-2 text-center font-medium text-text">{{ nl.public.standings.goalDifference }}</th>
                <th class="px-2 py-2 text-center font-medium text-text">{{ nl.public.standings.points }}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              <tr
                v-for="(standing, idx) in pool.standings"
                :key="standing.teamId"
                :class="idx % 2 === 0 ? '' : 'bg-gray-50'"
              >
                <td class="px-3 py-2 font-medium text-text">{{ standing.team.name }}</td>
                <td class="px-2 py-2 text-center text-text">{{ standing.played }}</td>
                <td class="px-2 py-2 text-center text-text">{{ standing.won }}</td>
                <td class="px-2 py-2 text-center text-text">{{ standing.drawn }}</td>
                <td class="px-2 py-2 text-center text-text">{{ standing.lost }}</td>
                <td class="px-2 py-2 text-center text-text">{{ standing.goalDifference }}</td>
                <td class="px-2 py-2 text-center font-semibold text-text">{{ standing.points }}</td>
              </tr>
              <tr v-if="pool.standings.length === 0">
                <td colspan="7" class="px-3 py-2 text-center text-text-light">
                  {{ nl.common.noResults }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
  </main>
</template>

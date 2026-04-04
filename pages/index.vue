<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { nl } from "~/i18n/nl";
import { usePolling } from "~/composables/usePolling";

const s = nl.public.schedule;

interface Match {
  id: string;
  phase: string;
  round: number;
  startTime: string;
  status: string;
  scoreA: number | null;
  scoreB: number | null;
  koWinnerId: string | null;
  field: { id: string; name: string };
  teamA: { id: string; name: string };
  teamB: { id: string; name: string };
  pool: { id: string; name: string } | null;
}

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

const matches = ref<Match[]>([]);
const standings = ref<Pool[]>([]);
const tournamentType = ref<string | null>(null);
const tournamentLive = ref(false);
const poolScheduleLive = ref(false);
const koScheduleLive = ref(false);
const isLoading = ref(true);
const now = ref(Date.now());

// T8.2 – status filter
const statusFilter = ref<"all" | "played" | "toPlay">("all");

// T8.3 – favorite team cookie (48 h)
const favTeamId = useCookie<string>("kubb-fav-team", { maxAge: 48 * 3600 });
const myTeamOnly = ref(false);
const showTeamPicker = ref(false);
const teamSearch = ref("");

// T8.5 – main tab state
const activeMainTab = ref<"pool" | "ko" | "eindstand">("pool");
const activeSubTab = ref<"matches" | "standings">("matches");
const activeEindstandSub = ref<"ko" | "pool">("ko");

const MATCH_DURATION_MS = 15 * 60 * 1000;

async function fetchAll() {
  const [newMatches, newStandings, info] = await Promise.all([
    $fetch<Match[]>("/api/public/schedule").catch(() => []),
    $fetch<Pool[]>("/api/public/standings").catch(() => []),
    $fetch<{
      type: string | null;
      tournamentLive: boolean;
      poolScheduleLive: boolean;
      koScheduleLive: boolean;
    }>("/api/public/info").catch(() => ({
      type: null,
      tournamentLive: false,
      poolScheduleLive: false,
      koScheduleLive: false,
    })),
  ]);
  matches.value = newMatches;
  standings.value = newStandings;
  tournamentType.value = info.type;
  tournamentLive.value = info.tournamentLive;
  poolScheduleLive.value = info.poolScheduleLive;
  koScheduleLive.value = info.koScheduleLive;
  now.value = Date.now();
  isLoading.value = false;
  if (
    activeMainTab.value === "pool" &&
    !poolScheduleLive.value &&
    koScheduleLive.value
  ) {
    activeMainTab.value = "ko";
  } else if (
    activeMainTab.value === "ko" &&
    !koScheduleLive.value &&
    poolScheduleLive.value
  ) {
    activeMainTab.value = "pool";
  }
  if (
    !mainTabs.value.some((t) => t.key === activeMainTab.value) &&
    mainTabs.value.length > 0
  ) {
    activeMainTab.value = mainTabs.value[0].key;
  }
}

usePolling(fetchAll, { interval: 60_000 });

onMounted(() => {
  setInterval(() => {
    now.value = Date.now();
  }, 30_000);
});

// T8.1 – status label
function matchStatus(
  match: Match,
): "live" | "played" | "awaiting" | "scheduled" {
  if (match.status === "PLAYED") return "played";
  const start = new Date(match.startTime).getTime();
  const end = start + MATCH_DURATION_MS;
  if (now.value >= start && now.value < end) return "live";
  if (now.value >= end) return "awaiting";
  return "scheduled";
}

function statusLabel(match: Match): string {
  const st = matchStatus(match);
  if (st === "played") return s.playedLabel;
  if (st === "live" || st === "awaiting") return s.liveLabel;
  return s.scheduledLabel;
}

function statusClasses(match: Match): string {
  const st = matchStatus(match);
  if (st === "played") return "bg-secondary text-white";
  if (st === "live" || st === "awaiting") return "bg-success text-white";
  return "bg-gray-200 text-text";
}

// Phase splits
const poolMatches = computed(() =>
  matches.value.filter((m) => m.phase === "POOL"),
);
const koMatches = computed(() => matches.value.filter((m) => m.phase === "KO"));

const allPoolPlayed = computed(
  () =>
    poolMatches.value.length > 0 &&
    poolMatches.value.every((m) => m.status === "PLAYED"),
);
const allKoPlayed = computed(
  () =>
    koMatches.value.length > 0 &&
    koMatches.value.every((m) => m.status === "PLAYED"),
);

const showEindstand = computed(() => {
  if (!tournamentLive.value || !tournamentType.value) return false;
  if (tournamentType.value === "POOLS") return allPoolPlayed.value;
  if (tournamentType.value === "KNOCKOUT") return allKoPlayed.value;
  if (tournamentType.value === "COMBINATION")
    return allPoolPlayed.value && allKoPlayed.value;
  return false;
});

const showPoolTab = computed(
  () =>
    tournamentLive.value &&
    (tournamentType.value === "POOLS" ||
      tournamentType.value === "COMBINATION"),
);
const showKoTab = computed(
  () =>
    tournamentLive.value &&
    (tournamentType.value === "KNOCKOUT" ||
      tournamentType.value === "COMBINATION"),
);

const mainTabs = computed(() => {
  const tabs: { key: "pool" | "ko" | "eindstand"; label: string }[] = [];
  if (showEindstand.value) tabs.push({ key: "eindstand", label: s.tabEindstand });
  if (showPoolTab.value) tabs.push({ key: "pool", label: s.tabPool });
  if (showKoTab.value) tabs.push({ key: "ko", label: s.tabKo });
  return tabs;
});

const statusOpts = [
  { key: "all" as const, label: s.filterAll },
  { key: "played" as const, label: s.filterPlayed },
  { key: "toPlay" as const, label: s.filterToPlay },
];

// T8.3 – unique teams from all matches
const uniqueTeams = computed(() => {
  const map = new Map<string, string>();
  for (const m of matches.value) {
    map.set(m.teamA.id, m.teamA.name);
    map.set(m.teamB.id, m.teamB.name);
  }
  return Array.from(map.entries())
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
});

const filteredTeamList = computed(() => {
  const q = teamSearch.value.toLowerCase().trim();
  if (!q) return uniqueTeams.value;
  return uniqueTeams.value.filter((t) => t.name.toLowerCase().includes(q));
});

const favTeamName = computed(() => {
  if (!favTeamId.value) return null;
  return uniqueTeams.value.find((t) => t.id === favTeamId.value)?.name ?? null;
});

function selectTeam(id: string) {
  favTeamId.value = id;
  showTeamPicker.value = false;
  teamSearch.value = "";
}

function clearFavTeam() {
  favTeamId.value = "";
  myTeamOnly.value = false;
}

function isFavTeam(id: string): boolean {
  return !!favTeamId.value && favTeamId.value === id;
}

function isFavTeamMatch(match: Match): boolean {
  return (
    !!favTeamId.value &&
    (match.teamA.id === favTeamId.value || match.teamB.id === favTeamId.value)
  );
}

const favTeamPool = computed(() => {
  if (!favTeamId.value) return null;
  return (
    standings.value.find((p) =>
      p.standings.some((st) => st.teamId === favTeamId.value),
    ) ?? null
  );
});

const displayStandings = computed(() => {
  if (myTeamOnly.value && favTeamId.value && favTeamPool.value)
    return [favTeamPool.value];
  return standings.value;
});

// T8.2 + T8.3 – apply filters
function applyFilters(list: Match[]): Match[] {
  let result = list;
  if (statusFilter.value === "played") {
    result = result.filter((m) => m.status === "PLAYED");
  } else if (statusFilter.value === "toPlay") {
    result = result.filter((m) => m.status !== "PLAYED");
  }
  if (myTeamOnly.value && favTeamId.value) {
    result = result.filter(
      (m) => m.teamA.id === favTeamId.value || m.teamB.id === favTeamId.value,
    );
  }
  return result;
}

const displayPoolMatches = computed(() => applyFilters(poolMatches.value));
const displayKoMatches = computed(() => applyFilters(koMatches.value));

// T8.5 – KO round grouping and labels
const koRounds = computed(() => {
  if (!koMatches.value.length) return [];
  const rounds: number[] = [];
  for (const m of koMatches.value) {
    if (!rounds.includes(m.round)) rounds.push(m.round);
  }
  return rounds
    .sort((a, b) => a - b)
    .map((r) => {
      const matches = koMatches.value.filter((m) => m.round === r);
      return { round: r, label: getRoundLabel(matches.length), matches };
    });
});

function getRoundLabel(matchCount: number): string {
  const lb = nl.admin.koBracket.roundLabels;
  if (matchCount === 1) return lb.final;
  if (matchCount === 2) return lb.semifinal;
  if (matchCount === 4) return lb.quarterfinal;
  if (matchCount === 8) return lb.r8;
  if (matchCount === 16) return lb.r16;
  return `1/${matchCount} finale`;
}

function isTabDisabled(tab: { key: "pool" | "ko" | "eindstand" }): boolean {
  if (!tournamentLive.value) return true;
  if (tournamentType.value !== "COMBINATION") return false;
  if (tab.key === "pool") return !poolScheduleLive.value;
  if (tab.key === "ko") return !koScheduleLive.value;
  return false;
}

const currentTabScheduleIsLive = computed(() => {
  if (!tournamentLive.value || !tournamentType.value) return false;
  if (activeMainTab.value === "eindstand") return showEindstand.value;
  if (tournamentType.value === "POOLS") return poolScheduleLive.value;
  if (tournamentType.value === "KNOCKOUT") return koScheduleLive.value;
  if (activeMainTab.value === "pool") return poolScheduleLive.value;
  if (activeMainTab.value === "ko") return koScheduleLive.value;
  return false;
});

function poolMatchTitle(match: Match): string {
  return `${match.round}e ${s.poolMatchLabel} ${match.pool?.name ?? ""}`;
}

// T8.5 – Eindstand helpers
function headToHeadSort(group: Standing[], h2hMatches: Match[]): Standing[] {
  const ids = new Set(group.map((s) => s.teamId));
  const pts: Record<string, number> = {};
  const gd: Record<string, number> = {};
  for (const st of group) { pts[st.teamId] = 0; gd[st.teamId] = 0; }
  for (const m of h2hMatches) {
    if (m.status !== "PLAYED" || m.scoreA === null || m.scoreB === null) continue;
    if (!ids.has(m.teamA.id) || !ids.has(m.teamB.id)) continue;
    const diff = m.scoreA - m.scoreB;
    if (diff > 0) pts[m.teamA.id] += 3;
    else if (diff === 0) { pts[m.teamA.id] += 1; pts[m.teamB.id] += 1; }
    else pts[m.teamB.id] += 3;
    gd[m.teamA.id] += diff;
    gd[m.teamB.id] -= diff;
  }
  return [...group].sort(
    (a, b) =>
      (pts[b.teamId] ?? 0) - (pts[a.teamId] ?? 0) ||
      (gd[b.teamId] ?? 0) - (gd[a.teamId] ?? 0),
  );
}

const overallRanking = computed(() => {
  const all: Standing[] = standings.value.flatMap((p) => p.standings);
  const base = [...all].sort(
    (a, b) =>
      b.points - a.points ||
      b.goalDifference - a.goalDifference ||
      b.won - a.won,
  );
  const result: Standing[] = [];
  let i = 0;
  while (i < base.length) {
    let j = i + 1;
    while (
      j < base.length &&
      base[j].points === base[i].points &&
      base[j].goalDifference === base[i].goalDifference &&
      base[j].won === base[i].won
    ) j++;
    const group = base.slice(i, j);
    result.push(...(group.length > 1 ? headToHeadSort(group, poolMatches.value) : group));
    i = j;
  }
  return result;
});

const koFinalMatch = computed(() => {
  if (!koMatches.value.length) return null;
  const maxRound = Math.max(...koMatches.value.map((m) => m.round));
  return koMatches.value.find((m) => m.round === maxRound) ?? null;
});
</script>

<template>
  <main class="mx-auto max-w-content p-4">
    <h2 class="mb-3 text-lg font-semibold text-text">
      {{ s.title }}
    </h2>

    <p v-if="isLoading" class="text-text-light">{{ nl.common.loading }}</p>

    <template v-else>
      <!-- No active tournament -->
      <p v-if="!tournamentLive" class="text-text-light">{{ s.noTournament }}</p>

      <template v-else>
        <!-- Row 1: Tab label (single-type) or button group (multiple tabs) -->
        <div v-if="mainTabs.length === 1" class="mb-3">
          <span
            class="inline-block rounded border border-gray-300 bg-primary px-4 py-2 text-sm font-medium text-white"
          >
            {{ mainTabs[0].label }}
          </span>
        </div>
        <div
          v-else-if="mainTabs.length > 1"
          class="mb-3 inline-flex overflow-hidden rounded border border-gray-300"
        >
          <button
            v-for="(tab, idx) in mainTabs"
            :key="tab.key"
            :disabled="isTabDisabled(tab)"
            :class="[
              activeMainTab === tab.key
                ? 'bg-primary text-white'
                : isTabDisabled(tab)
                  ? 'cursor-not-allowed bg-white text-gray-400'
                  : 'bg-white text-text hover:bg-gray-50',
              idx < mainTabs.length - 1 ? 'border-r border-gray-300' : '',
            ]"
            class="px-4 py-2 text-sm font-medium"
            @click="!isTabDisabled(tab) && (activeMainTab = tab.key)"
          >
            {{ tab.label }}
          </button>
        </div>

        <!-- No schedule live for current tab -->
        <p v-if="!currentTabScheduleIsLive" class="text-text-light">
          {{ s.noScheduleLive }}
        </p>

        <template v-else>
          <!-- Row 2: Sub-tab row (Wedstrijden / Standen) -->
          <div
            v-if="activeMainTab !== 'eindstand'"
            class="mb-3 inline-flex overflow-hidden rounded border border-gray-300"
          >
            <button
              :class="
                activeSubTab === 'matches'
                  ? 'bg-primary text-white'
                  : 'bg-white text-text hover:bg-gray-50'
              "
              class="border-r border-gray-300 px-3 py-1.5 text-sm"
              @click="activeSubTab = 'matches'"
            >
              {{ s.tabMatches }}
            </button>
            <button
              :class="
                activeSubTab === 'standings'
                  ? 'bg-primary text-white'
                  : 'bg-white text-text hover:bg-gray-50'
              "
              class="px-3 py-1.5 text-sm"
              @click="activeSubTab = 'standings'"
            >
              {{ s.tabStandings }}
            </button>
          </div>

          <!-- Row 3: Filter row (only when Matches sub-tab is active) -->
          <div
            v-if="activeMainTab !== 'eindstand' && activeSubTab === 'matches'"
            class="mb-4 flex flex-wrap items-center justify-between gap-2"
          >
            <!-- Status filter button group -->
            <div
              class="inline-flex overflow-hidden rounded border border-gray-300"
            >
              <button
                v-for="(opt, idx) in statusOpts"
                :key="opt.key"
                :class="[
                  statusFilter === opt.key
                    ? 'bg-primary text-white'
                    : 'bg-white text-text hover:bg-gray-50',
                  idx < statusOpts.length - 1 ? 'border-r border-gray-300' : '',
                ]"
                class="px-3 py-1.5 text-sm"
                @click="statusFilter = opt.key"
              >
                {{ opt.label }}
              </button>
            </div>

            <!-- Favourite team filter -->
            <div class="flex items-center gap-2">
              <template v-if="favTeamName">
                <button
                  :class="
                    myTeamOnly
                      ? 'bg-fav text-white'
                      : 'border border-fav-border text-fav-text hover:bg-fav-light'
                  "
                  class="rounded px-3 py-1.5 text-sm"
                  @click="myTeamOnly = !myTeamOnly"
                >
                  {{ s.myTeam }}: {{ favTeamName }}
                </button>
                <button
                  class="text-sm text-text-light underline"
                  @click="clearFavTeam"
                >
                  {{ s.clearTeam }}
                </button>
              </template>
              <button
                v-else
                class="rounded border border-gray-300 px-3 py-1.5 text-sm text-text-light hover:bg-background"
                @click="showTeamPicker = true"
              >
                {{ s.chooseTeam }}
              </button>
            </div>
          </div>

          <!-- POOL tab -->
          <template v-if="activeMainTab === 'pool' && showPoolTab">
            <template v-if="activeSubTab === 'matches'">
              <p v-if="displayPoolMatches.length === 0" class="text-text-light">
                {{ s.noMatches }}
              </p>
              <ul class="space-y-3">
                <li
                  v-for="match in displayPoolMatches"
                  :key="match.id"
                  :class="
                    isFavTeamMatch(match)
                      ? 'border-fav-match-border bg-fav-match-bg'
                      : 'border-gray-200 bg-surface'
                  "
                  class="rounded-lg border p-3 shadow-sm"
                >
                  <div class="mb-1 text-xs font-semibold text-primary">
                    {{ poolMatchTitle(match) }}
                  </div>
                  <div
                    class="mb-1 flex items-center justify-between text-sm text-text-light"
                  >
                    <span>{{ match.field.name }}</span>
                    <span>{{ formatDateTime(match.startTime) }}</span>
                  </div>
                  <div class="flex items-center justify-between">
                    <span class="font-semibold">
                      <span
                        :class="
                          isFavTeam(match.teamA.id)
                            ? 'text-fav-text'
                            : 'text-text'
                        "
                        >{{ match.teamA.name }}</span
                      >
                      <span class="text-text"> vs </span>
                      <span
                        :class="
                          isFavTeam(match.teamB.id)
                            ? 'text-fav-text'
                            : 'text-text'
                        "
                        >{{ match.teamB.name }}</span
                      >
                    </span>
                    <span
                      :class="statusClasses(match)"
                      class="rounded px-2 py-0.5 text-xs font-medium"
                    >
                      <template v-if="match.status === 'PLAYED'"
                        >{{ match.scoreA }} - {{ match.scoreB }} ({{
                          statusLabel(match)
                        }})</template
                      >
                      <template v-else>{{ statusLabel(match) }}</template>
                    </span>
                  </div>
                </li>
              </ul>
            </template>

            <template v-else>
              <p v-if="displayStandings.length === 0" class="text-text-light">
                {{ nl.common.noResults }}
              </p>
              <div v-for="pool in displayStandings" :key="pool.id" class="mb-6">
                <h3 class="mb-2 font-semibold text-text">
                  {{ nl.public.standings.pool }}: {{ pool.name }}
                </h3>
                <div
                  class="overflow-x-auto rounded-lg border border-gray-200 bg-surface shadow-sm"
                >
                  <table class="w-full text-sm">
                    <thead class="border-b border-gray-200 bg-gray-50">
                      <tr>
                        <th class="px-3 py-2 text-left font-medium text-text">
                          {{ nl.public.standings.team }}
                        </th>
                        <th class="px-2 py-2 text-center font-medium text-text">
                          {{ nl.public.standings.played }}
                        </th>
                        <th class="px-2 py-2 text-center font-medium text-text">
                          {{ nl.public.standings.won }}
                        </th>
                        <th class="px-2 py-2 text-center font-medium text-text">
                          {{ nl.public.standings.drawn }}
                        </th>
                        <th class="px-2 py-2 text-center font-medium text-text">
                          {{ nl.public.standings.lost }}
                        </th>
                        <th class="px-2 py-2 text-center font-medium text-text">
                          {{ nl.public.standings.goalDifference }}
                        </th>
                        <th class="px-2 py-2 text-center font-medium text-text">
                          {{ nl.public.standings.points }}
                        </th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100">
                      <tr
                        v-for="(st, idx) in pool.standings"
                        :key="st.teamId"
                        :class="
                          isFavTeam(st.teamId)
                            ? 'bg-fav-light'
                            : idx % 2 === 0
                              ? ''
                              : 'bg-gray-50'
                        "
                      >
                        <td
                          :class="
                            isFavTeam(st.teamId)
                              ? 'px-3 py-2 font-bold text-fav-text'
                              : 'px-3 py-2 font-medium text-text'
                          "
                        >
                          {{ st.team.name }}
                        </td>
                        <td class="px-2 py-2 text-center text-text">
                          {{ st.played }}
                        </td>
                        <td class="px-2 py-2 text-center text-text">
                          {{ st.won }}
                        </td>
                        <td class="px-2 py-2 text-center text-text">
                          {{ st.drawn }}
                        </td>
                        <td class="px-2 py-2 text-center text-text">
                          {{ st.lost }}
                        </td>
                        <td class="px-2 py-2 text-center text-text">
                          {{ st.goalDifference }}
                        </td>
                        <td
                          class="px-2 py-2 text-center font-semibold text-text"
                        >
                          {{ st.points }}
                        </td>
                      </tr>
                      <tr v-if="pool.standings.length === 0">
                        <td
                          colspan="7"
                          class="px-3 py-2 text-center text-text-light"
                        >
                          {{ nl.common.noResults }}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </template>
          </template>

          <!-- KO tab -->
          <template v-if="activeMainTab === 'ko' && showKoTab">
            <template v-if="activeSubTab === 'matches'">
              <p v-if="displayKoMatches.length === 0" class="text-text-light">
                {{ s.noMatches }}
              </p>
              <div v-for="group in koRounds" :key="group.round" class="mb-5">
                <h3 class="mb-2 font-semibold text-text">{{ group.label }}</h3>
                <ul class="space-y-3">
                  <li
                    v-for="match in applyFilters(group.matches)"
                    :key="match.id"
                    :class="
                      isFavTeamMatch(match)
                        ? 'border-fav-match-border bg-fav-match-bg'
                        : 'border-gray-200 bg-surface'
                    "
                    class="rounded-lg border p-3 shadow-sm"
                  >
                    <div
                      class="mb-1 flex items-center justify-between text-sm text-text-light"
                    >
                      <span>{{ match.field.name }}</span>
                      <span>{{ formatDateTime(match.startTime) }}</span>
                    </div>
                    <div class="flex items-center justify-between">
                      <span class="font-semibold">
                        <span
                          :class="
                            isFavTeam(match.teamA.id)
                              ? 'text-fav-text'
                              : 'text-text'
                          "
                          >{{ match.teamA.name }}</span
                        >
                        <span class="text-text"> vs </span>
                        <span
                          :class="
                            isFavTeam(match.teamB.id)
                              ? 'text-fav-text'
                              : 'text-text'
                          "
                          >{{ match.teamB.name }}</span
                        >
                      </span>
                      <span
                        :class="statusClasses(match)"
                        class="rounded px-2 py-0.5 text-xs font-medium"
                      >
                        <template v-if="match.status === 'PLAYED'"
                          >{{ match.scoreA }} - {{ match.scoreB }} ({{
                            statusLabel(match)
                          }})</template
                        >
                        <template v-else>{{ statusLabel(match) }}</template>
                      </span>
                    </div>
                  </li>
                </ul>
              </div>
            </template>

            <template v-else>
              <p v-if="koRounds.length === 0" class="text-text-light">
                {{ nl.common.noResults }}
              </p>
              <div v-else class="overflow-x-auto">
                <div class="flex flex-row gap-4" style="min-width: max-content">
                  <div
                    v-for="(group, colIdx) in koRounds"
                    :key="group.round"
                    class="flex w-52 flex-col"
                  >
                    <h3
                      class="mb-2 text-center text-sm font-semibold text-text"
                    >
                      {{ group.label }}
                    </h3>
                    <div
                      v-for="match in group.matches"
                      :key="match.id"
                      class="flex items-center"
                      :style="{ height: 80 * Math.pow(2, colIdx) + 'px' }"
                    >
                      <div
                        class="w-full rounded-lg border p-3 shadow-sm"
                        :class="
                          isFavTeamMatch(match)
                            ? 'border-fav-match-border bg-fav-match-bg'
                            : 'border-gray-200 bg-surface'
                        "
                      >
                        <div
                          class="mb-1 flex items-center justify-between text-sm text-text-light"
                        >
                          <span>{{ match.field.name }}</span>
                          <span>{{ formatDateTime(match.startTime) }}</span>
                        </div>
                        <div class="flex items-center justify-between gap-2">
                          <span class="min-w-0 font-semibold">
                            <span
                              :class="
                                isFavTeam(match.teamA.id)
                                  ? 'text-fav-text'
                                  : 'text-text'
                              "
                              >{{ match.teamA.name }}</span
                            >
                            <span class="text-text"> vs </span>
                            <span
                              :class="
                                isFavTeam(match.teamB.id)
                                  ? 'text-fav-text'
                                  : 'text-text'
                              "
                              >{{ match.teamB.name }}</span
                            >
                          </span>
                          <span
                            :class="statusClasses(match)"
                            class="shrink-0 rounded px-2 py-0.5 text-xs font-medium"
                          >
                            <template v-if="match.status === 'PLAYED'"
                              >{{ match.scoreA }} - {{ match.scoreB }} ({{
                                statusLabel(match)
                              }})</template
                            >
                            <template v-else>{{ statusLabel(match) }}</template>
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </template>
          </template>

          <!-- Eindstand tab -->
          <template v-if="activeMainTab === 'eindstand' && showEindstand">
            <!-- COMBINATION: sub-tabs -->
            <div
              v-if="tournamentType === 'COMBINATION'"
              class="mb-3 inline-flex overflow-hidden rounded border border-gray-300"
            >
              <button
                v-for="(sub, idx) in [
                  { key: 'ko' as const, label: s.tabKo },
                  { key: 'pool' as const, label: s.tabPool },
                ]"
                :key="sub.key"
                :class="[
                  activeEindstandSub === sub.key
                    ? 'bg-primary text-white'
                    : 'bg-white text-text hover:bg-gray-50',
                  idx === 0 ? 'border-r border-gray-300' : '',
                ]"
                class="px-3 py-1.5 text-sm"
                @click="activeEindstandSub = sub.key"
              >
                {{ sub.label }}
              </button>
            </div>

            <!-- KO bracket (for KNOCKOUT or COMBINATION+ko sub-tab) -->
            <template
              v-if="
                tournamentType === 'KNOCKOUT' ||
                (tournamentType === 'COMBINATION' && activeEindstandSub === 'ko')
              "
            >
              <!-- Winner card -->
              <div
                v-if="koFinalMatch"
                class="mb-4 rounded-lg border border-gray-200 bg-surface p-4 shadow-sm"
              >
                <p class="mb-1 text-sm font-medium text-text-light">
                  {{ s.winner }}
                </p>
                <p class="mb-1 text-lg font-bold text-text">
                  🏆
                  {{
                    koFinalMatch.koWinnerId === koFinalMatch.teamA?.id
                      ? koFinalMatch.teamA?.name
                      : koFinalMatch.teamB?.name
                  }}
                </p>
                <p class="text-sm text-text-light">
                  {{ koFinalMatch.teamA?.name }} {{ koFinalMatch.scoreA }} —
                  {{ koFinalMatch.scoreB }} {{ koFinalMatch.teamB?.name }}
                </p>
              </div>
              <!-- Full bracket -->
              <p v-if="koRounds.length === 0" class="text-text-light">
                {{ nl.common.noResults }}
              </p>
              <div v-else class="overflow-x-auto">
                <div
                  class="flex flex-row gap-4"
                  style="min-width: max-content"
                >
                  <div
                    v-for="(group, colIdx) in koRounds"
                    :key="group.round"
                    class="flex w-52 flex-col"
                  >
                    <h3
                      class="mb-2 text-center text-sm font-semibold text-text"
                    >
                      {{ group.label }}
                    </h3>
                    <div
                      v-for="match in group.matches"
                      :key="match.id"
                      class="flex items-center"
                      :style="{ height: 80 * Math.pow(2, colIdx) + 'px' }"
                    >
                      <div
                        class="w-full rounded-lg border p-3 shadow-sm"
                        :class="
                          isFavTeamMatch(match)
                            ? 'border-fav-match-border bg-fav-match-bg'
                            : 'border-gray-200 bg-surface'
                        "
                      >
                        <div class="flex items-center justify-between gap-2">
                          <span class="min-w-0 font-semibold">
                            <span
                              :class="
                                isFavTeam(match.teamA.id)
                                  ? 'text-fav-text'
                                  : 'text-text'
                              "
                              >{{ match.teamA.name }}</span
                            >
                            <span class="text-text"> vs </span>
                            <span
                              :class="
                                isFavTeam(match.teamB.id)
                                  ? 'text-fav-text'
                                  : 'text-text'
                              "
                              >{{ match.teamB.name }}</span
                            >
                          </span>
                          <span
                            :class="statusClasses(match)"
                            class="shrink-0 rounded px-2 py-0.5 text-xs font-medium"
                          >
                            {{ match.scoreA }} - {{ match.scoreB }}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </template>

            <!-- Pool overall ranking (POOLS only) -->
            <template v-if="tournamentType === 'POOLS'">
              <p class="mb-2 font-semibold text-text">{{ s.overallRanking }}</p>
              <div
                class="overflow-x-auto rounded-lg border border-gray-200 bg-surface shadow-sm"
              >
                <table class="w-full text-sm">
                  <thead class="border-b border-gray-200 bg-gray-50">
                    <tr>
                      <th class="px-2 py-2 text-center font-medium text-text">
                        #
                      </th>
                      <th class="px-3 py-2 text-left font-medium text-text">
                        {{ nl.public.standings.team }}
                      </th>
                      <th class="px-2 py-2 text-center font-medium text-text">
                        {{ nl.public.standings.points }}
                      </th>
                      <th class="px-2 py-2 text-center font-medium text-text">
                        {{ nl.public.standings.goalDifference }}
                      </th>
                      <th class="px-2 py-2 text-center font-medium text-text">
                        {{ nl.public.standings.goalsFor }}
                      </th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-100">
                    <tr
                      v-for="(st, idx) in overallRanking"
                      :key="st.teamId"
                      :class="
                        isFavTeam(st.teamId)
                          ? 'bg-fav-light'
                          : idx % 2 === 0
                            ? ''
                            : 'bg-gray-50'
                      "
                    >
                      <td class="px-2 py-2 text-center text-text-light">
                        {{ idx + 1 }}
                      </td>
                      <td
                        :class="
                          isFavTeam(st.teamId)
                            ? 'px-3 py-2 font-bold text-fav-text'
                            : 'px-3 py-2 font-medium text-text'
                        "
                      >
                        {{ st.team.name }}
                      </td>
                      <td class="px-2 py-2 text-center font-semibold text-text">
                        {{ st.points }}
                      </td>
                      <td class="px-2 py-2 text-center text-text">
                        {{ st.goalDifference }}
                      </td>
                      <td class="px-2 py-2 text-center text-text">
                        {{ st.goalsFor }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </template>

            <!-- Pool standings grouped per pool (COMBINATION+pool sub-tab) -->
            <template
              v-if="
                tournamentType === 'COMBINATION' && activeEindstandSub === 'pool'
              "
            >
              <div v-for="pool in standings" :key="pool.id" class="mb-6">
                <h3 class="mb-2 font-semibold text-text">
                  {{ nl.public.standings.pool }}: {{ pool.name }}
                </h3>
                <div
                  class="overflow-x-auto rounded-lg border border-gray-200 bg-surface shadow-sm"
                >
                  <table class="w-full text-sm">
                    <thead class="border-b border-gray-200 bg-gray-50">
                      <tr>
                        <th
                          class="px-3 py-2 text-left font-medium text-text"
                        >
                          {{ nl.public.standings.team }}
                        </th>
                        <th
                          class="px-2 py-2 text-center font-medium text-text"
                        >
                          {{ nl.public.standings.played }}
                        </th>
                        <th
                          class="px-2 py-2 text-center font-medium text-text"
                        >
                          {{ nl.public.standings.won }}
                        </th>
                        <th
                          class="px-2 py-2 text-center font-medium text-text"
                        >
                          {{ nl.public.standings.drawn }}
                        </th>
                        <th
                          class="px-2 py-2 text-center font-medium text-text"
                        >
                          {{ nl.public.standings.lost }}
                        </th>
                        <th
                          class="px-2 py-2 text-center font-medium text-text"
                        >
                          {{ nl.public.standings.goalDifference }}
                        </th>
                        <th
                          class="px-2 py-2 text-center font-medium text-text"
                        >
                          {{ nl.public.standings.points }}
                        </th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100">
                      <tr
                        v-for="(st, idx) in pool.standings"
                        :key="st.teamId"
                        :class="
                          isFavTeam(st.teamId)
                            ? 'bg-fav-light'
                            : idx % 2 === 0
                              ? ''
                              : 'bg-gray-50'
                        "
                      >
                        <td
                          :class="
                            isFavTeam(st.teamId)
                              ? 'px-3 py-2 font-bold text-fav-text'
                              : 'px-3 py-2 font-medium text-text'
                          "
                        >
                          {{ st.team.name }}
                        </td>
                        <td class="px-2 py-2 text-center text-text">
                          {{ st.played }}
                        </td>
                        <td class="px-2 py-2 text-center text-text">
                          {{ st.won }}
                        </td>
                        <td class="px-2 py-2 text-center text-text">
                          {{ st.drawn }}
                        </td>
                        <td class="px-2 py-2 text-center text-text">
                          {{ st.lost }}
                        </td>
                        <td class="px-2 py-2 text-center text-text">
                          {{ st.goalDifference }}
                        </td>
                        <td
                          class="px-2 py-2 text-center font-semibold text-text"
                        >
                          {{ st.points }}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </template>
          </template
          ><!-- end eindstand v-if --> </template
        ><!-- end currentTabScheduleIsLive v-else --> </template
      ><!-- end tournamentType v-else --> </template
    ><!-- end isLoading v-else -->

    <!-- Team picker modal -->
    <div
      v-if="showTeamPicker"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      @click.self="
        showTeamPicker = false;
        teamSearch = '';
      "
    >
      <div class="mx-4 w-full max-w-sm rounded-lg bg-surface p-4 shadow-xl">
        <h3 class="mb-3 font-semibold text-text">{{ s.teamPickerTitle }}</h3>
        <input
          v-model="teamSearch"
          type="text"
          :placeholder="nl.common.search"
          class="mb-3 w-full rounded border border-gray-300 px-3 py-2 text-sm text-text focus:border-primary focus:outline-none"
          autofocus
        />
        <ul class="max-h-64 divide-y divide-gray-100 overflow-y-auto">
          <li
            v-for="team in filteredTeamList"
            :key="team.id"
            :class="
              team.id === favTeamId
                ? 'bg-primary/10 font-semibold text-primary'
                : 'text-text hover:bg-background'
            "
            class="cursor-pointer px-3 py-2 text-sm"
            @click="selectTeam(team.id)"
          >
            {{ team.name }}
          </li>
          <li
            v-if="filteredTeamList.length === 0"
            class="px-3 py-2 text-sm text-text-light"
          >
            {{ nl.common.noResults }}
          </li>
        </ul>
        <button
          class="mt-3 w-full rounded border border-gray-300 px-3 py-1.5 text-sm text-text hover:bg-background"
          @click="
            showTeamPicker = false;
            teamSearch = '';
          "
        >
          {{ nl.common.cancel }}
        </button>
      </div>
    </div>
  </main>
</template>

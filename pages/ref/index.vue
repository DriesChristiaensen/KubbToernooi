<script setup lang="ts">
import { ref } from "vue";
import { nl } from "~/i18n/nl";
import { useAuth } from "~/composables/useAuth";

definePageMeta({ middleware: "auth", layout: "ref" });

const { data: refsStatus } = await useAsyncData("refs-status", () =>
  $fetch<{ refsEnabled: boolean }>("/api/public/refs-status"),
);
if (!refsStatus.value?.refsEnabled) {
  const { user } = useUserSession();
  if (user.value?.role === "REFEREE") {
    const { logout } = useAuth();
    await logout();
  } else {
    await navigateTo("/ref/login");
  }
}

interface MatchTeam {
  id: string;
  name: string;
}

interface Match {
  id: string;
  phase: "POOL" | "KO";
  round: number;
  startTime: string;
  status: string;
  field: { id: string; name: string };
  teamA: MatchTeam;
  teamB: MatchTeam;
  scoreA: number | null;
  scoreB: number | null;
  koWinnerId: string | null;
}

const matches = ref<Match[]>([]);
const isLoading = ref(true);
const errorMsg = ref("");
const saving = ref<string | null>(null);
const saveError = ref("");
const saveSuccess = ref<string | null>(null); // matchId of recently saved

// Track which matches are in edit mode (allows re-editing if score exists)
const editingIds = ref<Set<string>>(new Set());

// Show confirmation dialog when overwriting an existing score
const overwriteConfirmId = ref<string | null>(null);

const scoreInputs = ref<
  Record<string, { scoreA: string; scoreB: string; koWinnerId: string }>
>({});
const savedScores = ref<
  Record<string, { scoreA: string | null; scoreB: string | null }>
>({});

async function fetchMatches() {
  isLoading.value = true;
  try {
    const data = await $fetch<Match[]>("/api/ref/matches");
    matches.value = data;
    for (const m of data) {
      const sA = m.scoreA !== null ? String(m.scoreA) : "";
      const sB = m.scoreB !== null ? String(m.scoreB) : "";
      if (!(m.id in scoreInputs.value)) {
        scoreInputs.value[m.id] = {
          scoreA: sA,
          scoreB: sB,
          koWinnerId: m.koWinnerId !== null ? String(m.koWinnerId) : "",
        };
      }
      savedScores.value[m.id] = {
        scoreA: m.scoreA !== null ? sA : null,
        scoreB: m.scoreB !== null ? sB : null,
      };
    }
  } catch {
    errorMsg.value = nl.common.error;
  } finally {
    isLoading.value = false;
  }
}

function hasExistingScore(m: Match): boolean {
  return m.scoreA !== null && m.scoreB !== null;
}

function isDirty(m: Match): boolean {
  const input = scoreInputs.value[m.id];
  const saved = savedScores.value[m.id];
  if (!input || !saved) return true;
  if (saved.scoreA === null || saved.scoreB === null) return true;
  return input.scoreA !== saved.scoreA || input.scoreB !== saved.scoreB;
}

function isDraw(m: Match): boolean {
  const a = scoreInputs.value[m.id];
  if (!a) return false;
  return a.scoreA !== "" && a.scoreB !== "" && a.scoreA === a.scoreB;
}

function startEdit(m: Match) {
  editingIds.value.add(m.id);
  const sA = m.scoreA !== null ? String(m.scoreA) : "";
  const sB = m.scoreB !== null ? String(m.scoreB) : "";
  scoreInputs.value[m.id] = {
    scoreA: sA,
    scoreB: sB,
    koWinnerId: m.koWinnerId !== null ? String(m.koWinnerId) : "",
  };
}

function cancelEdit(m: Match) {
  editingIds.value.delete(m.id);
  const sA = m.scoreA !== null ? String(m.scoreA) : "";
  const sB = m.scoreB !== null ? String(m.scoreB) : "";
  scoreInputs.value[m.id] = {
    scoreA: sA,
    scoreB: sB,
    koWinnerId: m.koWinnerId !== null ? String(m.koWinnerId) : "",
  };
}

function tryToSave(match: Match) {
  if (hasExistingScore(match)) {
    overwriteConfirmId.value = match.id;
  } else {
    doSave(match);
  }
}

async function doSave(match: Match) {
  overwriteConfirmId.value = null;
  saving.value = match.id;
  saveError.value = "";
  const input = scoreInputs.value[match.id];
  const body: Record<string, unknown> = {
    scoreA: Number(input.scoreA),
    scoreB: Number(input.scoreB),
  };
  if (match.phase === "KO" && isDraw(match) && input.koWinnerId) {
    body.koWinnerId = input.koWinnerId;
  }
  try {
    const updated = await $fetch<Match>(`/api/ref/matches/${match.id}`, {
      method: "PATCH",
      body,
    });
    const idx = matches.value.findIndex((m) => m.id === match.id);
    if (idx !== -1) {
      matches.value[idx] = {
        ...matches.value[idx],
        scoreA: updated.scoreA,
        scoreB: updated.scoreB,
        status: updated.status,
        koWinnerId: updated.koWinnerId,
      };
    }
    savedScores.value[match.id] = {
      scoreA: input.scoreA,
      scoreB: input.scoreB,
    };
    editingIds.value.delete(match.id);
    // Show success checkmark for 2 seconds
    saveSuccess.value = match.id;
    setTimeout(() => {
      if (saveSuccess.value === match.id) saveSuccess.value = null;
    }, 2000);
  } catch (err: unknown) {
    const e = err as { data?: { error?: string } };
    saveError.value = e?.data?.error ?? nl.common.error;
  } finally {
    saving.value = null;
  }
}

async function deleteScore(match: Match) {
  if (!confirm(nl.ref.matches.deleteScoreConfirm)) return;
  saving.value = match.id;
  saveError.value = "";
  try {
    const updated = await $fetch<Match>(`/api/ref/matches/${match.id}/delete-score`, {
      method: "POST",
    });
    const idx = matches.value.findIndex((m) => m.id === match.id);
    if (idx !== -1) {
      matches.value[idx] = {
        ...matches.value[idx],
        scoreA: null,
        scoreB: null,
        status: updated.status,
        koWinnerId: null,
      };
    }
    savedScores.value[match.id] = { scoreA: null, scoreB: null };
    scoreInputs.value[match.id] = { scoreA: "", scoreB: "", koWinnerId: "" };
    editingIds.value.delete(match.id);
  } catch (err: unknown) {
    const e = err as { data?: { error?: string } };
    saveError.value = e?.data?.error ?? nl.common.error;
  } finally {
    saving.value = null;
  }
}

function phaseLabel(phase: string): string {
  return phase === "KO" ? nl.ref.matches.phaseKo : nl.ref.matches.phasePool;
}

function isEditMode(m: Match): boolean {
  if (!hasExistingScore(m)) return true;
  return editingIds.value.has(m.id);
}

onMounted(() => {
  fetchMatches();
});
</script>

<template>
  <main class="mx-auto max-w-content p-4">
    <h1 class="mb-4 text-heading text-text">
      {{ nl.ref.dashboard }}
    </h1>
    <h2 class="mb-4 text-subheading text-text">
      {{ nl.ref.matches.title }}
    </h2>

    <p v-if="isLoading" class="mb-4 text-text-light">
      {{ nl.common.loading }}
    </p>
    <template v-else>
      <p v-if="errorMsg" class="mb-4 text-error">{{ errorMsg }}</p>
      <p v-if="saveError" class="mb-4 text-error">{{ saveError }}</p>

      <p v-if="matches.length === 0 && !errorMsg" class="text-text-light">
        {{ nl.common.noResults }}
      </p>
    </template>

    <div class="space-y-4">
      <div
        v-for="match in matches"
        :key="match.id"
        class="rounded-lg border border-gray-200 bg-surface p-4 shadow-sm"
      >
        <div class="mb-2 flex items-center justify-between text-sm text-text-light">
          <span>{{ phaseLabel(match.phase) }} — R{{ match.round }} — {{ match.field.name }}</span>
          <span>{{ formatDateTime(match.startTime) }}</span>
        </div>

        <div class="mb-3 text-base font-semibold text-text">
          {{ match.teamA.name }} vs {{ match.teamB.name }}
        </div>

        <!-- T9.1: Overwrite confirmation dialog -->
        <div
          v-if="overwriteConfirmId === match.id"
          class="mb-3 rounded-lg border border-warning bg-warning/10 p-3"
        >
          <p class="mb-2 text-sm font-medium text-text">
            {{ nl.ref.matches.overwriteConfirm }}
          </p>
          <div class="flex gap-2">
            <button
              class="rounded bg-primary px-3 py-1 text-sm font-medium text-white hover:bg-primary-dark"
              @click="doSave(match)"
            >
              {{ nl.ref.matches.overwriteYes }}
            </button>
            <button
              class="rounded bg-secondary px-3 py-1 text-sm font-medium text-white hover:opacity-80"
              @click="overwriteConfirmId = null"
            >
              {{ nl.common.cancel }}
            </button>
          </div>
        </div>

        <!-- T9.3: Read mode (score already entered, not editing) -->
        <template v-else-if="!isEditMode(match)">
          <div class="mb-3 flex items-center gap-4">
            <span class="text-2xl font-bold text-text">
              {{ match.scoreA }} — {{ match.scoreB }}
            </span>
            <button
              class="rounded bg-primary px-3 py-1 text-sm text-white hover:bg-primary-dark"
              @click="startEdit(match)"
            >
              {{ nl.ref.matches.editScore }}
            </button>
            <div class="group relative">
              <button
                :disabled="saving === match.id"
                class="rounded bg-error px-3 py-1 text-sm text-white hover:bg-red-700 disabled:opacity-50"
                @click="deleteScore(match)"
              >
                {{ nl.ref.matches.deleteScore }}
              </button>
              <div v-if="saving === match.id" class="invisible absolute bottom-full left-1/2 z-10 mb-1 w-max max-w-xs -translate-x-1/2 rounded bg-gray-800 px-2 py-1 text-xs text-white group-hover:visible">
                {{ nl.common.submitting }}
              </div>
            </div>
          </div>
        </template>

        <!-- Edit/Entry mode -->
        <template v-else>
          <div class="flex flex-wrap items-end gap-3">
            <div>
              <label class="mb-1 block text-sm text-text-light">{{ nl.ref.matches.scoreA }}</label>
              <input
                v-model="scoreInputs[match.id].scoreA"
                type="number"
                min="0"
                class="w-20 rounded border border-gray-300 bg-white p-2 text-center text-text"
              >
            </div>
            <div>
              <label class="mb-1 block text-sm text-text-light">{{ nl.ref.matches.scoreB }}</label>
              <input
                v-model="scoreInputs[match.id].scoreB"
                type="number"
                min="0"
                class="w-20 rounded border border-gray-300 bg-white p-2 text-center text-text"
              >
            </div>

            <div v-if="match.phase === 'KO' && isDraw(match)">
              <label class="mb-1 block text-sm text-text-light">{{ nl.ref.matches.koWinner }}</label>
              <select
                v-model="scoreInputs[match.id].koWinnerId"
                class="rounded border border-gray-300 bg-white p-2 text-text"
              >
                <option value="">—</option>
                <option :value="String(match.teamA.id)">{{ match.teamA.name }}</option>
                <option :value="String(match.teamB.id)">{{ match.teamB.name }}</option>
              </select>
            </div>

            <!-- T9.2: Save button with success feedback -->
            <div class="group relative">
              <button
                :disabled="!isDirty(match) || saving === match.id"
                :class="saveSuccess === match.id
                  ? 'bg-success text-white'
                  : 'bg-primary text-white hover:bg-primary-dark'"
                class="rounded px-4 py-2 text-sm font-medium disabled:opacity-50 transition-colors"
                :aria-label="saveSuccess === match.id ? nl.common.save : nl.ref.matches.saveScore"
                @click="tryToSave(match)"
              >
                <span v-if="saveSuccess === match.id">✓</span>
                <span v-else>{{ nl.ref.matches.saveScore }}</span>
              </button>
              <div v-if="!isDirty(match) || saving === match.id" class="invisible absolute bottom-full left-1/2 z-10 mb-1 w-max max-w-xs -translate-x-1/2 rounded bg-gray-800 px-2 py-1 text-xs text-white group-hover:visible">
                {{ saving === match.id ? nl.common.saving : nl.common.noChanges }}
              </div>
            </div>

            <button
              v-if="hasExistingScore(match)"
              class="rounded bg-secondary px-3 py-1 text-sm text-white hover:opacity-80"
              @click="cancelEdit(match)"
            >
              {{ nl.common.cancel }}
            </button>
          </div>
        </template>
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
import { ref, nextTick, onMounted, onUnmounted } from "vue";
import { nl } from "~/i18n/nl";

definePageMeta({
  middleware: ["auth"],
  layout: "admin",
});

useHead({ title: 'Spelregels | Kubb 2026' })

interface RuleItem {
  id: string;
  orderNumber: number;
  text: string;
  ruleGroupId: string;
}

interface RuleGroupItem {
  id: string;
  orderNumber: number;
  title: string;
  rules: RuleItem[];
}

const groups = ref<RuleGroupItem[]>([]);
const isLoading = ref(true);
const globalError = ref("");

// Export / import
const exportLoading = ref(false);
const importLoading = ref(false);
const importError = ref("");
const importSuccess = ref("");

async function exportRegels() {
  exportLoading.value = true;
  try {
    const data = await $fetch("/api/admin/rule-groups/export");
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "spelregels-export.json";
    a.click();
    URL.revokeObjectURL(url);
  } catch {
    globalError.value = nl.common.error;
  } finally {
    exportLoading.value = false;
  }
}

function handleImportFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  (event.target as HTMLInputElement).value = "";
  const reader = new FileReader();
  reader.onload = async (e) => {
    importError.value = "";
    importSuccess.value = "";
    importLoading.value = true;
    try {
      const data = JSON.parse(e.target?.result as string);
      await $fetch("/api/admin/rule-groups/import", { method: "POST", body: data });
      importSuccess.value = "Regels geïmporteerd.";
      await fetchGroups();
    } catch {
      importError.value = nl.common.error;
    } finally {
      importLoading.value = false;
    }
  };
  reader.readAsText(file);
}

// Delete confirmation modal
const confirmDeleteGroup = ref<RuleGroupItem | null>(null);

// ID of newly created item (used to auto-focus its input)
const focusId = ref<string | null>(null);

// ─── Drag state ───────────────────────────────────────────────────────────────
// draggingId: the item currently being dragged (group or rule id)
// draggingType: 'group' | 'rule'
// holdId: item where long-press is counting down (visual feedback)
const draggingId = ref<string | null>(null);
const draggingType = ref<"group" | "rule" | null>(null);
const draggingRuleGroupId = ref<string | null>(null);
const overGroupId = ref<string | null>(null);
const overRuleId = ref<string | null>(null);
const holdId = ref<string | null>(null);

let activePointerId: number | null = null;
let holdTimer: ReturnType<typeof setTimeout> | null = null;
let startX = 0;
let startY = 0;
const LONG_PRESS_MS = 350;
const CANCEL_THRESHOLD_PX = 8;

// ─── Data ─────────────────────────────────────────────────────────────────────

async function fetchGroups() {
  try {
    groups.value = await $fetch<RuleGroupItem[]>("/api/admin/rule-groups");
  } catch {
    globalError.value = nl.common.error;
  } finally {
    isLoading.value = false;
  }
}

onMounted(() => {
  fetchGroups();
  document.addEventListener("pointermove", onDocPointerMove);
  document.addEventListener("pointerup", onDocPointerUp);
  document.addEventListener("pointercancel", finalizeDrag);
});

onUnmounted(() => {
  document.removeEventListener("pointermove", onDocPointerMove);
  document.removeEventListener("pointerup", onDocPointerUp);
  document.removeEventListener("pointercancel", finalizeDrag);
  if (holdTimer) clearTimeout(holdTimer);
});

// ─── Groups ───────────────────────────────────────────────────────────────────

async function addGroup() {
  try {
    const group = await $fetch<RuleGroupItem>("/api/admin/rule-groups", { method: "POST" });
    groups.value.push(group);
    focusId.value = `group-${group.id}`;
    await nextTick();
    (document.getElementById(focusId.value) as HTMLInputElement | null)?.focus();
    focusId.value = null;
  } catch {
    globalError.value = nl.common.error;
  }
}

async function saveGroupTitle(group: RuleGroupItem) {
  const title = group.title.trim();
  if (!title) return;
  try {
    await $fetch(`/api/admin/rule-groups/${group.id}`, {
      method: "PUT",
      body: { title },
    });
  } catch {
    // silent – title stays locally
  }
}

function requestDeleteGroup(group: RuleGroupItem) {
  if (group.rules.length > 0) {
    confirmDeleteGroup.value = group;
  } else {
    deleteGroup(group);
  }
}

async function deleteGroup(group: RuleGroupItem) {
  confirmDeleteGroup.value = null;
  try {
    await $fetch(`/api/admin/rule-groups/${group.id}`, { method: "DELETE" });
    groups.value = groups.value.filter((g) => g.id !== group.id);
  } catch {
    globalError.value = nl.common.error;
  }
}

// ─── Rules ────────────────────────────────────────────────────────────────────

async function addRule(group: RuleGroupItem) {
  try {
    const rule = await $fetch<RuleItem>(`/api/admin/rule-groups/${group.id}/rules`, {
      method: "POST",
    });
    group.rules.push(rule);
    focusId.value = `rule-${rule.id}`;
    await nextTick();
    (document.getElementById(focusId.value) as HTMLInputElement | null)?.focus();
    focusId.value = null;
  } catch {
    globalError.value = nl.common.error;
  }
}

async function saveRuleText(rule: RuleItem) {
  const text = rule.text.trim();
  if (!text) return;
  try {
    await $fetch(`/api/admin/rules/${rule.id}`, {
      method: "PUT",
      body: { text },
    });
  } catch {
    // silent
  }
}

async function deleteRule(rule: RuleItem, group: RuleGroupItem) {
  try {
    await $fetch(`/api/admin/rules/${rule.id}`, { method: "DELETE" });
    group.rules = group.rules.filter((r) => r.id !== rule.id);
  } catch {
    globalError.value = nl.common.error;
  }
}

// ─── Drag & drop (pointer events, works on mouse + touch) ─────────────────────
//
// Long-press on a handle (350 ms) activates drag. Moving > 8 px before
// activation cancels the intent so normal page scroll still works on mobile.
// During drag, document.elementsFromPoint() is used to detect the item under
// the pointer and live-reorder the array. The reorder API is called on release.

function onGroupHandlePointerDown(group: RuleGroupItem, event: PointerEvent) {
  event.stopPropagation();
  activePointerId = event.pointerId;
  startX = event.clientX;
  startY = event.clientY;
  holdId.value = `group-${group.id}`;
  holdTimer = setTimeout(() => {
    holdTimer = null;
    draggingId.value = group.id;
    draggingType.value = "group";
  }, LONG_PRESS_MS);
}

function onRuleHandlePointerDown(rule: RuleItem, group: RuleGroupItem, event: PointerEvent) {
  event.stopPropagation();
  activePointerId = event.pointerId;
  startX = event.clientX;
  startY = event.clientY;
  holdId.value = `rule-${rule.id}`;
  holdTimer = setTimeout(() => {
    holdTimer = null;
    draggingId.value = rule.id;
    draggingType.value = "rule";
    draggingRuleGroupId.value = group.id;
  }, LONG_PRESS_MS);
}

function onDocPointerMove(event: PointerEvent) {
  if (event.pointerId !== activePointerId) return;

  // Before activation: cancel if the pointer moves (scroll gesture on mobile)
  if (!draggingId.value) {
    if (Math.hypot(event.clientX - startX, event.clientY - startY) > CANCEL_THRESHOLD_PX) {
      cancelHold();
    }
    return;
  }

  const els = document.elementsFromPoint(event.clientX, event.clientY) as HTMLElement[];

  if (draggingType.value === "group") {
    for (const el of els) {
      const gid = el.dataset.groupId;
      if (!gid || gid === draggingId.value) continue;
      const fromIdx = groups.value.findIndex((g) => g.id === draggingId.value);
      const toIdx = groups.value.findIndex((g) => g.id === gid);
      if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) break;
      // Only cross the midpoint to avoid jitter
      const mid = el.getBoundingClientRect().top + el.getBoundingClientRect().height / 2;
      const movingDown = fromIdx < toIdx;
      if ((movingDown && event.clientY > mid) || (!movingDown && event.clientY < mid)) {
        overGroupId.value = gid;
        const arr = [...groups.value];
        const [moved] = arr.splice(fromIdx, 1);
        arr.splice(toIdx, 0, moved);
        groups.value = arr;
      }
      break;
    }
  } else if (draggingType.value === "rule") {
    for (const el of els) {
      const rid = el.dataset.ruleId;
      const rgid = el.dataset.ruleGroupId;
      if (!rid || rid === draggingId.value || rgid !== draggingRuleGroupId.value) continue;
      const group = groups.value.find((g) => g.id === draggingRuleGroupId.value);
      if (!group) break;
      const fromIdx = group.rules.findIndex((r) => r.id === draggingId.value);
      const toIdx = group.rules.findIndex((r) => r.id === rid);
      if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) break;
      const mid = el.getBoundingClientRect().top + el.getBoundingClientRect().height / 2;
      const movingDown = fromIdx < toIdx;
      if ((movingDown && event.clientY > mid) || (!movingDown && event.clientY < mid)) {
        overRuleId.value = rid;
        const arr = [...group.rules];
        const [moved] = arr.splice(fromIdx, 1);
        arr.splice(toIdx, 0, moved);
        group.rules = arr;
      }
      break;
    }
  }
}

function onDocPointerUp(event: PointerEvent) {
  if (event.pointerId !== activePointerId) return;
  finalizeDrag();
}

function finalizeDrag() {
  if (holdTimer) {
    clearTimeout(holdTimer);
    holdTimer = null;
  }
  if (draggingId.value) {
    if (draggingType.value === "group") {
      reorderGroupsApi();
    } else if (draggingType.value === "rule") {
      const group = groups.value.find((g) => g.id === draggingRuleGroupId.value);
      if (group) reorderRulesApi(group);
    }
  }
  draggingId.value = null;
  draggingType.value = null;
  draggingRuleGroupId.value = null;
  overGroupId.value = null;
  overRuleId.value = null;
  holdId.value = null;
  activePointerId = null;
}

function cancelHold() {
  if (holdTimer) {
    clearTimeout(holdTimer);
    holdTimer = null;
  }
  holdId.value = null;
  activePointerId = null;
}

async function reorderGroupsApi() {
  try {
    await $fetch("/api/admin/rule-groups/reorder", {
      method: "PATCH",
      body: { ids: groups.value.map((g) => g.id) },
    });
  } catch {
    await fetchGroups();
  }
}

async function reorderRulesApi(group: RuleGroupItem) {
  try {
    await $fetch(`/api/admin/rule-groups/${group.id}/rules-reorder`, {
      method: "PATCH",
      body: { ids: group.rules.map((r) => r.id) },
    });
  } catch {
    await fetchGroups();
  }
}
</script>

<template>
  <main class="mx-auto max-w-content p-4">
    <!-- Delete group confirmation modal -->
    <div
      v-if="confirmDeleteGroup"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      @click.self="confirmDeleteGroup = null"
    >
      <div class="mx-4 max-w-md rounded-lg bg-surface p-6 shadow-xl">
        <p class="mb-4 text-text">{{ nl.admin.spelregels.deleteGroupConfirm }}</p>
        <div class="flex gap-3">
          <button
            class="rounded bg-error px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            @click="deleteGroup(confirmDeleteGroup!)"
          >
            {{ nl.common.confirm }}
          </button>
          <button
            class="rounded bg-secondary px-4 py-2 text-sm font-medium text-white hover:opacity-80"
            @click="confirmDeleteGroup = null"
          >
            {{ nl.common.cancel }}
          </button>
        </div>
      </div>
    </div>

    <div class="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-heading text-text">{{ nl.admin.spelregels.title }}</h1>
      <div class="flex gap-2">
        <button
          :disabled="exportLoading"
          class="rounded border border-gray-300 bg-surface px-3 py-1.5 text-sm font-medium text-text hover:bg-gray-50 disabled:opacity-50"
          @click="exportRegels"
        >
          {{ exportLoading ? nl.common.submitting : 'Exporteer regels' }}
        </button>
        <label class="cursor-pointer rounded border border-gray-300 bg-surface px-3 py-1.5 text-sm font-medium text-text hover:bg-gray-50" :class="importLoading ? 'opacity-50 pointer-events-none' : ''">
          {{ importLoading ? nl.common.submitting : 'Importeer regels' }}
          <input type="file" accept=".json" class="hidden" @change="handleImportFile">
        </label>
      </div>
    </div>

    <p v-if="importError" class="mb-3 text-sm text-error">{{ importError }}</p>
    <p v-if="importSuccess" class="mb-3 text-sm text-success">{{ importSuccess }}</p>
    <p v-if="globalError" class="mb-4 text-sm text-error">{{ globalError }}</p>
    <p v-if="isLoading" class="text-sm text-text-muted">{{ nl.common.loading }}</p>

    <div v-else class="space-y-4">
      <p v-if="groups.length === 0" class="text-sm text-text-muted">
        {{ nl.admin.spelregels.noGroups }}
      </p>

      <!-- Rule group -->
      <div
        v-for="group in groups"
        :key="group.id"
        :data-group-id="group.id"
        class="rounded-lg border border-gray-300 bg-secondary-light p-4 transition-shadow"
        :class="{
          'ring-2 ring-primary ring-offset-1': overGroupId === group.id && draggingType === 'group' && draggingId !== group.id,
          'opacity-50 shadow-lg': draggingId === group.id,
        }"
      >
        <!-- Group header row -->
        <div class="mb-3 flex items-center gap-2">
          <!-- Drag handle — touch-none prevents scroll from starting on the handle -->
          <div
            class="relative flex shrink-0 cursor-grab select-none touch-none items-center justify-center w-[22px] h-[22px]"
            :class="holdId === `group-${group.id}` ? 'text-primary' : 'text-gray-400 hover:text-gray-600'"
            :title="nl.common.dragHint ?? 'Vasthouden om te verslepen'"
            @pointerdown.stop="onGroupHandlePointerDown(group, $event)"
          >
            <svg
              v-if="holdId === `group-${group.id}`"
              class="absolute inset-0 -rotate-90"
              width="22" height="22" viewBox="0 0 22 22"
              fill="none" aria-hidden="true"
            >
              <circle class="hold-ring" cx="11" cy="11" r="9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-dasharray="56.55" stroke-dashoffset="56.55" />
            </svg>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <circle cx="5" cy="3" r="1.5" />
              <circle cx="5" cy="8" r="1.5" />
              <circle cx="5" cy="13" r="1.5" />
              <circle cx="11" cy="3" r="1.5" />
              <circle cx="11" cy="8" r="1.5" />
              <circle cx="11" cy="13" r="1.5" />
            </svg>
          </div>

          <!-- Title input -->
          <input
            :id="`group-${group.id}`"
            v-model="group.title"
            type="text"
            :placeholder="nl.admin.spelregels.groupTitlePlaceholder"
            class="min-w-0 flex-1 rounded border border-transparent bg-transparent px-2 py-1 text-subheading font-semibold text-text placeholder-gray-400 hover:border-gray-300 focus:border-primary focus:bg-surface focus:outline-none"
            @blur="saveGroupTitle(group)"
            @keydown.enter="($event.target as HTMLInputElement).blur()"
          >

          <!-- Delete group button -->
          <button
            class="shrink-0 rounded p-1 text-gray-400 hover:bg-red-50 hover:text-error"
            :title="nl.common.delete"
            @click="requestDeleteGroup(group)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <!-- Rules list -->
        <div class="ml-6 space-y-2">
          <div
            v-for="rule in group.rules"
            :key="rule.id"
            :data-rule-id="rule.id"
            :data-rule-group-id="group.id"
            class="flex items-center gap-2 rounded border border-gray-200 bg-surface px-3 py-2 transition-shadow"
            :class="{
              'ring-2 ring-primary ring-offset-1': overRuleId === rule.id && draggingType === 'rule' && draggingId !== rule.id,
              'opacity-50 shadow-md': draggingId === rule.id,
            }"
          >
            <!-- Drag handle -->
            <div
              class="relative flex shrink-0 cursor-grab select-none touch-none items-center justify-center w-[22px] h-[22px]"
              :class="holdId === `rule-${rule.id}` ? 'text-primary' : 'text-gray-300 hover:text-gray-500'"
              :title="nl.common.dragHint ?? 'Vasthouden om te verslepen'"
              @pointerdown.stop="onRuleHandlePointerDown(rule, group, $event)"
            >
              <svg
                v-if="holdId === `rule-${rule.id}`"
                class="absolute inset-0 -rotate-90"
                width="22" height="22" viewBox="0 0 22 22"
                fill="none" aria-hidden="true"
              >
                <circle class="hold-ring" cx="11" cy="11" r="9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-dasharray="56.55" stroke-dashoffset="56.55" />
              </svg>
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <circle cx="5" cy="3" r="1.5" />
                <circle cx="5" cy="8" r="1.5" />
                <circle cx="5" cy="13" r="1.5" />
                <circle cx="11" cy="3" r="1.5" />
                <circle cx="11" cy="8" r="1.5" />
                <circle cx="11" cy="13" r="1.5" />
              </svg>
            </div>

            <!-- Text input -->
            <input
              :id="`rule-${rule.id}`"
              v-model="rule.text"
              type="text"
              :placeholder="nl.admin.spelregels.rulePlaceholder"
              class="min-w-0 flex-1 bg-transparent text-sm text-text placeholder-gray-400 focus:outline-none"
              @blur="saveRuleText(rule)"
              @keydown.enter="($event.target as HTMLInputElement).blur()"
            >

            <!-- Delete rule button -->
            <button
              class="shrink-0 rounded p-1 text-gray-300 hover:bg-red-50 hover:text-error"
              :title="nl.common.delete"
              @click="deleteRule(rule, group)"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <!-- Add rule button -->
          <button
            class="mt-1 rounded border border-primary px-3 py-1 text-sm font-medium text-primary hover:bg-primary hover:text-white"
            @click="addRule(group)"
          >
            {{ nl.admin.spelregels.addRule }}
          </button>
        </div>
      </div>

      <!-- Add group button -->
      <button
        class="rounded bg-primary px-4 py-2 font-medium text-white hover:bg-primary-dark"
        @click="addGroup"
      >
        {{ nl.admin.spelregels.addGroup }}
      </button>
    </div>
  </main>
</template>

<style scoped>
@keyframes hold-fill {
  from { stroke-dashoffset: 56.55; }
  to   { stroke-dashoffset: 0; }
}
.hold-ring {
  animation: hold-fill 350ms linear forwards;
}
</style>

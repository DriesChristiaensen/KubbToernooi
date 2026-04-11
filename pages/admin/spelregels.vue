<script setup lang="ts">
import { ref, nextTick, onMounted, onUnmounted } from "vue";
import { nl } from "~/i18n/nl";

definePageMeta({
  middleware: ["auth"],
  layout: "admin",
});

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

// Which handle element is currently held down (prevents drag from anywhere but the handle)
const activeHandle = ref<string | null>(null);

// Group drag state
const draggingGroupId = ref<string | null>(null);
const dragOverGroupId = ref<string | null>(null);

// Rule drag state (key = ruleId)
const draggingRuleId = ref<string | null>(null);
const draggingRuleGroupId = ref<string | null>(null);
const dragOverRuleId = ref<string | null>(null);

// Delete confirmation modal
const confirmDeleteGroup = ref<RuleGroupItem | null>(null);

// ID of newly created item (used to auto-focus its input)
const focusId = ref<string | null>(null);

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
  document.addEventListener("mouseup", onGlobalMouseUp);
});

onUnmounted(() => {
  document.removeEventListener("mouseup", onGlobalMouseUp);
});

function onGlobalMouseUp() {
  activeHandle.value = null;
}

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

// ─── Drag & drop: groups ──────────────────────────────────────────────────────

function onGroupDragStart(group: RuleGroupItem, event: DragEvent) {
  if (activeHandle.value !== `group-handle-${group.id}`) {
    event.preventDefault();
    return;
  }
  draggingGroupId.value = group.id;
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move";
  }
}

function onGroupDragOver(group: RuleGroupItem) {
  if (!draggingGroupId.value) return;
  dragOverGroupId.value = group.id;
}

function onGroupDrop(targetGroup: RuleGroupItem) {
  const fromId = draggingGroupId.value;
  if (!fromId || fromId === targetGroup.id) return;

  const fromIdx = groups.value.findIndex((g) => g.id === fromId);
  const toIdx = groups.value.findIndex((g) => g.id === targetGroup.id);
  const [item] = groups.value.splice(fromIdx, 1);
  groups.value.splice(toIdx, 0, item);

  reorderGroupsApi();
}

function onGroupDragEnd() {
  draggingGroupId.value = null;
  dragOverGroupId.value = null;
  activeHandle.value = null;
}

async function reorderGroupsApi() {
  try {
    await $fetch("/api/admin/rule-groups/reorder", {
      method: "PATCH",
      body: { ids: groups.value.map((g) => g.id) },
    });
  } catch {
    // Re-fetch to restore server order on failure
    await fetchGroups();
  }
}

// ─── Drag & drop: rules ───────────────────────────────────────────────────────

function onRuleDragStart(rule: RuleItem, group: RuleGroupItem, event: DragEvent) {
  if (activeHandle.value !== `rule-handle-${rule.id}`) {
    event.preventDefault();
    return;
  }
  draggingRuleId.value = rule.id;
  draggingRuleGroupId.value = group.id;
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move";
  }
}

function onRuleDragOver(rule: RuleItem) {
  if (!draggingRuleId.value) return;
  dragOverRuleId.value = rule.id;
}

function onRuleDrop(targetRule: RuleItem, group: RuleGroupItem) {
  const fromId = draggingRuleId.value;
  const fromGroupId = draggingRuleGroupId.value;
  // Only allow reorder within the same group
  if (!fromId || fromId === targetRule.id || fromGroupId !== group.id) return;

  const fromIdx = group.rules.findIndex((r) => r.id === fromId);
  const toIdx = group.rules.findIndex((r) => r.id === targetRule.id);
  const [item] = group.rules.splice(fromIdx, 1);
  group.rules.splice(toIdx, 0, item);

  reorderRulesApi(group);
}

function onRuleDragEnd(group: RuleGroupItem) {
  draggingRuleId.value = null;
  draggingRuleGroupId.value = null;
  dragOverRuleId.value = null;
  activeHandle.value = null;
  reorderRulesApi(group);
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

    <h1 class="mb-6 text-heading text-text">{{ nl.admin.spelregels.title }}</h1>

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
        :draggable="activeHandle === `group-handle-${group.id}`"
        class="rounded-lg border border-gray-300 bg-secondary-light p-4 transition-shadow"
        :class="{
          'ring-2 ring-primary ring-offset-1': dragOverGroupId === group.id && draggingGroupId !== group.id,
          'opacity-50': draggingGroupId === group.id,
        }"
        @dragstart="onGroupDragStart(group, $event)"
        @dragover.prevent="onGroupDragOver(group)"
        @dragleave="dragOverGroupId = null"
        @drop.prevent="onGroupDrop(group)"
        @dragend="onGroupDragEnd"
      >
        <!-- Group header row -->
        <div class="mb-3 flex items-center gap-2">
          <!-- Drag handle -->
          <div
            class="shrink-0 cursor-grab select-none text-gray-400 hover:text-gray-600 active:cursor-grabbing"
            @mousedown.stop="activeHandle = `group-handle-${group.id}`"
          >
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
            :draggable="activeHandle === `rule-handle-${rule.id}`"
            class="flex items-center gap-2 rounded border border-gray-200 bg-surface px-3 py-2 transition-shadow"
            :class="{
              'ring-2 ring-primary ring-offset-1': dragOverRuleId === rule.id && draggingRuleId !== rule.id,
              'opacity-50': draggingRuleId === rule.id,
            }"
            @dragstart.stop="onRuleDragStart(rule, group, $event)"
            @dragover.prevent.stop="onRuleDragOver(rule)"
            @dragleave.stop="dragOverRuleId = null"
            @drop.prevent.stop="onRuleDrop(rule, group)"
            @dragend.stop="onRuleDragEnd(group)"
          >
            <!-- Drag handle -->
            <div
              class="shrink-0 cursor-grab select-none text-gray-300 hover:text-gray-500 active:cursor-grabbing"
              @mousedown.stop="activeHandle = `rule-handle-${rule.id}`"
            >
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

<script setup lang="ts">
import { ref, nextTick, onMounted, onUnmounted } from "vue";
import { nl } from "~/i18n/nl";

definePageMeta({
  middleware: ["auth"],
  layout: "admin",
});

interface BeverageItem {
  id: string;
  orderNumber: number;
  text: string;
  price: number;
  beverageGroupId: string;
}

interface BeverageGroupItem {
  id: string;
  orderNumber: number;
  title: string;
  beverages: BeverageItem[];
}

const groups = ref<BeverageGroupItem[]>([]);
const isLoading = ref(true);
const globalError = ref("");

const activeHandle = ref<string | null>(null);

const draggingGroupId = ref<string | null>(null);
const dragOverGroupId = ref<string | null>(null);

const draggingBeverageId = ref<string | null>(null);
const draggingBeverageGroupId = ref<string | null>(null);
const dragOverBeverageId = ref<string | null>(null);

const confirmDeleteGroup = ref<BeverageGroupItem | null>(null);
const focusId = ref<string | null>(null);

// ─── Data ─────────────────────────────────────────────────────────────────────

async function fetchGroups() {
  try {
    groups.value = await $fetch<BeverageGroupItem[]>("/api/admin/beverage-groups");
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
    const group = await $fetch<BeverageGroupItem>("/api/admin/beverage-groups", { method: "POST" });
    groups.value.push(group);
    focusId.value = `group-${group.id}`;
    await nextTick();
    (document.getElementById(focusId.value) as HTMLInputElement | null)?.focus();
    focusId.value = null;
  } catch {
    globalError.value = nl.common.error;
  }
}

async function saveGroupTitle(group: BeverageGroupItem) {
  const title = group.title.trim();
  if (!title) return;
  try {
    await $fetch(`/api/admin/beverage-groups/${group.id}`, {
      method: "PUT",
      body: { title },
    });
  } catch {
    // silent
  }
}

function requestDeleteGroup(group: BeverageGroupItem) {
  if (group.beverages.length > 0) {
    confirmDeleteGroup.value = group;
  } else {
    deleteGroup(group);
  }
}

async function deleteGroup(group: BeverageGroupItem) {
  confirmDeleteGroup.value = null;
  try {
    await $fetch(`/api/admin/beverage-groups/${group.id}`, { method: "DELETE" });
    groups.value = groups.value.filter((g) => g.id !== group.id);
  } catch {
    globalError.value = nl.common.error;
  }
}

// ─── Beverages ────────────────────────────────────────────────────────────────

async function addBeverage(group: BeverageGroupItem) {
  try {
    const beverage = await $fetch<BeverageItem>(
      `/api/admin/beverage-groups/${group.id}/beverages`,
      { method: "POST" },
    );
    group.beverages.push(beverage);
    focusId.value = `beverage-${beverage.id}`;
    await nextTick();
    (document.getElementById(focusId.value) as HTMLInputElement | null)?.focus();
    focusId.value = null;
  } catch {
    globalError.value = nl.common.error;
  }
}

async function saveBeverage(beverage: BeverageItem) {
  const text = beverage.text.trim();
  if (!text) return;
  try {
    await $fetch(`/api/admin/beverages/${beverage.id}`, {
      method: "PUT",
      body: { text, price: beverage.price },
    });
  } catch {
    // silent
  }
}

async function deleteBeverage(beverage: BeverageItem, group: BeverageGroupItem) {
  try {
    await $fetch(`/api/admin/beverages/${beverage.id}`, { method: "DELETE" });
    group.beverages = group.beverages.filter((b) => b.id !== beverage.id);
  } catch {
    globalError.value = nl.common.error;
  }
}

// ─── Drag & drop: groups ──────────────────────────────────────────────────────

function onGroupDragStart(group: BeverageGroupItem, event: DragEvent) {
  if (activeHandle.value !== `group-handle-${group.id}`) {
    event.preventDefault();
    return;
  }
  draggingGroupId.value = group.id;
  if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
}

function onGroupDragOver(group: BeverageGroupItem) {
  if (!draggingGroupId.value) return;
  dragOverGroupId.value = group.id;
}

function onGroupDrop(targetGroup: BeverageGroupItem) {
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
    await $fetch("/api/admin/beverage-groups/reorder", {
      method: "PATCH",
      body: { ids: groups.value.map((g) => g.id) },
    });
  } catch {
    await fetchGroups();
  }
}

// ─── Drag & drop: beverages ───────────────────────────────────────────────────

function onBeverageDragStart(beverage: BeverageItem, group: BeverageGroupItem, event: DragEvent) {
  if (activeHandle.value !== `beverage-handle-${beverage.id}`) {
    event.preventDefault();
    return;
  }
  draggingBeverageId.value = beverage.id;
  draggingBeverageGroupId.value = group.id;
  if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
}

function onBeverageDragOver(beverage: BeverageItem) {
  if (!draggingBeverageId.value) return;
  dragOverBeverageId.value = beverage.id;
}

function onBeverageDrop(targetBeverage: BeverageItem, group: BeverageGroupItem) {
  const fromId = draggingBeverageId.value;
  const fromGroupId = draggingBeverageGroupId.value;
  if (!fromId || fromId === targetBeverage.id || fromGroupId !== group.id) return;

  const fromIdx = group.beverages.findIndex((b) => b.id === fromId);
  const toIdx = group.beverages.findIndex((b) => b.id === targetBeverage.id);
  const [item] = group.beverages.splice(fromIdx, 1);
  group.beverages.splice(toIdx, 0, item);

  reorderBeveragesApi(group);
}

function onBeverageDragEnd(group: BeverageGroupItem) {
  draggingBeverageId.value = null;
  draggingBeverageGroupId.value = null;
  dragOverBeverageId.value = null;
  activeHandle.value = null;
  reorderBeveragesApi(group);
}

async function reorderBeveragesApi(group: BeverageGroupItem) {
  try {
    await $fetch(`/api/admin/beverage-groups/${group.id}/beverages-reorder`, {
      method: "PATCH",
      body: { ids: group.beverages.map((b) => b.id) },
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
        <p class="mb-4 text-text">{{ nl.admin.prijslijst.deleteGroupConfirm }}</p>
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

    <h1 class="mb-6 text-heading text-text">{{ nl.admin.prijslijst.title }}</h1>

    <p v-if="globalError" class="mb-4 text-sm text-error">{{ globalError }}</p>
    <p v-if="isLoading" class="text-sm text-text-muted">{{ nl.common.loading }}</p>

    <div v-else class="space-y-4">
      <p v-if="groups.length === 0" class="text-sm text-text-muted">
        {{ nl.admin.prijslijst.noGroups }}
      </p>

      <!-- Beverage group -->
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

          <input
            :id="`group-${group.id}`"
            v-model="group.title"
            type="text"
            :placeholder="nl.admin.prijslijst.groupTitlePlaceholder"
            class="min-w-0 flex-1 rounded border border-transparent bg-transparent px-2 py-1 text-subheading font-semibold text-text placeholder-gray-400 hover:border-gray-300 focus:border-primary focus:bg-surface focus:outline-none"
            @blur="saveGroupTitle(group)"
            @keydown.enter="($event.target as HTMLInputElement).blur()"
          >

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

        <!-- Beverages list -->
        <div class="ml-6 space-y-2">
          <div
            v-for="beverage in group.beverages"
            :key="beverage.id"
            :draggable="activeHandle === `beverage-handle-${beverage.id}`"
            class="flex items-center gap-2 rounded border border-gray-200 bg-surface px-3 py-2 transition-shadow"
            :class="{
              'ring-2 ring-primary ring-offset-1': dragOverBeverageId === beverage.id && draggingBeverageId !== beverage.id,
              'opacity-50': draggingBeverageId === beverage.id,
            }"
            @dragstart.stop="onBeverageDragStart(beverage, group, $event)"
            @dragover.prevent.stop="onBeverageDragOver(beverage)"
            @dragleave.stop="dragOverBeverageId = null"
            @drop.prevent.stop="onBeverageDrop(beverage, group)"
            @dragend.stop="onBeverageDragEnd(group)"
          >
            <div
              class="shrink-0 cursor-grab select-none text-gray-300 hover:text-gray-500 active:cursor-grabbing"
              @mousedown.stop="activeHandle = `beverage-handle-${beverage.id}`"
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

            <!-- Name input -->
            <input
              :id="`beverage-${beverage.id}`"
              v-model="beverage.text"
              type="text"
              :placeholder="nl.admin.prijslijst.beveragePlaceholder"
              class="min-w-0 flex-1 bg-transparent text-sm text-text placeholder-gray-400 focus:outline-none"
              @blur="saveBeverage(beverage)"
              @keydown.enter="($event.target as HTMLInputElement).blur()"
            >

            <!-- Price input -->
            <div class="flex shrink-0 items-center gap-1">
              <span class="text-sm text-text-muted">€</span>
              <input
                v-model.number="beverage.price"
                type="number"
                min="0"
                step="0.10"
                :placeholder="nl.admin.prijslijst.pricePlaceholder"
                class="w-20 rounded border border-gray-200 bg-transparent px-2 py-0.5 text-right text-sm text-text placeholder-gray-400 focus:border-primary focus:outline-none"
                @blur="saveBeverage(beverage)"
                @keydown.enter="($event.target as HTMLInputElement).blur()"
              >
            </div>

            <button
              class="shrink-0 rounded p-1 text-gray-300 hover:bg-red-50 hover:text-error"
              :title="nl.common.delete"
              @click="deleteBeverage(beverage, group)"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <!-- Add beverage button -->
          <button
            class="mt-1 rounded border border-primary px-3 py-1 text-sm font-medium text-primary hover:bg-primary hover:text-white"
            @click="addBeverage(group)"
          >
            {{ nl.admin.prijslijst.addBeverage }}
          </button>
        </div>
      </div>

      <!-- Add group button -->
      <button
        class="rounded bg-primary px-4 py-2 font-medium text-white hover:bg-primary-dark"
        @click="addGroup"
      >
        {{ nl.admin.prijslijst.addGroup }}
      </button>
    </div>
  </main>
</template>

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

const confirmDeleteGroup = ref<BeverageGroupItem | null>(null);
const focusId = ref<string | null>(null);

// ─── Drag state ───────────────────────────────────────────────────────────────
const draggingId = ref<string | null>(null);
const draggingType = ref<"group" | "beverage" | null>(null);
const draggingBeverageGroupId = ref<string | null>(null);
const overGroupId = ref<string | null>(null);
const overBeverageId = ref<string | null>(null);
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
    groups.value = await $fetch<BeverageGroupItem[]>("/api/admin/beverage-groups");
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

// ─── Drag & drop (pointer events, works on mouse + touch) ─────────────────────

function onGroupHandlePointerDown(group: BeverageGroupItem, event: PointerEvent) {
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

function onBeverageHandlePointerDown(beverage: BeverageItem, group: BeverageGroupItem, event: PointerEvent) {
  event.stopPropagation();
  activePointerId = event.pointerId;
  startX = event.clientX;
  startY = event.clientY;
  holdId.value = `beverage-${beverage.id}`;
  holdTimer = setTimeout(() => {
    holdTimer = null;
    draggingId.value = beverage.id;
    draggingType.value = "beverage";
    draggingBeverageGroupId.value = group.id;
  }, LONG_PRESS_MS);
}

function onDocPointerMove(event: PointerEvent) {
  if (event.pointerId !== activePointerId) return;

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
      const rect = el.getBoundingClientRect();
      const mid = rect.top + rect.height / 2;
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
  } else if (draggingType.value === "beverage") {
    for (const el of els) {
      const bid = el.dataset.beverageId;
      const bgid = el.dataset.beverageGroupId;
      if (!bid || bid === draggingId.value || bgid !== draggingBeverageGroupId.value) continue;
      const group = groups.value.find((g) => g.id === draggingBeverageGroupId.value);
      if (!group) break;
      const fromIdx = group.beverages.findIndex((b) => b.id === draggingId.value);
      const toIdx = group.beverages.findIndex((b) => b.id === bid);
      if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) break;
      const rect = el.getBoundingClientRect();
      const mid = rect.top + rect.height / 2;
      const movingDown = fromIdx < toIdx;
      if ((movingDown && event.clientY > mid) || (!movingDown && event.clientY < mid)) {
        overBeverageId.value = bid;
        const arr = [...group.beverages];
        const [moved] = arr.splice(fromIdx, 1);
        arr.splice(toIdx, 0, moved);
        group.beverages = arr;
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
    } else if (draggingType.value === "beverage") {
      const group = groups.value.find((g) => g.id === draggingBeverageGroupId.value);
      if (group) reorderBeveragesApi(group);
    }
  }
  draggingId.value = null;
  draggingType.value = null;
  draggingBeverageGroupId.value = null;
  overGroupId.value = null;
  overBeverageId.value = null;
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
    await $fetch("/api/admin/beverage-groups/reorder", {
      method: "PATCH",
      body: { ids: groups.value.map((g) => g.id) },
    });
  } catch {
    await fetchGroups();
  }
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
        :data-group-id="group.id"
        class="rounded-lg border border-gray-300 bg-secondary-light p-4 transition-shadow"
        :class="{
          'ring-2 ring-primary ring-offset-1': overGroupId === group.id && draggingType === 'group' && draggingId !== group.id,
          'opacity-50 shadow-lg': draggingId === group.id,
        }"
      >
        <!-- Group header row -->
        <div class="mb-3 flex items-center gap-2">
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
            :data-beverage-id="beverage.id"
            :data-beverage-group-id="group.id"
            class="flex items-center gap-2 rounded border border-gray-200 bg-surface px-3 py-2 transition-shadow"
            :class="{
              'ring-2 ring-primary ring-offset-1': overBeverageId === beverage.id && draggingType === 'beverage' && draggingId !== beverage.id,
              'opacity-50 shadow-md': draggingId === beverage.id,
            }"
          >
            <div
              class="relative flex shrink-0 cursor-grab select-none touch-none items-center justify-center w-[22px] h-[22px]"
              :class="holdId === `beverage-${beverage.id}` ? 'text-primary' : 'text-gray-300 hover:text-gray-500'"
              :title="nl.common.dragHint ?? 'Vasthouden om te verslepen'"
              @pointerdown.stop="onBeverageHandlePointerDown(beverage, group, $event)"
            >
              <svg
                v-if="holdId === `beverage-${beverage.id}`"
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

<style scoped>
@keyframes hold-fill {
  from { stroke-dashoffset: 56.55; }
  to   { stroke-dashoffset: 0; }
}
.hold-ring {
  animation: hold-fill 350ms linear forwards;
}
</style>

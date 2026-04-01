<script setup lang="ts">
import { ref } from "vue";
import { nl } from "~/i18n/nl";

definePageMeta({ middleware: ["auth", "admin-tournament-guard"], layout: "admin" });
const exportLoading = ref(false);
const exportError = ref("");

const importError = ref("");
const importSuccess = ref("");
const importPassword = ref("");
const importNeedsPassword = ref(false);
const importLoading = ref(false);
let pendingImportData: unknown = null;

async function downloadExport() {
  exportLoading.value = true;
  exportError.value = "";
  try {
    const data = await $fetch("/api/admin/export");
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "kubb-toernooi-export.json";
    a.click();
    URL.revokeObjectURL(url);
  } catch (err: unknown) {
    const fetchErr = err as { data?: { data?: { error?: string } } };
    exportError.value = fetchErr?.data?.data?.error || nl.common.error;
  } finally {
    exportLoading.value = false;
  }
}

async function submitImport(password?: string) {
  importError.value = "";
  importSuccess.value = "";
  importLoading.value = true;
  try {
    const body: Record<string, unknown> = { data: pendingImportData };
    if (password) body.password = password;
    await $fetch("/api/admin/import", { method: "POST", body });
    importSuccess.value = nl.admin.import.button;
    importNeedsPassword.value = false;
    importPassword.value = "";
    pendingImportData = null;
  } catch (err: unknown) {
    const fetchErr = err as { data?: { data?: { error?: string; code?: number } } };
    if (fetchErr?.data?.data?.code === 409) {
      importNeedsPassword.value = true;
      importError.value = nl.admin.import.existingDataWarning;
    } else {
      importError.value = fetchErr?.data?.data?.error || nl.common.error;
    }
  } finally {
    importLoading.value = false;
  }
}

function handleImportFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      pendingImportData = JSON.parse(e.target?.result as string);
      await submitImport();
    } catch {
      importError.value = nl.common.error;
    }
  };
  reader.readAsText(file);
}
</script>

<template>
  <main class="mx-auto max-w-content p-4">
    <h1 class="mb-4 text-heading text-text">
      {{ nl.admin.dashboard }}
    </h1>
      <nav class="grid gap-4 md:grid-cols-2">
        <NuxtLink
          to="/admin/teams"
          class="rounded-lg border border-gray-200 bg-surface p-6 shadow-sm transition-shadow hover:shadow-md"
        >
          <h2 class="text-subheading text-text">
            {{ nl.admin.teams.title }}
          </h2>
        </NuxtLink>
        <NuxtLink
          to="/admin/fields"
          class="rounded-lg border border-gray-200 bg-surface p-6 shadow-sm transition-shadow hover:shadow-md"
        >
          <h2 class="text-subheading text-text">
            {{ nl.admin.fields.title }}
          </h2>
        </NuxtLink>
        <NuxtLink
          to="/admin/pools"
          class="rounded-lg border border-gray-200 bg-surface p-6 shadow-sm transition-shadow hover:shadow-md"
        >
          <h2 class="text-subheading text-text">
            {{ nl.admin.pools.title }}
          </h2>
        </NuxtLink>
        <NuxtLink
          to="/admin/referees"
          class="rounded-lg border border-gray-200 bg-surface p-6 shadow-sm transition-shadow hover:shadow-md"
        >
          <h2 class="text-subheading text-text">{{ nl.admin.referees.title }}</h2>
        </NuxtLink>
        <NuxtLink
          to="/admin/tournament"
          class="rounded-lg border border-gray-200 bg-surface p-6 shadow-sm transition-shadow hover:shadow-md"
        >
          <h2 class="text-subheading text-text">
            {{ nl.admin.tournament.title }}
          </h2>
        </NuxtLink>
        <NuxtLink
          to="/admin/schedule"
          class="rounded-lg border border-gray-200 bg-surface p-6 shadow-sm transition-shadow hover:shadow-md"
        >
          <h2 class="text-subheading text-text">
            {{ nl.admin.schedule.title }}
          </h2>
        </NuxtLink>
        <NuxtLink
          to="/admin/ko-bracket"
          class="rounded-lg border border-gray-200 bg-surface p-6 shadow-sm transition-shadow hover:shadow-md"
        >
          <h2 class="text-subheading text-text">
            {{ nl.admin.koBracket.title }}
          </h2>
        </NuxtLink>
      </nav>

      <div class="mt-6 rounded-lg border border-gray-200 bg-surface p-4 shadow-sm">
        <h2 class="mb-3 font-semibold text-text">
          {{ nl.admin.export.title }}
        </h2>
        <p v-if="exportError" class="mb-2 text-sm text-error">
          {{ exportError }}
        </p>
        <button
          :disabled="exportLoading"
          class="rounded bg-primary px-4 py-2 font-medium text-white hover:bg-primary-dark disabled:opacity-50"
          @click="downloadExport"
        >
          {{ nl.admin.export.button }}
        </button>
      </div>

      <div class="mt-6 rounded-lg border border-gray-200 bg-surface p-4 shadow-sm">
        <h2 class="mb-3 font-semibold text-text">
          {{ nl.admin.import.title }}
        </h2>

        <p v-if="importError" class="mb-2 text-sm text-error">
          {{ importError }}
        </p>
        <p v-if="importSuccess" class="mb-2 text-sm text-success">
          {{ importSuccess }}
        </p>

        <template v-if="importNeedsPassword">
          <p class="mb-2 text-sm text-text">
            {{ nl.admin.import.confirmPassword }}
          </p>
          <div class="flex gap-2">
            <input
              v-model="importPassword"
              type="password"
              :placeholder="nl.auth.password"
              class="rounded border border-gray-300 px-3 py-2 text-text focus:border-primary focus:outline-none"
            >
            <button
              :disabled="importLoading"
              class="rounded bg-error px-4 py-2 font-medium text-white hover:bg-red-700 disabled:opacity-50"
              @click="submitImport(importPassword)"
            >
              {{ nl.common.confirm }}
            </button>
          </div>
        </template>

        <template v-else>
          <label
            class="inline-block cursor-pointer rounded bg-primary px-4 py-2 font-medium text-white hover:bg-primary-dark"
          >
            {{ nl.admin.import.button }}
            <input
              type="file"
              accept=".json"
              class="hidden"
              @change="handleImportFile"
            >
          </label>
        </template>
      </div>
  </main>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { nl } from "~/i18n/nl";
import { useAuth } from "~/composables/useAuth";

definePageMeta({ middleware: "auth" });

const { logout } = useAuth();
const exportLoading = ref(false);
const exportError = ref("");

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
</script>

<template>
  <div class="min-h-screen bg-background">
    <header class="flex items-center justify-between bg-primary-dark p-4">
      <h1 class="text-lg font-bold text-white">
        {{ nl.admin.dashboard }}
      </h1>
      <button
        class="rounded bg-white/20 px-3 py-1 text-sm text-white hover:bg-white/30"
        @click="logout"
      >
        {{ nl.auth.logout }}
      </button>
    </header>

    <main class="mx-auto max-w-content p-4">
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
          to="/admin/referees"
          class="rounded-lg border border-gray-200 bg-surface p-6 shadow-sm transition-shadow hover:shadow-md"
        >
          <h2 class="text-subheading text-text">Scheidsrechters</h2>
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
    </main>
  </div>
</template>

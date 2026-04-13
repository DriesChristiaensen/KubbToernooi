<template>
  <div class="mx-auto max-w-content px-4 py-8">
    <h1 class="text-2xl font-bold text-text mb-8">Spelregels</h1>
    <div v-if="pending">Laden...</div>
    <div v-else-if="error">Kon spelregels niet laden.</div>
    <div v-else class="space-y-8 pl-4">
      <section v-for="group in data" :key="group.id">
        <h2 class="text-xl font-semibold text-text mb-2">{{ group.title }}</h2>
        <ul class="list-disc pl-6 space-y-1">
          <li v-for="rule in group.rules" :key="rule.id" class="text-text">
            {{ rule.text }}
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
useHead({
  title: 'Spelregels | Kubb 2026',
  meta: [
    { name: 'description', content: 'De officiële spelregels van het Kubb-toernooi van Chiro Sint-Antonius.' },
    { property: 'og:title', content: 'Spelregels | Kubb 2026' },
    { property: 'og:description', content: 'De officiële spelregels van het Kubb-toernooi van Chiro Sint-Antonius.' },
    { property: 'og:image', content: 'https://kubb.chirosint-antonius.be/og-image.png' },
    { property: 'og:type', content: 'website' },
  ],
})

const { data, pending, error } = await useFetch("/api/rule-groups");
</script>

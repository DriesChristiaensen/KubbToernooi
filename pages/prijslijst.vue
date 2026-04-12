<template>
  <div class="mx-auto max-w-content px-4 py-8">
    <h1 class="text-2xl font-bold text-text mb-8">Prijslijst</h1>
    <div v-if="pending">Laden...</div>
    <div v-else-if="error">Kon prijslijst niet laden.</div>
    <div v-else class="space-y-8 pl-4">
      <section v-for="group in data" :key="group.id">
        <h2 class="text-xl font-semibold text-text mb-2">{{ group.title }}</h2>
        <table class="w-full">
          <tbody>
            <tr
              v-for="(beverage, index) in group.beverages"
              :key="beverage.id"
              :class="index % 2 === 0 ? 'bg-white' : 'bg-gray-50'"
            >
              <td class="py-2 px-3 text-left text-text">{{ beverage.text }}</td>
              <td class="py-2 px-3 text-right text-text whitespace-nowrap">
                € {{ beverage.price.toFixed(2) }}
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
const { data, pending, error } = await useFetch("/api/beverage-groups");
</script>

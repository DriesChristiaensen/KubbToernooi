<script setup lang="ts">
import { nl } from "~/i18n/nl";
</script>

<template>
  <footer
    class="fixed bottom-0 left-0 right-0 z-10 border-t border-gray-200 bg-surface px-4 py-1.5 text-right"
  >
    <a
      href="https://www.chirosint-antonius.be"
      target="_blank"
      rel="noopener"
      class="text-sm font-bold text-text-light hover:text-primary"
    >
      {{ nl.footer.by }}
    </a>
  </footer>
</template>

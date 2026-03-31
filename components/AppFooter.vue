<script setup lang="ts">
import { nl } from '~/i18n/nl'
</script>

<template>
  <footer class="border-t border-gray-200 bg-surface py-4 text-center">
    <a
      href="https://www.chirosint-antonius.be"
      target="_blank"
      rel="noopener"
      class="text-sm text-text-light hover:text-primary"
    >
      {{ nl.footer.by }}
    </a>
  </footer>
</template>

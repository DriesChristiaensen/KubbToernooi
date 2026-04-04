// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',

  devtools: { enabled: import.meta.dev },

  modules: [
    '@nuxtjs/tailwindcss',
    '@nuxt/eslint',
    'nuxt-auth-utils',
  ],

  tailwindcss: {
    configPath: 'tailwind.config.ts',
  },

  runtimeConfig: {
    sessionPassword: process.env.NUXT_SESSION_PASSWORD,
    databaseUrl: process.env.DATABASE_URL || '',
  },
})

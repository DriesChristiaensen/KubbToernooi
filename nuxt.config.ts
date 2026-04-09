// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',

  app: {
    head: {
      link: [
        // Nunito (body) + Fredoka (display/headings) — https://fonts.google.com
        {
          rel: 'preconnect',
          href: 'https://fonts.googleapis.com',
        },
        {
          rel: 'preconnect',
          href: 'https://fonts.gstatic.com',
          crossorigin: '',
        },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Nunito:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap',
        },
      ],
    },
  },

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

import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['server/**/*.test.ts'],
    passWithNoTests: true,
    alias: {
      '~': path.resolve(__dirname),
      '~/server/utils/prisma': path.resolve(__dirname, 'server/utils/__mocks__/prisma.ts'),
    },
  },
})

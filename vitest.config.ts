import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      include: ['src/lib/**'],
      exclude: ['src/lib/types.ts', 'src/lib/index.ts', 'src/lib/__tests__/**'],
    },
  },
})

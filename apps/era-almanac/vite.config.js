import { defineConfig } from 'vite'

// Relative asset URLs so the same build works from the site folder
// (/era-almanac/), from an installed app shell and from file://.
export default defineConfig({
  base: './',
  build: { outDir: 'dist', emptyOutDir: true },
})

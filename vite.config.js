import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'
import { cupLibraryPlugin } from './server/cupStore.js'

export default defineConfig(({ mode }) => ({
  base: mode === 'pages' ? '/dynamic-gravity-table/' : '/',
  plugins: [cupLibraryPlugin(fileURLToPath(new URL('./data/cups.json', import.meta.url)))],
}))

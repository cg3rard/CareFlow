import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.js.org/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    // Polling is required for reliable file-change detection when running
    // inside Docker with a bind-mounted source directory (notably on Windows).
    watch: {
      usePolling: true,
      interval: 100,
    },
    host: true,
    strictPort: true,
  },
})
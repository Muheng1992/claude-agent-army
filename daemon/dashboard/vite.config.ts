import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/dashboard/',
  build: {
    outDir: '../src/infrastructure/public/dashboard-dist',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/api': 'http://localhost:7777',
      '/events': 'http://localhost:7777',
    },
  },
})

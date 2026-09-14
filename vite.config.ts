import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE_PATH ?? '/',
  test: {
    environment: 'node',
    env: {
      VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
      VITE_SUPABASE_ANON_KEY: 'test-only',
      VITE_FIREBASE_API_KEY: 'test-only',
      VITE_FIREBASE_PROJECT_ID: 'test-only',
    },
  },
})

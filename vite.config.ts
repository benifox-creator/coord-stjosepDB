import { defineConfig, configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'
import { politicaSeguretat } from './src/seguretat/politicaSeguretat'

// La política només s'afegeix a la web publicada: en desenvolupament Vite
// injecta codi en línia (recàrrega en calent) que la política bloquejaria.
function capcaleraSeguretat(): Plugin {
  let env: Record<string, string> = {}
  return {
    name: 'politica-seguretat',
    apply: 'build',
    // `config.env` porta les VITE_* tant de .env.local com de l'entorn (GitHub Actions).
    configResolved(config) { env = config.env },
    transformIndexHtml(html) {
      const supabaseUrl = env.VITE_SUPABASE_URL ?? ''
      const firebaseAuthDomain = env.VITE_FIREBASE_AUTH_DOMAIN ?? ''
      // Sense aquestes adreces la política bloquejaria la pròpia aplicació.
      if (!supabaseUrl || !firebaseAuthDomain) {
        throw new Error('Falten VITE_SUPABASE_URL o VITE_FIREBASE_AUTH_DOMAIN per construir la política de seguretat.')
      }
      const meta = `<meta http-equiv="Content-Security-Policy" content="${politicaSeguretat({ supabaseUrl, firebaseAuthDomain })}" />`
      return html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n    ${meta}`)
    },
  }
}

export default defineConfig({
  plugins: [react(), capcaleraSeguretat()],
  base: process.env.VITE_BASE_PATH ?? '/',
  test: {
    environment: 'node',
    // Les còpies de .worktrees/ són branques antigues: no s'han de provar
    // contra les migracions d'aquesta.
    exclude: [...configDefaults.exclude, '.worktrees/**'],
    env: {
      VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
      VITE_SUPABASE_ANON_KEY: 'test-only',
      VITE_FIREBASE_API_KEY: 'test-only',
      VITE_FIREBASE_PROJECT_ID: 'test-only',
    },
  },
})

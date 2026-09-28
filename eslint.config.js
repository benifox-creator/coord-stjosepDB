import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      // El Markdown de la Base de Coneixement es pinta com a elements de
      // React i mai com a HTML: és el que fa que la injecció de codi no
      // estigui filtrada, sinó que no sigui possible. Aquesta regla ho manté
      // cert per a tot el projecte, no només per a qui ho recordi avui.
      'no-restricted-syntax': [
        'error',
        {
          selector: 'JSXAttribute[name.name="dangerouslySetInnerHTML"]',
          message: "Aquest projecte no fa servir dangerouslySetInnerHTML: tot el contingut de l'usuari es pinta com a elements de React.",
        },
      ],
    },
  },
])

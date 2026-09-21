import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import App from './App.tsx'
import { recarregaSiCal } from './utils/desplegamentNou'

// Vite avisa aquí quan no ha pogut descarregar un mòdul, i ho fa abans que
// l'error arribi a React. Enganxar-ho en aquest punt fa que la pestanya que
// s'ha quedat enrere es recuperi sola, sense que ningú vegi cap error. El
// mateix cas també es recull a l'ErrorBoundary, per si arriba per l'altre
// camí; recarregar dues vegades no pot passar perquè `recarregaSiCal` només
// ho fa un cop.
window.addEventListener('vite:preloadError', (event) => {
  if (recarregaSiCal()) event.preventDefault()
})

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  enabled: !!import.meta.env.VITE_SENTRY_DSN,
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

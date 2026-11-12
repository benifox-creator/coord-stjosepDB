import { useCallback, useState } from 'react'
import type { ValorsFiltres } from './filtres'

// Estat dels filtres d'un llistat. `buits` és el «sense filtres» al qual torna
// `esborra`; `inicials`, si es dona, és com s'obre el llistat (p. ex.
// Incidències s'obre amb les obertes, però esborrar-ho les mostra totes).
export function useValorsFiltres<T extends ValorsFiltres>(buitsInicials: T, inicials: T = buitsInicials) {
  const [buits] = useState(buitsInicials)
  const [valors, setValors] = useState<T>(inicials)
  const canvia = useCallback((clau: string, valor: string) => {
    setValors((v) => ({ ...v, [clau]: valor }))
  }, [])
  const esborra = useCallback(() => setValors(buits), [buits])
  return { valors, canvia, esborra }
}

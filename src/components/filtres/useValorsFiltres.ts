import { useCallback, useState } from 'react'
import type { ValorsFiltres } from './filtres'

// Estat dels filtres d'un llistat. `esborra` torna als valors inicials.
export function useValorsFiltres<T extends ValorsFiltres>(inicials: T) {
  const [buits] = useState(inicials)
  const [valors, setValors] = useState<T>(inicials)
  const canvia = useCallback((clau: string, valor: string) => {
    setValors((v) => ({ ...v, [clau]: valor }))
  }, [])
  const esborra = useCallback(() => setValors(buits), [buits])
  return { valors, canvia, esborra }
}

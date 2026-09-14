import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useUsuarisStore } from '../store/usuarisStore'
import { useConfigStore } from '../store/configStore'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const rol = useUsuarisStore(s => s.rol)
  const accesNegat = useUsuarisStore(s => s.accesNegat)
  const { loaded, error, load } = useConfigStore()
  if (!loading && !user) return <Navigate to="/login" replace />
  if (accesNegat) return <Navigate to="/no-autoritzat" replace />
  if (error) return <div role="alert" className="p-8 text-center">
    <p>No s'ha pogut carregar la configuració d'accés: {error}</p>
    <button className="mt-4 text-primary underline" onClick={() => void load()}>Torna-ho a provar</button>
  </div>
  if (loading || !rol || !loaded) return <div role="status" className="p-8 text-center">Comprovant l'accés…</div>
  return <>{children}</>
}

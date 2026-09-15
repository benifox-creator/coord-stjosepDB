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
  // El motiu va a la URL i no a l'estat del store: la pàgina de destí tanca la
  // sessió en muntar-se, i si hagués de deduir-lo del store trobaria l'usuari
  // ja esborrat i explicaria el problema equivocat.
  if (accesNegat) return <Navigate to="/no-autoritzat?motiu=sense-acces" replace />
  if (error) return <div role="alert" className="p-8 text-center">
    <p>No s'ha pogut carregar la configuració d'accés: {error}</p>
    <button className="mt-4 text-primary underline" onClick={() => void load()}>Torna-ho a provar</button>
  </div>
  if (loading || !rol || !loaded) return <div role="status" className="p-8 text-center">Comprovant l'accés…</div>
  return <>{children}</>
}

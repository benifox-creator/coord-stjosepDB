import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useAuthStore } from '../store/authStore'
import { useUsuarisStore } from '../store/usuarisStore'

interface Props {
  children: React.ReactNode
}

export function ProtectedRoute({ children }: Props) {
  const { user, loading } = useAuth()
  const googleAccessToken = useAuthStore((s) => s.googleAccessToken)
  const rol = useUsuarisStore((s) => s.rol)
  const accesNegat = useUsuarisStore((s) => s.accesNegat)
  const rolLoading = useUsuarisStore((s) => s.loading)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  if (!googleAccessToken) return <Navigate to="/login" replace />

  // Esperem que loadRol acabi abans de decidir
  if (rol === null && !accesNegat && rolLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // Usuari autenticat però no autoritzat pel coordinador
  if (accesNegat) return <Navigate to="/no-autoritzat" replace />

  return <>{children}</>
}

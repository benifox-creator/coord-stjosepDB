import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { logout } from '../services/auth'
import { useAuthStore } from '../store/authStore'
import { useUsuarisStore } from '../store/usuarisStore'

export function NoAutoritzatPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const accesNegat = useUsuarisStore((s) => s.accesNegat)

  useEffect(() => { logout() }, [])

  async function handleTornar() {
    await logout()
    navigate('/login', { replace: true })
  }

  // Usuari del domini però no autoritzat pel coordinador
  const esDomini = user?.email?.endsWith('@stjosep.org') ?? false
  const noAutoritzatPelCoordinador = esDomini && accesNegat

  return (
    <div className="flex items-center justify-center min-h-screen bg-surface">
      <div className="bg-white rounded-2xl shadow-lg p-10 w-full max-w-sm flex flex-col items-center gap-6 text-center">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center text-white text-3xl"
          style={{ backgroundColor: '#861414' }}
        >
          ✕
        </div>
        {noAutoritzatPelCoordinador ? (
          <div>
            <h1 className="text-lg font-semibold text-text-main mb-2">Sense accés</h1>
            <p className="text-sm text-gray-500">
              El compte <strong>{user?.email}</strong> no té accés a Coordinació Digital.
            </p>
            <p className="text-sm text-gray-400 mt-2">
              Contacta amb el coordinador TIC per obtenir accés.
            </p>
          </div>
        ) : (
          <div>
            <h1 className="text-lg font-semibold text-text-main mb-2">Accés no autoritzat</h1>
            <p className="text-sm text-gray-500">
              Aquest portal és exclusiu per a comptes <strong>@stjosep.org</strong>.
              El teu compte de Google no pertany a aquest domini.
            </p>
          </div>
        )}
        <button
          onClick={handleTornar}
          className="text-sm font-medium text-white px-6 py-2 rounded-lg transition-colors"
          style={{ backgroundColor: '#861414' }}
        >
          Torna a l'inici
        </button>
      </div>
    </div>
  )
}

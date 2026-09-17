import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { logout } from '../services/auth'
import { useAuthStore } from '../store/authStore'
import { explicacio } from './noAutoritzat.utils'

export function NoAutoritzatPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  // El correu es captura abans que l'efecte de tancar la sessió l'esborri del
  // store; si no, la pàgina es quedaria sense la dada que ha de mostrar.
  const [email] = useState(() => useAuthStore.getState().user?.email ?? '')

  useEffect(() => { logout() }, [])

  async function handleTornar() {
    await logout()
    navigate('/login', { replace: true })
  }

  const { titol, text, detall } = explicacio(searchParams.get('motiu') ?? '', email)

  return (
    <div className="flex items-center justify-center min-h-screen bg-surface">
      <div className="bg-white rounded-2xl shadow-lg p-10 w-full max-w-sm flex flex-col items-center gap-6 text-center">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center text-white text-3xl"
          style={{ backgroundColor: '#861414' }}
        >
          ✕
        </div>
        <div>
          <h1 className="text-lg font-semibold text-text-main mb-2">{titol}</h1>
          <p className="text-sm text-gray-500">{text}</p>
          {detall && <p className="text-sm text-gray-400 mt-2">{detall}</p>}
        </div>
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

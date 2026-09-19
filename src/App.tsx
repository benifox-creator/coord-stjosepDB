import { lazy, Suspense } from 'react'
import { HashRouter as BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Component, useEffect } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from './services/firebase'
import { clearSessionData } from './services/session'
import { useAuthStore } from './store/authStore'
import { LoginPage } from './pages/LoginPage'
import { NoAutoritzatPage } from './pages/NoAutoritzatPage'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Layout } from './components/Layout'
import { potVeureMaterialInfantil } from './modules/material-infantil/permisos'
import { useConfigStore, canAccessModul } from './store/configStore'
import { useUsuarisStore } from './store/usuarisStore'
import './index.css'

const IncidenciesWrapper = lazy(() => import('./app/routes/IncidenciesWrapper'))
const InventariWrapper = lazy(() => import('./app/routes/InventariWrapper'))
const MaterialWrapper = lazy(() => import('./app/routes/MaterialWrapper'))
const PrestecsWrapper = lazy(() => import('./app/routes/PrestecsWrapper'))
const ReservesWrapper = lazy(() => import('./app/routes/ReservesWrapper'))
const ConeixementWrapper = lazy(() => import('./app/routes/ConeixementWrapper'))
const PlaAccioWrapper = lazy(() => import('./app/routes/PlaAccioWrapper'))
const MantenimentWrapper = lazy(() => import('./app/routes/MantenimentWrapper'))
const SubstitucionsWrapper = lazy(() => import('./app/routes/SubstitucionsWrapper'))
const DashboardPage = lazy(() => import('./modules/dashboard/DashboardPage').then(m => ({ default: m.DashboardPage })))
const ConfiguracioPage = lazy(() => import('./modules/configuracio/ConfiguracioPage').then(m => ({ default: m.ConfiguracioPage })))
const MaterialInfantilPage = lazy(() => import('./modules/material-infantil/MaterialInfantilPage').then(m => ({ default: m.MaterialInfantilPage })))
const HorarisPage = lazy(() => import('./modules/horaris/HorarisPage').then(m => ({ default: m.HorarisPage })))
const ExcursionsWrapper = lazy(() => import('./app/routes/ExcursionsWrapper'))
const AjudaPage = lazy(() => import('./pages/AjudaPage').then(m => ({ default: m.AjudaPage })))

function AuthSync() {
  useEffect(() => onAuthStateChanged(auth, async (user) => {
    if (!user) {
      useAuthStore.getState().clearAuth()
      clearSessionData()
      return
    }
    const state = useAuthStore.getState()
    if (state.user?.uid !== user.uid) clearSessionData()
    state.setAuth(user)
    await useUsuarisStore.getState().loadRol(user.email ?? '')
    if (auth.currentUser?.uid !== user.uid || useUsuarisStore.getState().accesNegat) return
    await Promise.all([useConfigStore.getState().load(), useUsuarisStore.getState().loadAll()])
  }), [])
  return null
}

function VisibilitatGuard({ visKey, children }: { visKey: string; children: ReactNode }) {
  const rol = useUsuarisStore((s) => s.rol)
  const config = useConfigStore((s) => s.config)
  // Mentre el rol no s'ha carregat encara, no redirigim
  if (rol === null) return null
  if (!canAccessModul(config, visKey, rol)) return <Navigate to="/" replace />
  return <>{children}</>
}

function CoordinadorGuard({ children }: { children: ReactNode }) {
  const rol = useUsuarisStore((s) => s.rol)
  if (rol === null) return null
  if (rol !== 'coordinador') return <Navigate to="/" replace />
  return <>{children}</>
}

function MaterialInfantilGuard({ children }: { children: ReactNode }) {
  const rol = useUsuarisStore((s) => s.rol)
  const config = useConfigStore((s) => s.config)
  const email = useAuthStore((s) => s.user?.email)
  const usuaris = useUsuarisStore((s) => s.usuaris)
  if (rol === null || usuaris.length === 0) return null
  const usuariActual = usuaris.find((u) => u.Email.toLowerCase() === (email ?? '').toLowerCase()) ?? null
  if (!potVeureMaterialInfantil(usuariActual, rol, config)) return <Navigate to="/" replace />
  return <>{children}</>
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/no-autoritzat" element={<NoAutoritzatPage />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <Layout>
              <Routes>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/ajuda" element={<AjudaPage />} />
                <Route path="/incidencies" element={<VisibilitatGuard visKey="incidencies"><IncidenciesWrapper /></VisibilitatGuard>} />
                <Route path="/inventari" element={<VisibilitatGuard visKey="inventari"><InventariWrapper /></VisibilitatGuard>} />
                <Route path="/material" element={<VisibilitatGuard visKey="material"><MaterialWrapper /></VisibilitatGuard>} />
                <Route path="/prestecs" element={<VisibilitatGuard visKey="prestecs"><PrestecsWrapper /></VisibilitatGuard>} />
                <Route path="/reserves" element={<VisibilitatGuard visKey="reserves"><ReservesWrapper /></VisibilitatGuard>} />
                <Route path="/substitucions" element={<VisibilitatGuard visKey="substitucions"><SubstitucionsWrapper /></VisibilitatGuard>} />
                <Route path="/coneixement" element={<VisibilitatGuard visKey="coneixement"><ConeixementWrapper /></VisibilitatGuard>} />
                <Route path="/pla-accio" element={<VisibilitatGuard visKey="pla-accio"><PlaAccioWrapper /></VisibilitatGuard>} />
                <Route path="/manteniment" element={<VisibilitatGuard visKey="manteniment"><MantenimentWrapper /></VisibilitatGuard>} />
                <Route
                  path="/material-infantil"
                  element={<MaterialInfantilGuard><MaterialInfantilPage /></MaterialInfantilGuard>}
                />
                <Route path="/horaris" element={<VisibilitatGuard visKey="horaris"><HorarisPage /></VisibilitatGuard>} />
                <Route path="/excursions" element={<VisibilitatGuard visKey="excursions"><ExcursionsWrapper /></VisibilitatGuard>} />
                <Route
                  path="/configuracio"
                  element={<CoordinadorGuard><ConfiguracioPage /></CoordinadorGuard>}
                />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error: Error) { return { error } }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('[ErrorBoundary]', error, info) }
  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center h-screen gap-4 p-8 text-center">
          <p className="text-lg font-semibold text-red-700">Error inesperat</p>
          <p className="text-sm text-gray-600 max-w-md font-mono">{this.state.error.message}</p>
          <button onClick={() => this.setState({ error: null })} className="px-4 py-2 text-sm bg-gray-100 rounded-lg hover:bg-gray-200">
            Tornar a intentar
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <AuthSync />
        <Suspense fallback={<p role="status" className="p-6 text-sm text-gray-600">Carregant mòdul…</p>}><AppRoutes /></Suspense>
      </ErrorBoundary>
    </BrowserRouter>
  )
}

export default App

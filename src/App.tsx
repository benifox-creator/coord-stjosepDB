import { HashRouter as BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Component, useEffect } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from './services/firebase'
import { useAuthStore } from './store/authStore'
import { LoginPage } from './pages/LoginPage'
import { NoAutoritzatPage } from './pages/NoAutoritzatPage'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Layout } from './components/Layout'
import { useState } from 'react'
import { DashboardPage } from './modules/dashboard/DashboardPage'
import { IncidenciesPage } from './modules/incidencies/IncidenciesPage'
import { IncidenciaForm } from './modules/incidencies/IncidenciaForm'
import { IncidenciaDetall } from './modules/incidencies/IncidenciaDetall'
import { useIncidencies } from './modules/incidencies/useIncidencies'
import type { Incidencia } from './modules/incidencies/types'
import { InventariPage } from './modules/inventari/InventariPage'
import { InventariForm } from './modules/inventari/InventariForm'
import { InventariDetall } from './modules/inventari/InventariDetall'
import { useInventari } from './modules/inventari/useInventari'
import type { ItemInventari } from './modules/inventari/types'
import { PrestecsPage } from './modules/prestecs/PrestecsPage'
import { PrestecForm } from './modules/prestecs/PrestecForm'
import { PrestecDetall } from './modules/prestecs/PrestecDetall'
import { usePrestecs } from './modules/prestecs/usePrestecs'
import type { Prestec } from './modules/prestecs/types'
import { MaterialPage } from './modules/material/MaterialPage'
import { MaterialForm } from './modules/material/MaterialForm'
import { MaterialDetall } from './modules/material/MaterialDetall'
import { useMaterial } from './modules/material/useMaterial'
import type { ItemMaterial } from './modules/material/types'
import { ReservesPage } from './modules/reserves/ReservesPage'
import { ReservaForm } from './modules/reserves/ReservaForm'
import { ReservaDetall } from './modules/reserves/ReservaDetall'
import { useReserves } from './modules/reserves/useReserves'
import type { Reserva } from './modules/reserves/types'
import { SubstitucionsPage } from './modules/substitucions/SubstitucionsPage'
import { SubstitucioForm } from './modules/substitucions/SubstitucioForm'
import { SubstitucioDetall } from './modules/substitucions/SubstitucioDetall'
import { useSubstitucions } from './modules/substitucions/useSubstitucions'
import type { Substitucio } from './modules/substitucions/types'
import { ConeixementPage } from './modules/coneixement/ConeixementPage'
import { ConeixementForm } from './modules/coneixement/ConeixementForm'
import { ConeixementDetall } from './modules/coneixement/ConeixementDetall'
import { useConeixement } from './modules/coneixement/useConeixement'
import type { Article } from './modules/coneixement/types'
import { PlaAccioPage } from './modules/pla-accio/PlaAccioPage'
import { ProjecteForm } from './modules/pla-accio/ProjecteForm'
import { TascaForm } from './modules/pla-accio/TascaForm'
import { TascaDetall } from './modules/pla-accio/TascaDetall'
import { useProjectes } from './modules/pla-accio/useProjectes'
import { useTasques } from './modules/pla-accio/useTasques'
import type { Projecte } from './modules/pla-accio/types'
import type { Tasca } from './modules/pla-accio/types'
import { MantenimentPage } from './modules/manteniment/MantenimentPage'
import { MantenimentForm } from './modules/manteniment/MantenimentForm'
import { MantenimentDetall } from './modules/manteniment/MantenimentDetall'
import { useManteniment } from './modules/manteniment/useManteniment'
import type { Manteniment } from './modules/manteniment/types'

import { ConfiguracioPage } from './modules/configuracio/ConfiguracioPage'
import { useConfigStore, canAccessModul } from './store/configStore'
import { useUsuarisStore, potGestionar, potEliminar } from './store/usuarisStore'
import './index.css'

function AuthSync() {
  const loadConfig = useConfigStore((s) => s.load)
  const configLoaded = useConfigStore((s) => s.loaded)
  const token = useAuthStore((s) => s.googleAccessToken)
  const loadAllUsuaris = useUsuarisStore((s) => s.loadAll)
  const usuarisCarregats = useUsuarisStore((s) => s.usuaris.length > 0)

  useEffect(() => {
    return onAuthStateChanged(auth, (firebaseUser) => {
      if (!firebaseUser) {
        // Si el token JA és null, és un logout real → netegem tot.
        // Si el token existeix, és un null transitori del popup COOP — no fem res:
        // Firebase tornarà a disparar onAuthStateChanged(user) tot seguit i no hem
        // d'interrompre les crides async (loadRol, loadAll) que ja estan en curs.
        const tok = useAuthStore.getState().googleAccessToken
        if (!tok) {
          useAuthStore.getState().clearAuth()
          useUsuarisStore.getState().reset()
        }
        return
      }

      // Restaura l'objecte user si tenim token (recàrrega de pàgina)
      const { user: storedUser, googleAccessToken: tok, setAuth } = useAuthStore.getState()
      if (!storedUser && tok) setAuth(firebaseUser, tok)

      // Carrega el rol si el token és disponible i el rol encara no s'ha carregat.
      // Cobreix: (1) recàrrega de pàgina, (2) null transitori COOP → user de nou
      const currentToken = useAuthStore.getState().googleAccessToken
      const { rol, loadRol } = useUsuarisStore.getState()
      if (rol === null && firebaseUser.email && currentToken) {
        loadRol(firebaseUser.email, firebaseUser.displayName)
      }
    })
  }, [])

  // Cobreix el cas de login fresc (signInWithPopup): onAuthStateChanged s'activa DURANT
  // el popup (token null), però setAuth es crida quan el popup resol. Quan el token
  // apareix a l'store, aquí es carrega el rol.
  useEffect(() => {
    if (!token) return
    const { user } = useAuthStore.getState()
    const { rol, loadRol } = useUsuarisStore.getState()
    if (rol === null && user?.email) {
      loadRol(user.email, user.displayName)
    }
  }, [token])

  useEffect(() => {
    if (token && !configLoaded) loadConfig()
    if (token && !usuarisCarregats) loadAllUsuaris()
  }, [token, configLoaded, loadConfig, usuarisCarregats, loadAllUsuaris])

  return null
}

function IncidenciesWrapper() {
  const { incidencies, loading, error, crear, canviarEstat, assignar, editarComentaris, eliminar, refetch } = useIncidencies()
  const rol = useUsuarisStore((s) => s.rol)
  const pGestionar = potGestionar(rol)
  const pEliminar = potEliminar(rol)
  const [formObert, setFormObert] = useState(false)
  const [seleccionada, setSeleccionada] = useState<Incidencia | null>(null)

  async function handleCanviarEstat(inc: Incidencia, estat: Parameters<typeof canviarEstat>[1]) {
    const result = await canviarEstat(inc, estat)
    setSeleccionada((prev) => prev ? { ...prev, Estat: estat } : null)
    return result
  }

  return (
    <>
      <IncidenciesPage
        onNova={() => setFormObert(true)}
        onVeureDetall={setSeleccionada}
        loading={loading}
        incidencies={incidencies}
        error={error}
        onRefresh={refetch}
      />
      {formObert && (
        <IncidenciaForm
          onClose={() => setFormObert(false)}
          onGuardar={crear}
          isCoordinador={pGestionar}
        />
      )}
      {seleccionada && (
        <IncidenciaDetall
          incidencia={seleccionada}
          onClose={() => setSeleccionada(null)}
          isCoordinador={pGestionar}
          potEliminar={pEliminar}
          onCanviarEstat={handleCanviarEstat}
          onAssignar={assignar}
          onEditarComentaris={editarComentaris}
          onEliminar={async (inc) => { await eliminar(inc); setSeleccionada(null) }}
        />
      )}
    </>
  )
}

function InventariWrapper() {
  const { items, loading, error, crear, editar, canviarEstat, editarUbicacio, editarNotes, eliminar, refetch } = useInventari()
  const rol = useUsuarisStore((s) => s.rol)
  // Inventari: només coordinador pot afegir, editar i eliminar; direcció sols veu
  const pEditarInventari = potEliminar(rol)
  const [formObert, setFormObert] = useState(false)
  const [editant, setEditant] = useState<ItemInventari | null>(null)
  const [seleccionat, setSeleccionat] = useState<ItemInventari | null>(null)

  function handleEditar(item: ItemInventari) {
    setSeleccionat(null)
    setEditant(item)
  }

  async function handleCanviarEstat(item: ItemInventari, estat: Parameters<typeof canviarEstat>[1]) {
    await canviarEstat(item, estat)
    setSeleccionat((prev) => prev ? { ...prev, Estat: estat } : null)
  }

  return (
    <>
      <InventariPage
        onNou={pEditarInventari ? () => setFormObert(true) : undefined}
        onVeureDetall={setSeleccionat}
        loading={loading}
        items={items}
        error={error}
        onRefresh={refetch}
      />
      {(formObert || editant) && (
        <InventariForm
          onClose={() => { setFormObert(false); setEditant(null) }}
          onGuardar={editant ? (data) => editar(editant, data) : crear}
          inicial={editant ?? undefined}
        />
      )}
      {seleccionat && (
        <InventariDetall
          item={seleccionat}
          onClose={() => setSeleccionat(null)}
          isCoordinador={pEditarInventari}
          potEliminar={pEditarInventari}
          onCanviarEstat={handleCanviarEstat}
          onEditarUbicacio={editarUbicacio}
          onEditarNotes={editarNotes}
          onEditar={handleEditar}
          onEliminar={async (item) => { await eliminar(item); setSeleccionat(null) }}
        />
      )}
    </>
  )
}

function MaterialWrapper() {
  const { items, loading, error, crear, editar, editarNotes, donarDeBaixa, refetch } = useMaterial()
  const rol = useUsuarisStore((s) => s.rol)
  const pGestionar = potGestionar(rol)
  const pEliminar = potEliminar(rol)
  const [formObert, setFormObert] = useState(false)
  const [editant, setEditant] = useState<ItemMaterial | null>(null)
  const [seleccionat, setSeleccionat] = useState<ItemMaterial | null>(null)

  function handleEditar(item: ItemMaterial) {
    setSeleccionat(null)
    setEditant(item)
  }

  return (
    <>
      <MaterialPage
        onNou={() => setFormObert(true)}
        onVeureDetall={setSeleccionat}
        loading={loading}
        items={items}
        error={error}
        onRefresh={refetch}
      />
      {(formObert || editant) && (
        <MaterialForm
          onClose={() => { setFormObert(false); setEditant(null) }}
          onGuardar={editant ? (data) => editar(editant, data) : crear}
          inicial={editant ?? undefined}
        />
      )}
      {seleccionat && (
        <MaterialDetall
          item={seleccionat}
          onClose={() => setSeleccionat(null)}
          isCoordinador={pGestionar}
          potEliminar={pEliminar}
          onEditarNotes={editarNotes}
          onEditar={handleEditar}
          onEliminar={async (item) => { await donarDeBaixa(item); setSeleccionat(null) }}
        />
      )}
    </>
  )
}

function PrestecsWrapper() {
  const { prestecs, loading, error, crear, canviarEstat, editarNotes, eliminar, refetch } = usePrestecs()
  const { items: materialDisponible } = useMaterial()
  const rol = useUsuarisStore((s) => s.rol)
  const pGestionar = potGestionar(rol)
  const pEliminar = potEliminar(rol)
  // Préstecs: sols el coordinador pot crear nous préstecs
  const pCrearPrestec = potEliminar(rol)
  const [formObert, setFormObert] = useState(false)
  const [seleccionat, setSeleccionat] = useState<Prestec | null>(null)

  async function handleCanviarEstat(p: Prestec, estat: Parameters<typeof canviarEstat>[1]) {
    await canviarEstat(p, estat)
    setSeleccionat((prev) => prev ? { ...prev, Estat: estat } : null)
  }

  return (
    <>
      <PrestecsPage
        onNou={pCrearPrestec ? () => setFormObert(true) : undefined}
        onVeureDetall={setSeleccionat}
        loading={loading}
        prestecs={prestecs}
        error={error}
        onRefresh={refetch}
      />
      {formObert && (
        <PrestecForm
          onClose={() => setFormObert(false)}
          onGuardar={crear}
          materialDisponible={materialDisponible}
        />
      )}
      {seleccionat && (
        <PrestecDetall
          prestec={seleccionat}
          onClose={() => setSeleccionat(null)}
          isCoordinador={pGestionar}
          potEliminar={pEliminar}
          onCanviarEstat={handleCanviarEstat}
          onEditarNotes={editarNotes}
          onEliminar={async (p) => { await eliminar(p); setSeleccionat(null) }}
        />
      )}
    </>
  )
}

function ReservesWrapper() {
  const { reserves, loading, error, crear, editar, canviarEstat, eliminar, refetch } = useReserves()
  const rol = useUsuarisStore((s) => s.rol)
  const pGestionar = potGestionar(rol)
  const pEliminar = potEliminar(rol)
  const [formObert, setFormObert] = useState(false)
  const [editant, setEditant] = useState<Reserva | null>(null)
  const [seleccionada, setSeleccionada] = useState<Reserva | null>(null)

  function handleEditar(reserva: Reserva) {
    setSeleccionada(null)
    setEditant(reserva)
  }

  async function handleCanviarEstat(r: Reserva, estat: Parameters<typeof canviarEstat>[1]) {
    await canviarEstat(r, estat)
    setSeleccionada((prev) => prev ? { ...prev, Estat: estat } : null)
  }

  return (
    <>
      <ReservesPage
        onNova={() => setFormObert(true)}
        onVeureDetall={setSeleccionada}
        loading={loading}
        reserves={reserves}
        error={error}
        onRefresh={refetch}
      />
      {(formObert || editant) && (
        <ReservaForm
          onClose={() => { setFormObert(false); setEditant(null) }}
          onGuardar={editant ? (data) => editar(editant, data) : crear}
          inicial={editant ?? undefined}
        />
      )}
      {seleccionada && (
        <ReservaDetall
          reserva={seleccionada}
          onClose={() => setSeleccionada(null)}
          isCoordinador={pGestionar}
          potEliminar={pEliminar}
          onCanviarEstat={handleCanviarEstat}
          onEditar={handleEditar}
          onEliminar={async (r) => { await eliminar(r); setSeleccionada(null) }}
        />
      )}
    </>
  )
}

function ConeixementWrapper() {
  const rol = useUsuarisStore((s) => s.rol)
  const esCoordinador = potEliminar(rol)
  const { articles, loading, error, crear, editar, togglePublicat, eliminar, refetch } = useConeixement(esCoordinador)
  const [formObert, setFormObert] = useState(false)
  const [editant, setEditant] = useState<Article | null>(null)
  const [seleccionat, setSeleccionat] = useState<Article | null>(null)

  function handleEditar(article: Article) {
    setSeleccionat(null)
    setEditant(article)
  }

  return (
    <>
      <ConeixementPage
        articles={articles}
        loading={loading}
        error={error}
        esCoordinador={esCoordinador}
        onNou={() => setFormObert(true)}
        onVeureDetall={setSeleccionat}
        onRefresh={refetch}
      />
      {(formObert || editant) && (
        <ConeixementForm
          inicial={editant ?? undefined}
          onClose={() => { setFormObert(false); setEditant(null) }}
          onGuardar={editant ? (data) => editar(editant, data) : crear}
        />
      )}
      {seleccionat && (
        <ConeixementDetall
          article={seleccionat}
          esCoordinador={esCoordinador}
          onClose={() => setSeleccionat(null)}
          onEditar={() => handleEditar(seleccionat)}
          onTogglePublicat={async (a) => { await togglePublicat(a); setSeleccionat(null) }}
          onEliminar={async (a) => { await eliminar(a); setSeleccionat(null) }}
        />
      )}
    </>
  )
}

function PlaAccioWrapper() {
  const { projectes, loading: lPrj, error: ePrj, crear: crearProjecte, editar: editarProjecte, eliminar: eliminarProjecte, refetch: refetchPrj } = useProjectes()
  const { tasques, loading: lTas, error: eTas, crear: crearTasca, editar: editarTasca, canviarEstat: canviarEstatTasca, eliminar: eliminarTasca, refetch: refetchTas } = useTasques()
  const rol = useUsuarisStore((s) => s.rol)
  const canGestionar = potGestionar(rol)

  const [formProjecte, setFormProjecte] = useState(false)
  const [editantProjecte, setEditantProjecte] = useState<Projecte | null>(null)
  const [formTasca, setFormTasca] = useState(false)
  const [defaultProjecteId, setDefaultProjecteId] = useState<string | undefined>()
  const [editantTasca, setEditantTasca] = useState<Tasca | null>(null)
  const [seleccionadaTasca, setSeleccionadaTasca] = useState<Tasca | null>(null)

  function handleNovaTasca(projecteId?: string) {
    setEditantTasca(null)
    setDefaultProjecteId(projecteId)
    setFormTasca(true)
  }

  function handleEditarTasca() {
    setEditantTasca(seleccionadaTasca)
    setSeleccionadaTasca(null)
    setFormTasca(true)
  }

  async function handleCanviarEstatTasca(tasca: Tasca, estat: Parameters<typeof canviarEstatTasca>[1]) {
    await canviarEstatTasca(tasca, estat)
    setSeleccionadaTasca((prev) => prev ? { ...prev, Estat: estat } : null)
  }

  function handleRefresh() {
    refetchPrj()
    refetchTas()
  }

  return (
    <>
      <PlaAccioPage
        projectes={projectes}
        tasques={tasques}
        loading={lPrj || lTas}
        error={ePrj ?? eTas}
        canGestionar={canGestionar}
        onRefresh={handleRefresh}
        onNouProjecte={() => { setEditantProjecte(null); setFormProjecte(true) }}
        onEditarProjecte={(p) => { setEditantProjecte(p); setFormProjecte(true) }}
        onEliminarProjecte={eliminarProjecte}
        onNovaTasca={handleNovaTasca}
        onVeureTasca={setSeleccionadaTasca}
      />
      {formProjecte && (
        <ProjecteForm
          projecte={editantProjecte}
          onClose={() => { setFormProjecte(false); setEditantProjecte(null) }}
          onGuardar={editantProjecte
            ? (data) => editarProjecte(editantProjecte, data)
            : crearProjecte
          }
        />
      )}
      {formTasca && (
        <TascaForm
          tasca={editantTasca}
          projectes={projectes}
          defaultProjecteId={defaultProjecteId}
          onClose={() => { setFormTasca(false); setEditantTasca(null); setDefaultProjecteId(undefined) }}
          onGuardar={editantTasca
            ? (data) => editarTasca(editantTasca, data)
            : crearTasca
          }
        />
      )}
      {seleccionadaTasca && (
        <TascaDetall
          tasca={seleccionadaTasca}
          projecte={projectes.find((p) => p.ID === seleccionadaTasca.Projecte_ID)}
          canGestionar={canGestionar}
          onClose={() => setSeleccionadaTasca(null)}
          onEditar={handleEditarTasca}
          onEliminar={async (t) => { await eliminarTasca(t); setSeleccionadaTasca(null) }}
          onCanviarEstat={handleCanviarEstatTasca}
        />
      )}
    </>
  )
}

function MantenimentWrapper() {
  const { manteniments, loading, error, crear, canviarEstat, eliminar, refetch } = useManteniment()
  const rol = useUsuarisStore((s) => s.rol)
  const canGestionar = potGestionar(rol)

  const [formObert, setFormObert] = useState(false)
  const [seleccionat, setSeleccionat] = useState<Manteniment | null>(null)

  async function handleCanviarEstat(m: Manteniment, estat: Parameters<typeof canviarEstat>[1]) {
    await canviarEstat(m, estat)
    setSeleccionat((prev) => prev ? { ...prev, Estat: estat } : null)
  }

  return (
    <>
      <MantenimentPage
        manteniments={manteniments}
        loading={loading}
        error={error}
        onRefresh={refetch}
        onNou={() => setFormObert(true)}
        onVeure={setSeleccionat}
      />
      {formObert && (
        <MantenimentForm
          onClose={() => setFormObert(false)}
          onGuardar={crear}
        />
      )}
      {seleccionat && (
        <MantenimentDetall
          manteniment={seleccionat}
          canGestionar={canGestionar}
          onClose={() => setSeleccionat(null)}
          onEliminar={async (m) => { await eliminar(m); setSeleccionat(null) }}
          onCanviarEstat={handleCanviarEstat}
        />
      )}
    </>
  )
}

function SubstitucionsWrapper() {
  const { substitucions, loading, error, load, crear, canviarEstat, eliminar } = useSubstitucions()
  const rol = useUsuarisStore((s) => s.rol)
  const canGestionar = potGestionar(rol)

  useEffect(() => { load() }, [])

  const [formObert, setFormObert] = useState(false)
  const [dataInicial, setDataInicial] = useState<string | undefined>()
  const [seleccionada, setSeleccionada] = useState<Substitucio | null>(null)

  async function handleCanviarEstat(s: Substitucio, estat: Parameters<typeof canviarEstat>[1]) {
    await canviarEstat(s, estat)
    setSeleccionada((prev) => prev ? { ...prev, Estat: estat } : null)
  }

  function handleNova(data?: string) {
    setDataInicial(data)
    setFormObert(true)
  }

  return (
    <>
      <SubstitucionsPage
        substitucions={substitucions}
        loading={loading}
        error={error}
        onRefresh={load}
        onNova={handleNova}
        onVeure={setSeleccionada}
      />
      {formObert && (
        <SubstitucioForm
          dataInicial={dataInicial}
          onDesar={async (data) => { await crear(data); setFormObert(false) }}
          onCancel={() => setFormObert(false)}
        />
      )}
      {seleccionada && (
        <SubstitucioDetall
          substitucio={seleccionada}
          canGestionar={canGestionar}
          onClose={() => setSeleccionada(null)}
          onCanviarEstat={handleCanviarEstat}
          onEliminar={async (s) => { await eliminar(s); setSeleccionada(null) }}
        />
      )}
    </>
  )
}

function VisibilitatGuard({ visKey, children }: { visKey: string; children: ReactNode }) {
  const rol = useUsuarisStore((s) => s.rol)
  const config = useConfigStore((s) => s.config)
  // Mentre el rol no s'ha carregat encara, no redirigim
  if (rol === null) return <>{children}</>
  if (!canAccessModul(config, visKey, rol)) return <Navigate to="/" replace />
  return <>{children}</>
}

function CoordinadorGuard({ children }: { children: ReactNode }) {
  const rol = useUsuarisStore((s) => s.rol)
  if (rol === null) return null
  if (rol !== 'coordinador') return <Navigate to="/" replace />
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
        <AppRoutes />
      </ErrorBoundary>
    </BrowserRouter>
  )
}

export default App

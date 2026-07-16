import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, BookOpen, Calendar, Monitor, Package, ChevronRight } from 'lucide-react'
import { useIncidencies } from '../incidencies/useIncidencies'
import { useInventari } from '../inventari/useInventari'
import { usePrestecs } from '../prestecs/usePrestecs'
import { useReserves } from '../reserves/useReserves'
import { useMaterial } from '../material/useMaterial'
import { estatEfectiu, formatDate, diesRestants } from '../prestecs/prestecs.utils'
import { formatDate as formatDateRes } from '../reserves/reserves.utils'
import { useAuthStore } from '../../store/authStore'
import { useUsuarisStore } from '../../store/usuarisStore'
import { useConfigStore, canAccessModul } from '../../store/configStore'
import { Badge } from '../../components/Badge'

const TODAY = new Date().toISOString().split('T')[0]

function salutacio(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Bon dia'
  if (h < 19) return 'Bona tarda'
  return 'Bona nit'
}

interface KpiCardProps {
  label: string
  value: number
  sublabel?: string
  onClick: () => void
  loading?: boolean
  urgent?: boolean
  neutralColor?: string
}

function KpiCard({ label, value, sublabel, onClick, loading, urgent, neutralColor = '#0c71c3' }: KpiCardProps) {
  const isAlert = urgent && value > 0
  return (
    <button
      onClick={onClick}
      className={`bg-white rounded-xl p-4 text-left shadow-sm border transition-all hover:shadow-md group ${
        isAlert ? 'border-red-200 hover:border-red-300' : 'border-gray-100 hover:border-gray-200'
      }`}
    >
      {loading ? (
        <div className="space-y-2">
          <div className="h-8 w-10 bg-gray-200 rounded animate-pulse" />
          <div className="h-3 w-20 bg-gray-200 rounded animate-pulse" />
        </div>
      ) : (
        <>
          <p
            className="text-3xl font-bold tabular-nums"
            style={{ color: isAlert ? '#861414' : neutralColor }}
          >
            {value}
          </p>
          <p className="text-xs font-semibold text-gray-600 mt-1 leading-tight">{label}</p>
          {sublabel && <p className="text-xs text-gray-400 mt-0.5">{sublabel}</p>}
        </>
      )}
    </button>
  )
}

function SectionHeader({ title, linkLabel, onClick }: { title: string; linkLabel?: string; onClick?: () => void }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-sm font-semibold text-text-main uppercase tracking-wide">{title}</h2>
      {linkLabel && onClick && (
        <button onClick={onClick} className="flex items-center gap-1 text-xs text-primary hover:underline font-medium">
          {linkLabel} <ChevronRight size={13} />
        </button>
      )}
    </div>
  )
}

function EmptyRow({ cols, msg }: { cols: number; msg: string }) {
  return (
    <tr>
      <td colSpan={cols} className="px-4 py-6 text-center text-xs text-gray-400">{msg}</td>
    </tr>
  )
}

export function DashboardPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const nom = user?.displayName?.split(' ')[0] ?? 'Coordinador/a'
  const rol = useUsuarisStore((s) => s.rol)
  const config = useConfigStore((s) => s.config)

  const canAccess = {
    incidencies: canAccessModul(config, 'incidencies', rol),
    inventari: canAccessModul(config, 'inventari', rol),
    prestecs: canAccessModul(config, 'prestecs', rol),
    reserves: canAccessModul(config, 'reserves', rol),
    material: canAccessModul(config, 'material', rol),
  }

  const { incidencies, loading: lInc } = useIncidencies()
  const { items: inventari, loading: lInv } = useInventari()
  const { prestecs, loading: lPre } = usePrestecs()
  const { reserves, loading: lRes } = useReserves()
  const { items: material, loading: lMat } = useMaterial()

  const stats = useMemo(() => {
    const incObertes = incidencies.filter((i) => i.Estat !== 'Tancada')
    const incAlta = incidencies.filter((i) => i.Estat !== 'Tancada' && i.Prioritat === 'Alta')

    const prestecsAmbEstat = prestecs.map((p) => ({ ...p, _estat: estatEfectiu(p) }))
    const prestecsActius = prestecsAmbEstat.filter((p) => p._estat === 'Actiu')
    const prestecsVençuts = prestecsAmbEstat.filter((p) => p._estat === 'Vençut')

    const reservesAvui = reserves.filter((r) => r.Data === TODAY && r.Estat !== 'Cancel·lada')
    const reservesSetmana = reserves
      .filter((r) => r.Data >= TODAY && r.Estat !== 'Cancel·lada')
      .sort((a, b) => a.Data.localeCompare(b.Data) || a.Hora_inici.localeCompare(b.Hora_inici))

    const invEnReparacio = inventari.filter((i) => i.Estat === 'En reparació')
    const matSenseEstoc = material.filter((m) => m.Quantitat_disponible === 0)

    // Lists for detail tables
    const incRecents = [...incObertes]
      .sort((a, b) => {
        const pOrd = { Alta: 0, Mitjana: 1, Baixa: 2 }
        return (pOrd[a.Prioritat] ?? 1) - (pOrd[b.Prioritat] ?? 1)
      })
      .slice(0, 6)

    const prestecsVençutsList = prestecsVençuts.slice(0, 5)
    const reservesProximes = reservesSetmana.slice(0, 5)

    return {
      incObertes: incObertes.length,
      incAlta: incAlta.length,
      prestecsActius: prestecsActius.length,
      prestecsVençuts: prestecsVençuts.length,
      reservesAvui: reservesAvui.length,
      invEnReparacio: invEnReparacio.length,
      matSenseEstoc: matSenseEstoc.length,
      incRecents,
      prestecsVençutsList,
      reservesProximes,
    }
  }, [incidencies, inventari, prestecs, reserves, material])

  const anyLoading = lInc || lInv || lPre || lRes || lMat
  const hasAlerts =
    (canAccess.prestecs && stats.prestecsVençuts > 0) ||
    (canAccess.incidencies && stats.incAlta > 0)

  return (
    <div className="flex flex-col gap-6 p-6 bg-surface min-h-full">

      {/* Capçalera */}
      <div>
        <h1 className="text-2xl font-bold text-text-main">{salutacio()}, {nom}</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          {new Date().toLocaleDateString('ca-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Banner d'alertes urgents */}
      {!anyLoading && hasAlerts && (
        <div className="flex flex-wrap gap-3">
          {canAccess.prestecs && stats.prestecsVençuts > 0 && (
            <button
              onClick={() => navigate('/prestecs')}
              className="flex items-center gap-2 px-4 py-2.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 hover:bg-red-100 transition-colors font-medium"
            >
              <AlertTriangle size={15} className="shrink-0" />
              {stats.prestecsVençuts} préstec{stats.prestecsVençuts !== 1 ? 's' : ''} vençut{stats.prestecsVençuts !== 1 ? 's' : ''}
            </button>
          )}
          {canAccess.incidencies && stats.incAlta > 0 && (
            <button
              onClick={() => navigate('/incidencies')}
              className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700 hover:bg-amber-100 transition-colors font-medium"
            >
              <AlertTriangle size={15} className="shrink-0" />
              {stats.incAlta} incidència{stats.incAlta !== 1 ? 's' : ''} d'alta prioritat
            </button>
          )}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {canAccess.incidencies && (
          <KpiCard
            label="Incidències obertes"
            value={stats.incObertes}
            sublabel="Oberta / En curs"
            onClick={() => navigate('/incidencies')}
            loading={lInc}
            neutralColor="#0c71c3"
          />
        )}
        {canAccess.incidencies && (
          <KpiCard
            label="Alta prioritat"
            value={stats.incAlta}
            sublabel="Sense tancar"
            onClick={() => navigate('/incidencies')}
            loading={lInc}
            urgent
          />
        )}
        {canAccess.prestecs && (
          <KpiCard
            label="Préstecs actius"
            value={stats.prestecsActius}
            onClick={() => navigate('/prestecs')}
            loading={lPre}
            neutralColor="#0c71c3"
          />
        )}
        {canAccess.prestecs && (
          <KpiCard
            label="Préstecs vençuts"
            value={stats.prestecsVençuts}
            sublabel="Pendent retorn"
            onClick={() => navigate('/prestecs')}
            loading={lPre}
            urgent
          />
        )}
        {canAccess.reserves && (
          <KpiCard
            label="Reserves avui"
            value={stats.reservesAvui}
            sublabel={TODAY}
            onClick={() => navigate('/reserves')}
            loading={lRes}
            neutralColor="#15803d"
          />
        )}
        {canAccess.inventari && (
          <KpiCard
            label="En reparació"
            value={stats.invEnReparacio}
            sublabel="Inventari"
            onClick={() => navigate('/inventari')}
            loading={lInv}
            neutralColor="#b45309"
          />
        )}
      </div>

      {/* Mòduls ràpids */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { label: 'Incidències', icon: AlertTriangle, path: '/incidencies', color: '#861414', visKey: 'incidencies' as const },
          { label: 'Inventari', icon: Monitor, path: '/inventari', color: '#0c71c3', visKey: 'inventari' as const },
          { label: 'Préstecs', icon: BookOpen, path: '/prestecs', color: '#7c3aed', visKey: 'prestecs' as const },
          { label: 'Material', icon: Package, path: '/material', color: '#b45309', visKey: 'material' as const },
          { label: 'Reserves', icon: Calendar, path: '/reserves', color: '#15803d', visKey: 'reserves' as const },
        ].filter(({ visKey }) => canAccess[visKey]).map(({ label, icon: Icon, path, color }) => (
          <button
            key={path}
            onClick={() => navigate(path)}
            className="bg-white rounded-xl p-4 border border-gray-100 hover:border-gray-200 hover:shadow-md transition-all flex items-center gap-3 text-left"
          >
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}18` }}>
              <Icon size={18} style={{ color }} />
            </div>
            <span className="text-sm font-semibold text-text-main">{label}</span>
          </button>
        ))}
      </div>

      {/* Taules de detall */}
      {(canAccess.incidencies || canAccess.prestecs) && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Incidències obertes */}
        {canAccess.incidencies && <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <SectionHeader
              title="Incidències obertes"
              linkLabel="Veure totes"
              onClick={() => navigate('/incidencies')}
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Ticket</th>
                  <th className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Tipus</th>
                  <th className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Prioritat</th>
                  <th className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Estat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {lInc && [...Array(4)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(4)].map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-3 bg-gray-200 rounded animate-pulse" style={{ width: `${40 + (j * 17) % 40}%` }} />
                      </td>
                    ))}
                  </tr>
                ))}
                {!lInc && stats.incRecents.length === 0 && (
                  <EmptyRow cols={4} msg="Cap incidència oberta. Bon senyal!" />
                )}
                {!lInc && stats.incRecents.map((inc) => (
                  <tr
                    key={inc.Ticket}
                    onClick={() => navigate('/incidencies')}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 text-sm font-semibold text-primary">{inc.Ticket}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 truncate max-w-[130px]">{inc['Tipus de problema']}</td>
                    <td className="px-4 py-3"><Badge label={inc.Prioritat} variant="prioritat" /></td>
                    <td className="px-4 py-3"><Badge label={inc.Estat} variant="estat" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>}

        {/* Préstecs vençuts / actius */}
        {canAccess.prestecs && <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <SectionHeader
              title={stats.prestecsVençuts > 0 ? 'Préstecs vençuts' : 'Préstecs actius'}
              linkLabel="Veure tots"
              onClick={() => navigate('/prestecs')}
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">ID</th>
                  <th className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Dispositiu</th>
                  <th className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Usuari</th>
                  <th className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Data fi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {lPre && [...Array(4)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(4)].map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-3 bg-gray-200 rounded animate-pulse" style={{ width: `${40 + (j * 17) % 40}%` }} />
                      </td>
                    ))}
                  </tr>
                ))}
                {!lPre && stats.prestecsVençutsList.length === 0 && prestecs.length === 0 && (
                  <EmptyRow cols={4} msg="Cap préstec registrat." />
                )}
                {!lPre && stats.prestecsVençutsList.length === 0 && prestecs.length > 0 && (
                  <EmptyRow cols={4} msg="Cap préstec vençut. Tot en ordre!" />
                )}
                {!lPre && stats.prestecsVençutsList.map((p) => {
                  const dies = diesRestants(p.Data_fi_prevista)
                  return (
                    <tr
                      key={p.ID}
                      onClick={() => navigate('/prestecs')}
                      className="hover:bg-red-50 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 text-sm font-semibold text-primary">{p.ID}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 truncate max-w-[120px]">{p.Dispositiu_Nom || p.Dispositiu_ID}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 truncate max-w-[100px]">{p.Usuari}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-semibold text-red-600">
                          {dies !== null ? `${Math.abs(dies)}d vençut` : formatDate(p.Data_fi_prevista)}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>}
      </div>
      )}

      {/* Reserves properes */}
      {canAccess.reserves && <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <SectionHeader
            title="Reserves properes (7 dies)"
            linkLabel="Veure totes"
            onClick={() => navigate('/reserves')}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Data</th>
                <th className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Hora</th>
                <th className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Espai</th>
                <th className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Usuari</th>
                <th className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Estat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {lRes && [...Array(3)].map((_, i) => (
                <tr key={i}>
                  {[...Array(5)].map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-3 bg-gray-200 rounded animate-pulse" style={{ width: `${40 + (j * 13) % 40}%` }} />
                    </td>
                  ))}
                </tr>
              ))}
              {!lRes && stats.reservesProximes.length === 0 && (
                <EmptyRow cols={5} msg="Cap reserva per als propers 7 dies." />
              )}
              {!lRes && stats.reservesProximes.map((r) => {
                const esAvui = r.Data === TODAY
                return (
                  <tr
                    key={r.ID}
                    onClick={() => navigate('/reserves')}
                    className={`cursor-pointer transition-colors ${esAvui ? 'bg-green-50 hover:bg-green-100' : 'hover:bg-gray-50'}`}
                  >
                    <td className="px-4 py-3">
                      <span className={`text-sm font-semibold ${esAvui ? 'text-green-700' : 'text-text-main'}`}>
                        {esAvui ? 'Avui' : formatDateRes(r.Data)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{r.Hora_inici} – {r.Hora_fi}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 font-medium">{r.Espai}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 hidden sm:table-cell">{r.Usuari}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        r.Estat === 'Confirmada' ? 'bg-green-100 text-green-700' :
                        r.Estat === 'Pendent' ? 'bg-amber-100 text-amber-700' :
                        'bg-gray-100 text-gray-500'
                      }`}>
                        {r.Estat}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>}
    </div>
  )
}

import { useState, useMemo } from 'react'
import { Plus, RefreshCw, ChevronLeft, ChevronRight, BarChart2, CalendarDays } from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { useAuthStore } from '../../store/authStore'
import type { Substitucio, EstatSubstitucio } from './types'
import {
  formatDateISO, formatDiaLlarg, formatWeekRange, getWeekDates,
} from './substitucions.utils'
import { useUsuarisStore, potGestionar } from '../../store/usuarisStore'

type Tab = 'setmana' | 'estadistiques'

const ESTAT_COLORS: Record<EstatSubstitucio, string> = {
  Pendent:      'text-amber-700 bg-amber-100 border-amber-200',
  Realitzada:   'text-green-700 bg-green-100 border-green-200',
  'Cancel·lada':'text-gray-500 bg-gray-100 border-gray-200',
}

const MESOS_CA = ['Gener','Febrer','Març','Abril','Maig','Juny','Juliol','Agost','Setembre','Octubre','Novembre','Desembre']

interface Props {
  substitucions: Substitucio[]
  loading: boolean
  error: string | null
  onRefresh: () => void
  onNova: (dataInicial?: string) => void
  onVeure: (s: Substitucio) => void
}

function SubstitucioCard({
  s,
  myEmail,
  onClick,
}: {
  s: Substitucio
  myEmail: string
  onClick: () => void
}) {
  const usuaris = useUsuarisStore((st) => st.usuaris)
  const nomSubstitut = usuaris.find((u) => u.Email === s.ProfessorSubstitut)?.Nom || s.ProfessorSubstitut
  const nomAbsent = usuaris.find((u) => u.Email === s.ProfessorAbsent)?.Nom || s.ProfessorAbsent
  const isMine = s.ProfessorSubstitut === myEmail
  const isPati = s.Tipus === 'Pati'
  const isCancelled = s.Estat === 'Cancel·lada'

  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-lg border p-2.5 transition-all hover:shadow-md ${
        isCancelled
          ? 'opacity-50 bg-gray-50 border-gray-200'
          : isMine
          ? 'bg-orange-50 border-orange-200 hover:border-orange-300'
          : isPati
          ? 'bg-purple-50 border-purple-200 hover:border-purple-300'
          : 'bg-white border-gray-200 hover:border-gray-300'
      }`}
    >
      <div className="flex items-start justify-between gap-1 mb-1">
        <span className="text-[10px] font-semibold text-gray-500">{s.Franja}</span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium border ${ESTAT_COLORS[s.Estat]}`}>
          {s.Estat}
        </span>
      </div>
      {isPati ? (
        <p className="text-xs font-semibold text-purple-700">🏃 Pati</p>
      ) : (
        <>
          <p className="text-xs font-semibold text-text-main truncate">{s.Grup}</p>
          {s.Materia && <p className="text-[11px] text-gray-500 truncate">{s.Materia}</p>}
        </>
      )}
      <div className="mt-1.5 pt-1.5 border-t border-gray-100 space-y-0.5">
        <p className="text-[10px] text-red-500 truncate">Absent: {nomAbsent}</p>
        <p className={`text-[10px] truncate font-medium ${isMine ? 'text-orange-600' : 'text-green-600'}`}>
          Substitut: {nomSubstitut}
          {isMine && ' (tu)'}
        </p>
      </div>
      <span className="text-[10px] text-gray-400 mt-1 block">{s.Etapa}</span>
    </button>
  )
}

const CHART_COLORS = [
  '#861414', '#ff9c02', '#2563eb', '#16a34a', '#7c3aed',
  '#0891b2', '#c2410c', '#be185d', '#15803d', '#6d28d9',
  '#d97706', '#0284c7',
]

interface ChartEntry { name: string; classes: number; patis: number; color: string }

function GraficDistribucio({ dades }: { dades: ChartEntry[] }) {
  if (dades.length === 0) return null

  const pieClasses = dades.map((d) => ({ name: d.name, value: d.classes, color: d.color })).filter(d => d.value > 0)
  const piePatis   = dades.map((d) => ({ name: d.name, value: d.patis,   color: d.color })).filter(d => d.value > 0)

  const totalClasses = dades.reduce((s, d) => s + d.classes, 0)
  const totalPatis   = dades.reduce((s, d) => s + d.patis, 0)

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
      {/* Donut classes */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide text-center mb-1">Classes</p>
        <p className="text-2xl font-bold text-primary text-center mb-2">{totalClasses}</p>
        <div className="h-48 relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieClasses}
                cx="50%"
                cy="50%"
                innerRadius="55%"
                outerRadius="80%"
                dataKey="value"
                paddingAngle={2}
              >
                {pieClasses.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value, name) => [`${value} classes`, name]}
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Donut patis */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide text-center mb-1">Patis</p>
        <p className="text-2xl font-bold text-purple-600 text-center mb-2">{totalPatis}</p>
        <div className="h-48 relative">
          {totalPatis === 0 ? (
            <div className="h-full flex items-center justify-center">
              <p className="text-sm text-gray-300">Sense patis al període</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={piePatis}
                  cx="50%"
                  cy="50%"
                  innerRadius="55%"
                  outerRadius="80%"
                  dataKey="value"
                  paddingAngle={2}
                >
                  {piePatis.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, name) => [`${value} patis`, name]}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Llegenda compartida */}
      <div className="sm:col-span-2 flex flex-wrap gap-x-4 gap-y-1.5 px-1">
        {dades.map((d) => (
          <div key={d.name} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
            <span className="text-xs text-gray-600">{d.name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function FilaEstadistiques({
  nom,
  email,
  classes,
  patis,
  mesActual,
}: {
  nom: string
  email: string
  classes: number
  patis: number
  mesActual: number
}) {
  const total = classes + patis
  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50">
      <td className="px-4 py-3">
        <p className="text-sm font-medium text-text-main">{nom}</p>
        <p className="text-xs text-gray-400">{email}</p>
      </td>
      <td className="px-4 py-3 text-center">
        <span className="text-sm font-bold text-primary">{classes}</span>
      </td>
      <td className="px-4 py-3 text-center">
        <span className="text-sm font-bold text-purple-600">{patis}</span>
      </td>
      <td className="px-4 py-3 text-center">
        <span className="text-sm font-bold text-text-main">{total}</span>
      </td>
      <td className="px-4 py-3 text-center">
        <span className="text-sm text-gray-500">{mesActual}</span>
      </td>
    </tr>
  )
}

export function SubstitucionsPage({ substitucions, loading, error, onRefresh, onNova, onVeure }: Props) {
  const [tab, setTab] = useState<Tab>('setmana')
  const [weekOffset, setWeekOffset] = useState(0)
  const [filtreEstadistiques, setFiltreEstadistiques] = useState<'mes' | 'trimestre' | 'curs'>('mes')

  const rol = useUsuarisStore((s) => s.rol)
  const authEmail = useAuthStore((s) => s.user?.email ?? '')

  const canGestionar = potGestionar(rol)
  const weekDates = useMemo(() => getWeekDates(weekOffset), [weekOffset])
  const avui = formatDateISO(new Date())
  const isThisWeek = weekDates.some((d) => formatDateISO(d) === avui)

  const substitucionsPerDia = useMemo(() => {
    const map: Record<string, Substitucio[]> = {}
    weekDates.forEach((d) => { map[formatDateISO(d)] = [] })
    substitucions.forEach((s) => {
      if (map[s.Data]) map[s.Data].push(s)
    })
    // sort each day by franja
    Object.keys(map).forEach((k) => {
      map[k].sort((a, b) => a.Franja.localeCompare(b.Franja))
    })
    return map
  }, [substitucions, weekDates])

  // Estadístiques
  const usuaris = useUsuarisStore((s) => s.usuaris)
  const now = new Date()
  const estadistiques = useMemo(() => {
    const validSubst = substitucions.filter((s) => s.Estat !== 'Cancel·lada')

    const isPeriod = (iso: string) => {
      const d = new Date(iso + 'T00:00:00')
      if (filtreEstadistiques === 'mes') {
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
      }
      if (filtreEstadistiques === 'trimestre') {
        // 1r trim: set–des | 2n trim: gen–mar | 3r trim: abr–jun
        const trimestre = (m: number) => m >= 8 ? 1 : m <= 2 ? 2 : m <= 5 ? 3 : 0
        return trimestre(now.getMonth()) !== 0
          && trimestre(d.getMonth()) !== 0
          && trimestre(now.getMonth()) === trimestre(d.getMonth())
      }
      // curs escolar: setembre–juny (jul/ago queden fora)
      const cursInici = (m: number, y: number) => m >= 8 ? y : m <= 5 ? y - 1 : -1
      const cursActual = cursInici(now.getMonth(), now.getFullYear())
      const cursDat    = cursInici(d.getMonth(), d.getFullYear())
      return cursDat !== -1 && cursDat === cursActual
    }

    const mesActualFn = (iso: string) => {
      const d = new Date(iso + 'T00:00:00')
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
    }

    const map: Record<string, { nom: string; classes: number; patis: number; mesActual: number }> = {}
    validSubst.forEach((s) => {
      if (!isPeriod(s.Data)) return
      const email = s.ProfessorSubstitut
      if (!map[email]) {
        const u = usuaris.find((x) => x.Email === email)
        map[email] = { nom: u?.Nom || email, classes: 0, patis: 0, mesActual: 0 }
      }
      if (s.Tipus === 'Pati') map[email].patis++
      else map[email].classes++
    })

    // mesActual always = current month regardless of filter
    validSubst.forEach((s) => {
      if (!mesActualFn(s.Data) || s.Tipus === 'Pati') return
      const email = s.ProfessorSubstitut
      if (map[email]) map[email].mesActual++
    })

    return Object.entries(map)
      .map(([email, d]) => ({ email, ...d }))
      .sort((a, b) => (b.classes + b.patis) - (a.classes + a.patis))
  }, [substitucions, filtreEstadistiques, usuaris, now])

  const kpis = useMemo(() => ({
    setmana: substitucions.filter((s) =>
      weekDates.some((d) => formatDateISO(d) === s.Data) && s.Estat !== 'Cancel·lada'
    ).length,
    pendents: substitucions.filter((s) => s.Estat === 'Pendent').length,
    realitzades: substitucions.filter((s) => s.Estat === 'Realitzada').length,
  }), [substitucions, weekDates])

  const FILTRES_LABEL = { mes: `${MESOS_CA[now.getMonth()]}`, trimestre: 'Trimestre', curs: 'Curs' }

  return (
    <div className="flex flex-col h-full bg-surface">

      {/* Capçalera */}
      <div className="bg-white border-b border-gray-200 px-6 py-5 shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <CalendarDays size={20} className="text-primary" />
            <div>
              <h1 className="text-lg font-semibold text-text-main">Substitucions</h1>
              <p className="text-xs text-gray-400 mt-0.5">
                {loading ? 'Carregant...' : `${substitucions.length} substitucions registrades`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onRefresh} title="Actualitzar" className="p-2 text-gray-400 hover:text-primary hover:bg-gray-100 rounded-lg transition-colors">
              <RefreshCw size={17} className={loading ? 'animate-spin' : ''} />
            </button>
            {canGestionar && (
              <button
                onClick={() => onNova()}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg shadow-sm transition-opacity hover:opacity-90"
                style={{ backgroundColor: '#861414' }}
              >
                <Plus size={16} /> Nova substitució
              </button>
            )}
          </div>
        </div>

        {/* KPIs */}
        <div className="flex gap-5 mb-4">
          {[
            { label: 'Aquesta setmana', val: kpis.setmana, color: '#861414' },
            { label: 'Pendents',        val: kpis.pendents, color: '#d97706' },
            { label: 'Realitzades',     val: kpis.realitzades, color: '#15803d' },
          ].map(({ label, val, color }) => (
            <div key={label} className="flex items-center gap-1.5">
              <span className="text-xl font-bold" style={{ color }}>{val}</span>
              <span className="text-xs text-gray-500">{label}</span>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
          {([['setmana', 'Vista setmanal', CalendarDays], ['estadistiques', 'Estadístiques', BarChart2]] as const).map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                tab === key ? 'bg-white text-text-main shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}

      {/* ── Vista setmanal ── */}
      {tab === 'setmana' && (
        <div className="flex-1 overflow-auto px-6 py-4">
          {/* Navegació setmana */}
          <div className="flex items-center gap-2 mb-4">
            <button
              onClick={() => setWeekOffset((o) => o - 1)}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-white rounded-lg border border-gray-200 transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-medium text-gray-700 min-w-56 text-center">
              {formatWeekRange(weekDates)}
            </span>
            <button
              onClick={() => setWeekOffset((o) => o + 1)}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-white rounded-lg border border-gray-200 transition-colors"
            >
              <ChevronRight size={16} />
            </button>
            {!isThisWeek && (
              <button
                onClick={() => setWeekOffset(0)}
                className="ml-1 px-2.5 py-1 text-xs font-medium text-primary border border-primary/30 rounded-lg hover:bg-primary/5 transition-colors"
              >
                Setmana actual
              </button>
            )}
          </div>

          {/* Grid setmanal */}
          <div className="grid grid-cols-5 gap-3 min-w-[700px]">
            {weekDates.map((date) => {
              const iso = formatDateISO(date)
              const isAvui = iso === avui
              const subsDelDia = substitucionsPerDia[iso] ?? []

              return (
                <div key={iso} className={`flex flex-col gap-2`}>
                  {/* Capçalera dia */}
                  <div className={`rounded-lg px-2 py-2 text-center ${isAvui ? 'bg-primary text-white' : 'bg-white border border-gray-200'}`}>
                    <p className={`text-[11px] font-bold uppercase tracking-wide ${isAvui ? 'text-white/80' : 'text-gray-400'}`}>
                      {formatDiaLlarg(date).split(' ')[0]}
                    </p>
                    <p className={`text-lg font-bold leading-none mt-0.5 ${isAvui ? 'text-white' : 'text-text-main'}`}>
                      {date.getDate()}
                    </p>
                    {canGestionar && (
                      <button
                        onClick={() => onNova(iso)}
                        title="Afegir substitució"
                        className={`mt-1.5 flex items-center justify-center gap-1 w-full text-[10px] font-medium rounded py-0.5 transition-colors ${
                          isAvui
                            ? 'text-white/70 hover:text-white hover:bg-white/10'
                            : 'text-gray-400 hover:text-primary hover:bg-gray-50'
                        }`}
                      >
                        <Plus size={10} /> Afegir
                      </button>
                    )}
                  </div>

                  {/* Substitucions del dia */}
                  {loading ? (
                    <div className="space-y-2">
                      {[...Array(2)].map((_, i) => (
                        <div key={i} className="bg-white rounded-lg border border-gray-100 p-2.5 animate-pulse">
                          <div className="h-3 bg-gray-200 rounded w-3/4 mb-2" />
                          <div className="h-3 bg-gray-200 rounded w-1/2" />
                        </div>
                      ))}
                    </div>
                  ) : subsDelDia.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center py-6">
                      <p className="text-[11px] text-gray-300 text-center">Sense substitucions</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {subsDelDia.map((s) => (
                        <SubstitucioCard
                          key={s.ID}
                          s={s}
                          myEmail={authEmail}
                          onClick={() => onVeure(s)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Llegenda */}
          <div className="mt-6 flex flex-wrap gap-4 text-[11px] text-gray-500">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-orange-50 border border-orange-200" />
              Les meves substitucions
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-purple-50 border border-purple-200" />
              Pati
            </div>
          </div>
        </div>
      )}

      {/* ── Estadístiques ── */}
      {tab === 'estadistiques' && (
        <div className="flex-1 overflow-auto px-6 py-4">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs text-gray-500">Període:</span>
            {(['mes', 'trimestre', 'curs'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFiltreEstadistiques(f)}
                className={`px-3 py-1 text-xs font-medium rounded-lg border transition-colors ${
                  filtreEstadistiques === f
                    ? 'bg-primary text-white border-primary'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                }`}
              >
                {FILTRES_LABEL[f]}
              </button>
            ))}
          </div>

          {estadistiques.length === 0 ? (
            <div className="text-center py-16">
              <BarChart2 size={32} className="text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-400">Sense dades per al període seleccionat.</p>
            </div>
          ) : (
            <>
            <GraficDistribucio
              dades={estadistiques.map((e, i) => ({
                name: e.nom,
                classes: e.classes,
                patis: e.patis,
                color: CHART_COLORS[i % CHART_COLORS.length],
              }))}
            />
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Professor</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-primary uppercase tracking-wide">Classes</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-purple-600 uppercase tracking-wide">Patis</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Total</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                      {MESOS_CA[now.getMonth()]}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {estadistiques.map((e, i) => (
                    <FilaEstadistiques
                      key={e.email}
                      nom={i === 0 ? `🥇 ${e.nom}` : i === 1 ? `🥈 ${e.nom}` : i === 2 ? `🥉 ${e.nom}` : e.nom}
                      email={e.email}
                      classes={e.classes}
                      patis={e.patis}
                      mesActual={e.mesActual}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            </>
          )}

          <p className="text-[11px] text-gray-400 mt-3">
            Les substitucions cancel·lades no compten. Les de pati es compten per separat.
          </p>
        </div>
      )}
    </div>
  )
}

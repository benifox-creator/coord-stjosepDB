import { useState, useMemo } from 'react'
import { Plus, Search, RefreshCw, CalendarDays, Clock, ChevronLeft, ChevronRight } from 'lucide-react'
import type { Reserva, EstatReserva } from './types'
import { formatDate, formatTime, formatDateISO, isDiaAvui } from './reserves.utils'
import { useConfigStore } from '../../store/configStore'
import { useUsuarisStore, potGestionar } from '../../store/usuarisStore'

const AVUI = formatDateISO(new Date())
const MOCK: Reserva[] = [
  {
    ID: 'RES-001', Espai: "Aula d'informàtica",
    Usuari: 'Pere Fonts', Email: 'pere.fonts@stjosep.org',
    Data: AVUI, Hora_inici: '10:00', Hora_fi: '12:00',
    Motiu: 'Classe de programació amb 4t ESO',
    Estat: 'Confirmada', Creat_el: '2026-06-20 09:15', _rowIndex: 0,
  },
  {
    ID: 'RES-002', Espai: 'Sala de reunions',
    Usuari: 'Maria López', Email: 'maria.lopez@stjosep.org',
    Data: AVUI, Hora_inici: '14:00', Hora_fi: '15:30',
    Motiu: 'Reunió de cicle amb equip docent',
    Estat: 'Pendent', Creat_el: '2026-06-22 11:00', _rowIndex: 1,
  },
  {
    ID: 'RES-003', Espai: "Sala d'actes",
    Usuari: 'Anna Puig', Email: 'anna.puig@stjosep.org',
    Data: '2026-06-25', Hora_inici: '09:00', Hora_fi: '13:00',
    Motiu: 'Acte final de curs',
    Estat: 'Confirmada', Creat_el: '2026-06-15 10:30', _rowIndex: 2,
  },
  {
    ID: 'RES-004', Espai: 'Biblioteca',
    Usuari: 'Jordi Mas', Email: 'jordi.mas@stjosep.org',
    Data: '2026-06-24', Hora_inici: '11:00', Hora_fi: '12:00',
    Motiu: 'Sessió de lectura amb 1r ESO',
    Estat: 'Pendent', Creat_el: '2026-06-22 16:00', _rowIndex: 3,
  },
]

const ESPAI_PALETTE = [
  '#2563eb', '#16a34a', '#dc2626', '#d97706',
  '#7c3aed', '#0891b2', '#c2410c', '#be185d', '#15803d', '#6d28d9',
]

const MESOS_CA = ['Gener','Febrer','Març','Abril','Maig','Juny','Juliol','Agost','Setembre','Octubre','Novembre','Desembre']
const DIES_CA  = ['Dl','Dm','Dc','Dj','Dv','Ds','Dg']

function diaISO(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

interface CalendariMesProps {
  mesDate: Date
  avui: string
  reservesByDate: Record<string, Reserva[]>
  espaiColor: (espai: string) => string
  diaSeleccionat: string
  onSeleccionarDia: (iso: string) => void
}

function CalendariMes({ mesDate, avui, reservesByDate, espaiColor, diaSeleccionat, onSeleccionarDia }: CalendariMesProps) {
  const year  = mesDate.getFullYear()
  const month = mesDate.getMonth()
  const diesDelMes = new Date(year, month + 1, 0).getDate()
  const primerDia  = new Date(year, month, 1).getDay()
  const offset     = primerDia === 0 ? 6 : primerDia - 1

  const cells: (number | null)[] = [
    ...Array(offset).fill(null),
    ...Array.from({ length: diesDelMes }, (_, i) => i + 1),
  ]

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-3 py-2.5 border-b border-gray-100" style={{ background: 'linear-gradient(to right, rgba(134,20,20,0.06), rgba(255,156,2,0.06))' }}>
        <p className="text-[11px] font-bold text-primary uppercase tracking-widest text-center">
          {MESOS_CA[month]} {year}
        </p>
      </div>
      <div className="px-3 pt-2 pb-3">
        <div className="grid grid-cols-7 mb-1.5">
          {DIES_CA.map((d) => (
            <div key={d} className="text-center text-[10px] font-semibold text-gray-400 py-0.5">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-y-0.5">
          {cells.map((day, idx) => {
            if (!day) return <div key={idx} />
            const iso = diaISO(year, month, day)
            const reserves = reservesByDate[iso] ?? []
            const actives = reserves.filter((r) => r.Estat !== 'Cancel·lada')
            const espais  = [...new Set(actives.map((r) => r.Espai))]
            const isAvui  = iso === avui
            const isSel   = iso === diaSeleccionat
            const teRes   = actives.length > 0

            return (
              <button
                key={idx}
                onClick={() => teRes && onSeleccionarDia(isSel ? '' : iso)}
                disabled={!teRes}
                className={`flex flex-col items-center py-0.5 rounded-md transition-colors text-xs ${
                  isSel
                    ? 'bg-primary text-white'
                    : isAvui
                    ? 'ring-1 ring-primary text-primary font-bold'
                    : teRes
                    ? 'hover:bg-gray-100 cursor-pointer'
                    : 'cursor-default'
                }`}
              >
                <span className={`leading-5 font-medium ${isSel ? 'text-white' : isAvui ? 'text-primary' : teRes ? 'text-gray-700' : 'text-gray-300'}`}>
                  {day}
                </span>
                {teRes && (
                  <div className="flex gap-0.5 mt-0.5 flex-wrap justify-center">
                    {espais.slice(0, 4).map((e) => (
                      <div
                        key={e}
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: isSel ? 'white' : espaiColor(e) }}
                      />
                    ))}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

interface CalendariProps {
  reserves: Reserva[]
  espais: string[]
  diaSeleccionat: string
  onSeleccionarDia: (iso: string) => void
}

function CalendariReserves({ reserves, espais, diaSeleccionat, onSeleccionarDia }: CalendariProps) {
  const [offsetMes, setOffsetMes] = useState(0)
  const avui = formatDateISO(new Date())
  const rol = useUsuarisStore((s) => s.rol)
  const canGestionar = potGestionar(rol)
  const colors = useConfigStore((s) => s.getValues('reserves.espais-colors'))
  const update = useConfigStore((s) => s.update)

  const espaiColor = useMemo(() => {
    const map: Record<string, string> = {}
    espais.forEach((e, i) => {
      map[e] = colors[i] || ESPAI_PALETTE[i % ESPAI_PALETTE.length]
    })
    return (espai: string) => map[espai] ?? '#6b7280'
  }, [espais, colors])

  const reservesByDate = useMemo(() => {
    const map: Record<string, Reserva[]> = {}
    reserves.forEach((r) => {
      if (!map[r.Data]) map[r.Data] = []
      map[r.Data].push(r)
    })
    return map
  }, [reserves])

  const mesos = [-1, 0, 1].map((offset) => {
    const base = new Date()
    return new Date(base.getFullYear(), base.getMonth() + offset + offsetMes, 1)
  })

  const espaisUsats = useMemo(() => {
    const set = new Set(reserves.filter(r => r.Estat !== 'Cancel·lada').map(r => r.Espai))
    return espais.filter(e => set.has(e))
  }, [reserves, espais])

  function handleColorChange(espaiIdx: number, color: string) {
    const newColors = espais.map((_, i) => colors[i] || ESPAI_PALETTE[i % ESPAI_PALETTE.length])
    newColors[espaiIdx] = color
    update('reserves.espais-colors', newColors)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Calendari de reserves</p>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setOffsetMes((o) => o - 1)}
            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-white rounded transition-colors"
          >
            <ChevronLeft size={14} />
          </button>
          {offsetMes !== 0 && (
            <button
              onClick={() => setOffsetMes(0)}
              className="px-2 py-0.5 text-xs text-primary hover:underline"
            >
              Avui
            </button>
          )}
          <button
            onClick={() => setOffsetMes((o) => o + 1)}
            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-white rounded transition-colors"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {mesos.map((m) => (
          <CalendariMes
            key={m.toISOString()}
            mesDate={m}
            avui={avui}
            reservesByDate={reservesByDate}
            espaiColor={espaiColor}
            diaSeleccionat={diaSeleccionat}
            onSeleccionarDia={onSeleccionarDia}
          />
        ))}
      </div>

      {espaisUsats.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Espais</p>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {espaisUsats.map((e) => {
              const idx = espais.indexOf(e)
              const color = colors[idx] || ESPAI_PALETTE[idx % ESPAI_PALETTE.length]
              return (
                <div key={e} className="flex items-center gap-1.5">
                  {canGestionar ? (
                    <label className="cursor-pointer group" title="Fes clic per canviar el color">
                      <input
                        type="color"
                        className="sr-only"
                        value={color}
                        onChange={(ev) => handleColorChange(idx, ev.target.value)}
                      />
                      <div
                        className="w-3 h-3 rounded-full shrink-0 ring-1 ring-black/10 group-hover:scale-125 transition-transform"
                        style={{ backgroundColor: color }}
                      />
                    </label>
                  ) : (
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  )}
                  <span className="text-xs text-gray-600">{e}</span>
                </div>
              )
            })}
          </div>
          {canGestionar && (
            <p className="text-[10px] text-gray-400 mt-2.5">Fes clic als punts de color per personalitzar-los.</p>
          )}
        </div>
      )}
    </div>
  )
}

const ESTATS: Array<EstatReserva | ''> = ['', 'Pendent', 'Confirmada', 'Cancel·lada']

function SkeletonRow() {
  return (
    <tr className="border-b border-gray-100">
      {[...Array(5)].map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-gray-200 rounded animate-pulse" style={{ width: `${45 + (i * 17) % 50}%` }} />
        </td>
      ))}
    </tr>
  )
}

function EstatBadge({ estat }: { estat: EstatReserva }) {
  const map: Record<EstatReserva, string> = {
    Pendent: 'bg-amber-100 text-amber-700 border-amber-200',
    Confirmada: 'bg-green-100 text-green-700 border-green-200',
    'Cancel·lada': 'bg-gray-100 text-gray-500 border-gray-200',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${map[estat]}`}>
      {estat}
    </span>
  )
}

interface Props {
  onNova: () => void
  onVeureDetall: (reserva: Reserva) => void
  loading?: boolean
  reserves?: Reserva[]
  error?: string | null
  onRefresh?: () => void
}

export function ReservesPage({
  onNova,
  onVeureDetall,
  loading = false,
  reserves = MOCK,
  error = null,
  onRefresh,
}: Props) {
  const espais = useConfigStore((s) => s.getValues('reserves.espais'))
  const [cerca, setCerca] = useState('')
  const [filtreEstat, setFiltreEstat] = useState<EstatReserva | ''>('')
  const [filtreData, setFiltreData] = useState('')

  const filtrades = useMemo(() => {
    const q = cerca.toLowerCase()
    return [...reserves]
      .sort((a, b) => {
        const cmp = a.Data.localeCompare(b.Data)
        return cmp !== 0 ? cmp : a.Hora_inici.localeCompare(b.Hora_inici)
      })
      .filter((r) => {
        if (filtreEstat && r.Estat !== filtreEstat) return false
        if (filtreData && r.Data !== filtreData) return false
        if (q) {
          const h = `${r.ID} ${r.Espai} ${r.Usuari} ${r.Email} ${r.Motiu}`.toLowerCase()
          if (!h.includes(q)) return false
        }
        return true
      })
  }, [reserves, filtreEstat, filtreData, cerca])

  const comptadors = useMemo(() => ({
    avui: reserves.filter((r) => isDiaAvui(r.Data) && r.Estat !== 'Cancel·lada').length,
    pendents: reserves.filter((r) => r.Estat === 'Pendent').length,
    confirmades: reserves.filter((r) => r.Estat === 'Confirmada').length,
  }), [reserves])

  return (
    <div className="flex flex-col h-full bg-surface">
      {/* Capçalera */}
      <div className="bg-white border-b border-gray-200 px-6 py-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <CalendarDays size={20} className="text-primary" />
            <div>
              <h1 className="text-lg font-semibold text-text-main">Reserves d'espais</h1>
              <p className="text-xs text-gray-400 mt-0.5">
                {loading ? 'Carregant...' : `${filtrades.length} de ${reserves.length} reserves`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onRefresh && (
              <button onClick={onRefresh} title="Actualitzar" className="p-2 text-gray-400 hover:text-primary hover:bg-gray-100 rounded-lg transition-colors">
                <RefreshCw size={17} className={loading ? 'animate-spin' : ''} />
              </button>
            )}
            <button
              onClick={onNova}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg shadow-sm transition-opacity hover:opacity-90"
              style={{ backgroundColor: '#861414' }}
            >
              <Plus size={16} /> Nova reserva
            </button>
          </div>
        </div>

        {/* KPIs */}
        <div className="flex gap-5 mb-4">
          {[
            { label: 'Avui', val: comptadors.avui, color: '#861414' },
            { label: 'Pendents', val: comptadors.pendents, color: '#d97706' },
            { label: 'Confirmades', val: comptadors.confirmades, color: '#15803d' },
          ].map(({ label, val, color }) => (
            <div key={label} className="flex items-center gap-1.5">
              <span className="text-xl font-bold" style={{ color }}>{val}</span>
              <span className="text-xs text-gray-500">{label}</span>
            </div>
          ))}
        </div>

        {/* Filtres */}
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-52">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text" value={cerca}
              onChange={(e) => setCerca(e.target.value)}
              placeholder="Cercar per espai, usuari, motiu..."
              className="input pl-8 text-sm w-full"
            />
          </div>
          <input
            type="date" value={filtreData}
            onChange={(e) => setFiltreData(e.target.value)}
            className="input text-sm w-44" title="Filtrar per data"
          />
          <select
            value={filtreEstat}
            onChange={(e) => setFiltreEstat(e.target.value as EstatReserva | '')}
            className="input text-sm w-40"
          >
            <option value="">Tots els estats</option>
            {ESTATS.slice(1).map((e) => <option key={e}>{e}</option>)}
          </select>
          {(filtreData || filtreEstat || cerca) && (
            <button
              onClick={() => { setCerca(''); setFiltreData(''); setFiltreEstat('') }}
              className="text-xs text-gray-400 hover:text-gray-600 px-2"
            >
              Netejar filtres
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}

      {/* Calendari */}
      <div className="px-6 pt-4">
        <CalendariReserves
          reserves={reserves}
          espais={espais}
          diaSeleccionat={filtreData}
          onSeleccionarDia={setFiltreData}
        />
      </div>

      {/* Taula */}
      <div className="flex-1 overflow-auto mt-4">
        <table className="w-full min-w-[600px]">
          <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">ID</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Espai</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Data i hora</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Usuari</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Estat</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {loading && [...Array(4)].map((_, i) => <SkeletonRow key={i} />)}

            {!loading && filtrades.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-16 text-center text-gray-400 text-sm">
                  {reserves.length === 0
                    ? 'Encara no hi ha reserves registrades.'
                    : filtreData
                    ? 'Cap reserva per al dia seleccionat.'
                    : 'Cap reserva coincideix amb els filtres.'}
                </td>
              </tr>
            )}

            {!loading && filtrades.map((r) => {
              const esAvui = isDiaAvui(r.Data)
              return (
                <tr
                  key={r.ID}
                  onClick={() => onVeureDetall(r)}
                  className={`hover:bg-gray-50 cursor-pointer transition-colors group ${esAvui && r.Estat === 'Confirmada' ? 'bg-green-50/40' : ''}`}
                >
                  <td className="px-4 py-3">
                    <span className="text-sm font-semibold text-primary group-hover:underline">{r.ID}</span>
                    {esAvui && r.Estat !== 'Cancel·lada' && (
                      <span className="ml-1.5 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">Avui</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-text-main">{r.Espai}</p>
                    <p className="text-xs text-gray-400 mt-0.5 truncate max-w-48">{r.Motiu}</p>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <p className="text-sm text-gray-700">{formatDate(r.Data)}</p>
                    <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                      <Clock size={11} />
                      {formatTime(r.Hora_inici)} – {formatTime(r.Hora_fi)}
                    </p>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <p className="text-sm text-gray-700">{r.Usuari}</p>
                    <p className="text-xs text-gray-400">{r.Email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <EstatBadge estat={r.Estat} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

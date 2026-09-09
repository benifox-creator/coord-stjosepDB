import { useState, useMemo } from 'react'
import { Plus, RefreshCw, CalendarOff, Timer, Clock, Users, Award } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import type { Absencia } from './types'
import { formatDate, cursInici } from '../substitucions/substitucions.utils'
import { useUsuarisStore, potCrear, potAprovarAbsencies, potGestionar } from '../../store/usuarisStore'
import { useAuthStore } from '../../store/authStore'
import { ETAPA_GRUP, GRUP_ETAPA_LABELS, type GrupEtapa } from '../usuaris/types'

const ESTAT_COLORS: Record<Absencia['Estat'], string> = {
  'Pendent revisió': 'text-amber-700 bg-amber-100 border-amber-200',
  'Aprovada': 'text-green-700 bg-green-100 border-green-200',
  'Rebutjada': 'text-red-700 bg-red-100 border-red-200',
}

const COLOR_LECTIVES = '#861414'
const COLOR_NO_LECTIVES = '#d97706'

interface KpiCardProps { icon: React.ElementType; label: string; value: string; accent: string }

function KpiCard({ icon: Icon, label, value, accent }: KpiCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
      <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${accent}1a` }}>
        <Icon size={17} style={{ color: accent }} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] text-gray-400 uppercase tracking-wide truncate">{label}</p>
        <p className="text-lg font-bold text-text-main truncate">{value}</p>
      </div>
    </div>
  )
}

function formatH(n: number): string {
  return `${n.toString().replace('.', ',')}h`
}

interface Props {
  absencies: Absencia[]
  loading: boolean
  error: string | null
  onRefresh: () => void
  onNova: () => void
  onVeure: (a: Absencia) => void
}

export function AbsenciesTab({ absencies, loading, error, onRefresh, onNova, onVeure }: Props) {
  const rol = useUsuarisStore((s) => s.rol)
  const usuaris = useUsuarisStore((s) => s.usuaris)
  const email = useAuthStore((s) => s.user?.email)
  const emailLower = email?.toLowerCase()
  const [vista, setVista] = useState<'llista' | 'recompte'>('llista')
  const [grupFiltre, setGrupFiltre] = useState<'tots' | GrupEtapa>('tots')
  const potRecompte = potAprovarAbsencies(rol)

  const absenciesVisibles = useMemo(
    () => (potGestionar(rol) ? absencies : absencies.filter((a) => a.Professor === emailLower)),
    [absencies, rol, emailLower]
  )

  const pendents = absenciesVisibles.filter((a) => a.Estat === 'Pendent revisió').length

  const recompte = useMemo(() => {
    const now = new Date()
    const cursActual = cursInici(now.getMonth(), now.getFullYear())
    const totals = new Map<string, { lectives: number; noLectives: number }>()
    for (const a of absencies) {
      if (a.Estat !== 'Aprovada') continue
      const d = new Date(a.Data + 'T00:00:00')
      if (cursInici(d.getMonth(), d.getFullYear()) !== cursActual) continue
      const prev = totals.get(a.Professor) ?? { lectives: 0, noLectives: 0 }
      totals.set(a.Professor, {
        lectives: prev.lectives + (a.Hores - a.HoresNoLectives),
        noLectives: prev.noLectives + a.HoresNoLectives,
      })
    }
    return Array.from(totals.entries())
      .map(([email, t]) => {
        const etapa = usuaris.find((u) => u.Email === email)?.Etapa ?? null
        return {
          email,
          nom: usuaris.find((u) => u.Email === email)?.Nom || email,
          grup: etapa ? ETAPA_GRUP[etapa] : null,
          lectives: Math.round(t.lectives * 100) / 100,
          noLectives: Math.round(t.noLectives * 100) / 100,
          total: Math.round((t.lectives + t.noLectives) * 100) / 100,
        }
      })
      .sort((a, b) => b.total - a.total)
  }, [absencies, usuaris])

  const recompteFiltrat = useMemo(
    () => (grupFiltre === 'tots' ? recompte : recompte.filter((r) => r.grup === grupFiltre)),
    [recompte, grupFiltre]
  )

  const sensEtapaCount = useMemo(() => recompte.filter((r) => r.grup === null).length, [recompte])

  const totalHoresCurs = useMemo(() => Math.round(recompteFiltrat.reduce((s, r) => s + r.total, 0) * 100) / 100, [recompteFiltrat])

  return (
    <div className="flex-1 overflow-auto px-6 py-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {potCrear(rol) && (
            <button
              onClick={onNova}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white rounded-lg"
              style={{ backgroundColor: '#861414' }}
            >
              <Plus size={14} /> Nova absència
            </button>
          )}
          {pendents > 0 && (
            <span className="text-xs text-amber-700 bg-amber-100 border border-amber-200 px-2 py-1 rounded-full">
              {pendents} pendent{pendents > 1 ? 's' : ''} de revisar
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {potRecompte && (
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              {([['llista', 'Absències', CalendarOff], ['recompte', "Recompte d'hores", Timer]] as const).map(([key, label, Icon]) => (
                <button
                  key={key}
                  onClick={() => setVista(key)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                    vista === key ? 'bg-white text-text-main shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Icon size={13} /> {label}
                </button>
              ))}
            </div>
          )}
          <button onClick={onRefresh} className="p-1.5 text-gray-400 hover:text-gray-600">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}

      {vista === 'llista' ? (
        <div className="space-y-2">
          {absenciesVisibles.length === 0 && !loading && (
            <p className="text-sm text-gray-400 text-center py-8">Encara no hi ha cap absència reportada.</p>
          )}
          {absenciesVisibles.map((a) => {
            const nom = usuaris.find((u) => u.Email === a.Professor)?.Nom || a.Professor
            return (
              <button
                key={a.id}
                onClick={() => onVeure(a)}
                className="w-full text-left flex items-center justify-between gap-3 bg-white border border-gray-200 rounded-lg p-3 hover:border-gray-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full border ${ESTAT_COLORS[a.Estat]}`}>
                    {a.Estat}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-text-main">{nom}</p>
                    <p className="text-xs text-gray-400">{formatDate(a.Data)} · {a.HoraInici}–{a.HoraFi} · {a.Motiu}</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xs font-semibold text-text-main">
                    {a.Hores.toString().replace('.', ',')}h
                  </span>
                  {a.HoresNoLectives > 0 && (
                    <p className="text-[10px] text-amber-600">{a.HoresNoLectives.toString().replace('.', ',')}h no lectives</p>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      ) : recompte.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg py-12 text-center text-gray-400 text-sm">
          Encara no hi ha absències aprovades aquest curs.
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              {([['tots', 'Tots'], ['INF-PRI', 'INF-PRI'], ['SEC', 'SEC']] as const).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setGrupFiltre(key)}
                  title={key === 'tots' ? undefined : GRUP_ETAPA_LABELS[key]}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                    grupFiltre === key ? 'bg-white text-text-main shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {sensEtapaCount > 0 && (
              <span className="text-[11px] text-gray-400">
                {sensEtapaCount} professor{sensEtapaCount > 1 ? 's' : ''} sense etapa assignada (no {sensEtapaCount > 1 ? 'apareixen' : 'apareix'} als filtres INF-PRI/SEC) — configura-ho a Configuració › Usuaris.
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <KpiCard icon={Clock} label="Hores totals (curs)" value={formatH(totalHoresCurs)} accent={COLOR_LECTIVES} />
            <KpiCard icon={Award} label="Més hores faltades" value={recompteFiltrat[0]?.nom ?? '—'} accent={COLOR_NO_LECTIVES} />
            <KpiCard icon={Users} label="Professors amb absències" value={String(recompteFiltrat.length)} accent="#2563eb" />
          </div>

          {recompteFiltrat.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-lg py-12 text-center text-gray-400 text-sm">
              Cap professor amb absències en aquest grup.
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-center gap-4 mb-3 text-xs text-gray-500">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: COLOR_LECTIVES }} /> Lectives</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: COLOR_NO_LECTIVES }} /> No lectives (sense substitut)</span>
              </div>
              <div style={{ width: '100%', height: Math.max(160, recompteFiltrat.length * 42) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={recompteFiltrat} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis
                      type="category"
                      dataKey="nom"
                      width={140}
                      tick={{ fontSize: 12, fill: '#374151' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      formatter={(value, name) => [`${value}h`, name === 'lectives' ? 'Lectives' : 'No lectives']}
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                    />
                    <Bar dataKey="lectives" stackId="hores" fill={COLOR_LECTIVES} radius={[0, 0, 0, 0]} />
                    <Bar dataKey="noLectives" stackId="hores" fill={COLOR_NO_LECTIVES} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

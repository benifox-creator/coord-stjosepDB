import { useState, useMemo } from 'react'
import { Plus, RefreshCw, CalendarOff, Timer } from 'lucide-react'
import type { Absencia } from './types'
import { formatDate } from '../substitucions/substitucions.utils'
import { useUsuarisStore, potCrear, potAprovarAbsencies } from '../../store/usuarisStore'

const ESTAT_COLORS: Record<Absencia['Estat'], string> = {
  'Pendent revisió': 'text-amber-700 bg-amber-100 border-amber-200',
  'Aprovada': 'text-green-700 bg-green-100 border-green-200',
  'Rebutjada': 'text-red-700 bg-red-100 border-red-200',
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
  const [vista, setVista] = useState<'llista' | 'recompte'>('llista')
  const potRecompte = potAprovarAbsencies(rol)

  const pendents = absencies.filter((a) => a.Estat === 'Pendent revisió').length

  const recompte = useMemo(() => {
    const totals = new Map<string, number>()
    for (const a of absencies) {
      if (a.Estat !== 'Aprovada') continue
      totals.set(a.Professor, (totals.get(a.Professor) ?? 0) + a.Hores)
    }
    return Array.from(totals.entries())
      .map(([email, hores]) => ({
        email,
        hores,
        nom: usuaris.find((u) => u.Email === email)?.Nom || email,
      }))
      .sort((a, b) => b.hores - a.hores)
  }, [absencies, usuaris])

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
          {absencies.length === 0 && !loading && (
            <p className="text-sm text-gray-400 text-center py-8">Encara no hi ha cap absència reportada.</p>
          )}
          {absencies.map((a) => {
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
                <span className="text-xs font-semibold text-text-main shrink-0">
                  {a.Hores.toString().replace('.', ',')}h
                </span>
              </button>
            )
          })}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs text-gray-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">Professor</th>
                <th className="px-4 py-2.5 font-medium text-right">Hores faltades (curs)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {recompte.length === 0 && (
                <tr><td colSpan={2} className="px-4 py-8 text-center text-gray-400">Encara no hi ha absències aprovades.</td></tr>
              )}
              {recompte.map((r) => (
                <tr key={r.email}>
                  <td className="px-4 py-2.5 text-text-main">{r.nom}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-text-main">{r.hores.toString().replace('.', ',')}h</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

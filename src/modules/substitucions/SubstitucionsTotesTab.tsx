import { useState, useMemo } from 'react'
import { Search } from 'lucide-react'
import type { Substitucio, EstatSubstitucio } from './types'
import { formatDate } from './substitucions.utils'
import { useUsuarisStore } from '../../store/usuarisStore'

const ESTAT_COLORS: Record<EstatSubstitucio, string> = {
  Pendent:      'text-amber-700 bg-amber-100 border-amber-200',
  Realitzada:   'text-green-700 bg-green-100 border-green-200',
  'Cancel·lada':'text-gray-500 bg-gray-100 border-gray-200',
}

interface Props {
  substitucions: Substitucio[]
  loading: boolean
  onVeure: (s: Substitucio) => void
}

export function SubstitucionsTotesTab({ substitucions, loading, onVeure }: Props) {
  const usuaris = useUsuarisStore((s) => s.usuaris)
  const [cerca, setCerca] = useState('')
  const [filtreEstat, setFiltreEstat] = useState<EstatSubstitucio | 'Totes'>('Totes')

  function nom(email: string): string {
    return usuaris.find((u) => u.Email === email)?.Nom || email
  }

  const filtrades = useMemo(() => {
    const q = cerca.trim().toLowerCase()
    return substitucions
      .filter((s) => filtreEstat === 'Totes' || s.Estat === filtreEstat)
      .filter((s) => {
        if (!q) return true
        return [nom(s.ProfessorAbsent), nom(s.ProfessorSubstitut), s.Grup, s.Materia]
          .some((v) => v.toLowerCase().includes(q))
      })
      .sort((a, b) => b.Data.localeCompare(a.Data) || b.Franja.localeCompare(a.Franja))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [substitucions, cerca, filtreEstat, usuaris])

  return (
    <div className="flex-1 overflow-auto px-6 py-4">
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={cerca}
            onChange={(e) => setCerca(e.target.value)}
            placeholder="Cerca per professor, grup o matèria..."
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        {(['Totes', 'Pendent', 'Realitzada', 'Cancel·lada'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFiltreEstat(f)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              filtreEstat === f ? 'bg-primary text-white border-primary' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Data</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Franja</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Grup / Pati</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Absent</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Substitut</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Estat</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">Carregant...</td></tr>
            )}
            {!loading && filtrades.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">Cap substitució coincideix amb la cerca.</td></tr>
            )}
            {filtrades.map((s) => (
              <tr
                key={s.id}
                onClick={() => onVeure(s)}
                className="border-b border-gray-100 last:border-0 hover:bg-gray-50 cursor-pointer"
              >
                <td className="px-4 py-2.5 text-sm text-text-main whitespace-nowrap">{formatDate(s.Data)}</td>
                <td className="px-4 py-2.5 text-sm text-gray-500 whitespace-nowrap">{s.Franja}</td>
                <td className="px-4 py-2.5 text-sm text-text-main">
                  {s.Tipus === 'Pati' ? '🏃 Pati' : (s.Grup || '—')}
                  {s.Materia && <span className="text-gray-400"> · {s.Materia}</span>}
                </td>
                <td className="px-4 py-2.5 text-sm text-gray-600">{nom(s.ProfessorAbsent)}</td>
                <td className="px-4 py-2.5 text-sm text-gray-600">{nom(s.ProfessorSubstitut)}</td>
                <td className="px-4 py-2.5">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${ESTAT_COLORS[s.Estat]}`}>{s.Estat}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

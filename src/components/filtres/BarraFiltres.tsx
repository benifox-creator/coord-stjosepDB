import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import type { DefinicioFiltre, ValorsFiltres } from './filtres'
import { filtresActius } from './filtres'

interface Props {
  definicions: DefinicioFiltre[]
  valors: ValorsFiltres
  onCanvia: (clau: string, valor: string) => void
  // Posa tots els filtres a '' sense tocar la cerca.
  onEsborra: () => void
  cerca?: string
  onCerca?: (text: string) => void
  placeholder?: string
  children?: ReactNode
}

function CampFiltre({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-gray-500">{label}</span>
      {children}
    </label>
  )
}

export function BarraFiltres({ definicions, valors, onCanvia, onEsborra, cerca, onCerca, placeholder, children }: Props) {
  const [panellObert, setPanellObert] = useState(false)
  const panellRef = useRef<HTMLDivElement>(null)
  const actius = filtresActius(definicions, valors)
  const ambCerca = cerca !== undefined && onCerca !== undefined

  // El panell es tanca clicant fora o amb Esc, com qualsevol menú.
  useEffect(() => {
    if (!panellObert) return
    function clic(e: MouseEvent) {
      if (panellRef.current && !panellRef.current.contains(e.target as Node)) setPanellObert(false)
    }
    function tecla(e: KeyboardEvent) {
      if (e.key === 'Escape') setPanellObert(false)
    }
    document.addEventListener('mousedown', clic)
    document.addEventListener('keydown', tecla)
    return () => {
      document.removeEventListener('mousedown', clic)
      document.removeEventListener('keydown', tecla)
    }
  }, [panellObert])

  return (
    <>
      <div className="flex flex-wrap gap-2 mt-3">
        {ambCerca && (
          <div className="relative flex-1 min-w-48">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={cerca}
              onChange={(e) => onCerca(e.target.value)}
              placeholder={placeholder}
              className="input pl-8 text-sm w-full"
            />
          </div>
        )}
        {children}
        <div ref={panellRef} className="relative ml-auto">
          <button
            type="button"
            aria-expanded={panellObert}
            onClick={() => setPanellObert((o) => !o)}
            className={`flex items-center gap-1.5 h-full min-h-9 px-3 text-sm font-medium border rounded-lg transition-colors ${
              actius.length > 0 ? 'border-primary/40 text-primary bg-primary/5' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <SlidersHorizontal size={14} />
            Filtres
            {actius.length > 0 && (
              <span className="min-w-5 h-5 px-1 rounded-full bg-primary text-white text-xs flex items-center justify-center">
                {actius.length}
              </span>
            )}
          </button>
          {panellObert && (
            <div className="absolute right-0 top-full mt-1 w-72 bg-white border border-gray-200 rounded-xl shadow-lg p-3 z-20 space-y-2.5">
              {definicions.map((d) => (
                <CampFiltre key={d.clau} label={d.label}>
                  {d.tipus === 'select' ? (
                    <select value={valors[d.clau] ?? ''} onChange={(e) => onCanvia(d.clau, e.target.value)} className="input text-sm w-full">
                      <option value="">{d.totes}</option>
                      {d.opcions.map((o) => <option key={o.valor} value={o.valor}>{o.etiqueta}</option>)}
                    </select>
                  ) : (
                    <input
                      type="date"
                      value={valors[d.clau] ?? ''}
                      min={d.min || undefined}
                      max={d.max || undefined}
                      onChange={(e) => onCanvia(d.clau, e.target.value)}
                      className="input text-sm w-full"
                    />
                  )}
                </CampFiltre>
              ))}
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={onEsborra}
                  disabled={actius.length === 0}
                  className="text-xs text-primary hover:underline disabled:opacity-40 disabled:no-underline"
                >
                  Esborra filtres
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Xips dels filtres actius */}
      {actius.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mt-2">
          {actius.map(({ clau, etiqueta }) => (
            <span key={clau} className="flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-full bg-gray-100 text-xs text-gray-700">
              {etiqueta}
              <button
                type="button"
                onClick={() => onCanvia(clau, '')}
                aria-label={`Treu el filtre ${etiqueta}`}
                className="p-0.5 rounded-full text-gray-500 hover:bg-gray-200 hover:text-gray-700"
              >
                <X size={12} />
              </button>
            </span>
          ))}
          {actius.length > 1 && (
            <button type="button" onClick={onEsborra} className="text-xs text-primary hover:underline ml-1">
              Esborra-ho tot
            </button>
          )}
        </div>
      )}
    </>
  )
}

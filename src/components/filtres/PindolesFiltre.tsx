import type { ValorsFiltres } from './filtres'

export interface Pindola {
  label: string
  val: number | string
  color: string
  // Sense `filtre` la píndola només informa, i no té clic.
  filtre?: { clau: string; valor: string }
}

interface Props {
  pindoles: Pindola[]
  valors: ValorsFiltres
  onCanvia: (clau: string, valor: string) => void
}

export function PindolesFiltre({ pindoles, valors, onCanvia }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {pindoles.map(({ label, val, color, filtre }) => {
        if (!filtre) {
          return (
            <span key={label} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-gray-200 text-xs text-gray-600">
              <span className="font-bold" style={{ color }}>{val}</span>
              {label}
            </span>
          )
        }
        const actiu = valors[filtre.clau] === filtre.valor
        return (
          <button
            key={label}
            type="button"
            aria-pressed={actiu}
            onClick={() => onCanvia(filtre.clau, actiu ? '' : filtre.valor)}
            title={actiu ? 'Treu aquest filtre' : `Mostra només: ${label}`}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs transition-colors ${
              actiu ? 'border-transparent text-white' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
            style={actiu ? { backgroundColor: color } : undefined}
          >
            <span className="font-bold" style={actiu ? undefined : { color }}>{val}</span>
            {label}
          </button>
        )
      })}
    </div>
  )
}

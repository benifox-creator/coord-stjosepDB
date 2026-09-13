import type { DiaSetmana, Horari } from './types'
import { DIES_SETMANA_HORARI } from './types'

interface Props {
  franges: string[]
  horaris: Horari[]
  editable: boolean
  onClickCella?: (dia: DiaSetmana, franja: string, existent: Horari | null) => void
}

export function HorariGrid({ franges, horaris, editable, onClickCella }: Props) {
  function troba(dia: DiaSetmana, franja: string): Horari | null {
    return horaris.find((h) => h.DiaSetmana === dia && h.Franja === franja) ?? null
  }

  return (
    <table className="w-full text-xs border-collapse">
      <thead>
        <tr>
          <th className="border border-gray-200 bg-gray-50 px-2 py-1.5 text-left w-28">Franja</th>
          {DIES_SETMANA_HORARI.map((dia) => (
            <th key={dia} className="border border-gray-200 bg-gray-50 px-2 py-1.5 text-left">{dia}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {franges.map((franja) => (
          <tr key={franja}>
            <td className="border border-gray-200 px-2 py-1.5 font-medium text-gray-500">{franja}</td>
            {DIES_SETMANA_HORARI.map((dia) => {
              const existent = troba(dia, franja)
              const contingut = existent
                ? existent.Tipus === 'Lectiva'
                  ? `${existent.Grup} — ${existent.Materia}`
                  : existent.Materia
                : ''
              return (
                <td
                  key={dia}
                  onClick={editable && onClickCella ? () => onClickCella(dia, franja, existent) : undefined}
                  className={`border border-gray-200 px-2 py-1.5 ${
                    editable ? 'cursor-pointer hover:bg-primary/5' : ''
                  } ${existent?.Tipus === 'No lectiva' ? 'text-gray-400 italic' : 'text-text-main'}`}
                >
                  {contingut}
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

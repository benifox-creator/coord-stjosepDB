import { slotMinutes } from '../../utils/schoolCalendar'
import type { DiaSetmana, Horari } from './types'
import { DIES_SETMANA_HORARI } from './types'

interface Props {
  franges: string[]
  horaris: Horari[]
  editable: boolean
  onClickCella?: (dia: DiaSetmana, franja: string, existent: Horari | null) => void
}

export function HorariGrid({ franges, horaris, editable, onClickCella }: Props) {
  const key = (slot: string) => slotMinutes(slot).join(':')
  const visibleSlots = [...new Map([...franges, ...horaris.map(h=>h.Franja)].map(f=>[key(f),f])).values()]
    .sort((a,b)=>slotMinutes(a)[0]-slotMinutes(b)[0])
  function troba(dia: DiaSetmana, franja: string): Horari | null {
    return horaris.find((h) => h.DiaSetmana === dia && key(h.Franja) === key(franja)) ?? null
  }

  return (
    <table className="w-full min-w-[640px] text-xs border-collapse">
      <thead>
        <tr>
          <th className="border border-gray-200 bg-gray-50 px-2 py-1.5 text-left w-28">Franja</th>
          {DIES_SETMANA_HORARI.map((dia) => (
            <th key={dia} className="border border-gray-200 bg-gray-50 px-2 py-1.5 text-left">{dia}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {visibleSlots.map((franja) => (
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
                  className={`border border-gray-200 px-2 py-1.5 ${
                    editable ? 'cursor-pointer hover:bg-primary/5' : ''
                  } ${existent?.Tipus === 'No lectiva' ? 'text-gray-400 italic' : 'text-text-main'}`}
                >
                  {editable ? <button type="button" className="w-full min-h-10 text-left focus-visible:outline-2 focus-visible:outline-primary" aria-label={`${dia} ${franja}: ${contingut || 'Afegeix un període'}`} onClick={() => onClickCella?.(dia, franja, existent)}>{contingut || '+'}</button> : contingut}
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

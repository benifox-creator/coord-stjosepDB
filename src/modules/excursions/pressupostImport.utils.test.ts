import { describe, it, expect } from 'vitest'
import { interpretaPressupost, type FilaPressupost } from './pressupostImport.utils'
import type { Excursio } from './types'

function excursio(canvis: Partial<Excursio> = {}): Excursio {
  return {
    id: 'e1', Codi: 'EXC-0001', CursEscolar: '2026-2027', Estat: 'Aprovada', Etapa: 'EP',
    Lloc: 'Can Montcau', Poblacio: 'La Roca', Activitat: 'Visita', Data: '2026-11-18',
    HoraSortida: '09:00', HoraTornada: '13:00', Transport: 'autocar', TransportDetall: '',
    AcompanyantsExterns: 0, Observacions: '', Responsable: 'a@stjosep.org',
    MotiuRebuig: null, MotiuCancellacio: null, ProposadaPer: null, AprovadaPer: null,
    ReservadaPer: null, Creat_per: 'a@stjosep.org', PreuAlumne: null, PreuConfirmatPer: null,
    DataCircular: null, DataLimitPagament: null, DataLimitResguard: null,
    CircularEnviadaPer: null, AmpaCollabora: false,
    Grups: [{ id: 'g1', Grup: 'EP-5è A', AlumnesPrevistos: 25, AlumnesFinals: null, AlumnesPagats: 0 }],
    Acompanyants: [],
    ...canvis,
  }
}

const CAPÇALERES = ['Codi', 'Data', 'Dia', 'Destinació', 'Població', 'Grups', 'Passatgers',
  'Sortida', 'Tornada', 'Places', 'Preu autocar', 'Preu per alumne', 'Preu total del grup']

/** Una fila del full amb només les columnes que importen a les proves. */
function fila(codi: string, places: unknown = '', preu: unknown = '', perAlumne: unknown = '', total: unknown = '') {
  return [codi, '2026-11-18', 'Dimecres', 'Can Montcau', 'La Roca', 'EP-5è A', 26, '09:00', '13:00',
    places, preu, perAlumne, total]
}

const SENSE_AUTOCARS = new Map<string, { quants: number; total: number }>()

function interpreta(files: unknown[][], opcions: {
  excursions?: Excursio[]
  ambAutocars?: Map<string, { quants: number; total: number }>
  portaIva?: boolean
  ivaPct?: number
} = {}): FilaPressupost[] {
  return interpretaPressupost(
    [CAPÇALERES, ...files],
    opcions.excursions ?? [excursio()],
    opcions.ambAutocars ?? SENSE_AUTOCARS,
    opcions.portaIva ?? false,
    opcions.ivaPct ?? 10,
  )
}

describe('interpretar el full que torna', () => {
  it('una fila amb preu dona un autocar', () => {
    const r = interpreta([fila('EXC-0001', 55, 610)])
    expect(r).toHaveLength(1)
    expect(r[0].valid).toBe(true)
    expect(r[0].data?.autocars).toEqual([{ places: 55, preu: 610 }])
  })

  it('el mateix codi repetit dona dos autocars a la mateixa sortida', () => {
    // És el cas que motiva tot el disseny: 89 passatgers no hi caben en un.
    const r = interpreta([fila('EXC-0001', 55, 610), fila('EXC-0001', 40, 480)])
    expect(r).toHaveLength(1)
    expect(r[0].data?.autocars).toEqual([{ places: 55, preu: 610 }, { places: 40, preu: 480 }])
  })

  it('una fila sense preu se salta en silenci', () => {
    // L'empresa no ha pressupostat aquella sortida. És una resposta legítima.
    expect(interpreta([fila('EXC-0001')])).toEqual([])
  })

  it('les capçaleres es reconeixen sense accents i amb apòstrof recte', () => {
    const capçaleres = ['codi', 'data', 'dia', 'Destinacio', 'Poblacio', 'Grups', 'Passatgers',
      'Sortida', 'Tornada', 'places', 'PREU AUTOCAR', 'Preu per alumne', 'Preu total del grup']
    const r = interpretaPressupost([capçaleres, fila('EXC-0001', 55, 610)], [excursio()], SENSE_AUTOCARS, false, 10)
    expect(r[0].data?.autocars).toEqual([{ places: 55, preu: 610 }])
  })

  it('un full sense la columna del codi no es pot llegir', () => {
    expect(() => interpretaPressupost([['Data', 'Preu autocar'], ['2026-11-18', 610]], [excursio()], SENSE_AUTOCARS, false, 10))
      .toThrow('Codi')
  })

  it('un full buit no dona res i no peta', () => {
    expect(interpretaPressupost([], [excursio()], SENSE_AUTOCARS, false, 10)).toEqual([])
  })
})

describe('el que atura una fila', () => {
  it('un codi que no existeix', () => {
    const r = interpreta([fila('EXC-9999', 55, 610)])
    expect(r[0].valid).toBe(false)
    expect(r[0].error).toContain('no existeix')
  })

  it('una sortida cancel·lada', () => {
    const r = interpreta([fila('EXC-0001', 55, 610)], { excursions: [excursio({ Estat: 'Cancel·lada' })] })
    expect(r[0].valid).toBe(false)
    expect(r[0].error).toContain('cancel')
  })

  it('un preu que no és un número', () => {
    const r = interpreta([fila('EXC-0001', 55, 'a consultar')])
    expect(r[0].valid).toBe(false)
    expect(r[0].error).toContain('número')
  })

  it('un preu negatiu', () => {
    const r = interpreta([fila('EXC-0001', 55, -610)])
    expect(r[0].valid).toBe(false)
  })

  it('una fila d’autocar amb preu i sense places', () => {
    // Sense places no se sap si hi caben tots, i la fitxa n'ensenya el nombre.
    const r = interpreta([fila('EXC-0001', '', 610)])
    expect(r[0].valid).toBe(false)
    expect(r[0].error).toContain('places')
  })

  it('les dues columnes d’activitat plenes a la vegada', () => {
    // Si l'empresa ha escrit dos números, no sabem quin val. No se'n tria cap.
    const r = interpreta([fila('EXC-0001', '', '', 8, 200)])
    expect(r[0].valid).toBe(false)
    expect(r[0].error).toContain('dues')
  })

  it('dos preus d’activitat diferents per a la mateixa sortida', () => {
    const r = interpreta([fila('EXC-0001', 55, 610, 8), fila('EXC-0001', 40, 480, 9)])
    expect(r[0].valid).toBe(false)
    expect(r[0].error).toContain('activitat')
  })

  it('el mateix preu d’activitat repetit a les dues files no és error', () => {
    // L'empresa ha omplert la columna a totes dues línies amb el mateix número.
    const r = interpreta([fila('EXC-0001', 55, 610, 8), fila('EXC-0001', 40, 480, 8)])
    expect(r[0].valid).toBe(true)
    expect(r[0].data?.preuActivitat).toBe(8)
  })
})

describe('l’activitat', () => {
  it('per alumne', () => {
    const r = interpreta([fila('EXC-0001', '', '', 8)])
    expect(r[0].data?.preuActivitat).toBe(8)
    expect(r[0].data?.preuActivitatTipus).toBe('per_alumne')
  })

  it('total del grup', () => {
    const r = interpreta([fila('EXC-0001', '', '', '', 200)])
    expect(r[0].data?.preuActivitat).toBe(200)
    expect(r[0].data?.preuActivitatTipus).toBe('total')
  })

  it('sense cap de les dues, no se’n diu res', () => {
    const r = interpreta([fila('EXC-0001', 55, 610)])
    expect(r[0].data?.preuActivitat).toBeUndefined()
    expect(r[0].data?.preuActivitatTipus).toBeUndefined()
  })
})

describe('l’IVA', () => {
  it('sense marcar, es desa el que hi ha escrit', () => {
    expect(interpreta([fila('EXC-0001', 55, 610)])[0].data?.autocars[0].preu).toBe(610)
  })

  it('marcat, es desa el net', () => {
    // 610 amb un 10 % inclòs són 554,55 nets. El que es desa sempre és el net:
    // `calculaPreu` ja hi torna a aplicar l'IVA, i desar-hi el brut faria tots
    // els preus un 10 % alts sense que res ho detectés.
    expect(interpreta([fila('EXC-0001', 55, 610)], { portaIva: true })[0].data?.autocars[0].preu)
      .toBe(554.55)
  })

  it('també a l’activitat', () => {
    expect(interpreta([fila('EXC-0001', '', '', 12.1)], { portaIva: true })[0].data?.preuActivitat).toBe(11)
  })

  it('s’arrodoneix al cèntim, que és el que la columna admet', () => {
    const r = interpreta([fila('EXC-0001', 55, 100)], { portaIva: true, ivaPct: 21 })
    // 100 / 1,21 = 82,6446…
    expect(r[0].data?.autocars[0].preu).toBe(82.64)
  })
})

describe('el que avisa sense aturar', () => {
  it('una sortida que ja tenia autocars diu quants en perd', () => {
    const ambAutocars = new Map([['e1', { quants: 2, total: 1100 }]])
    const r = interpreta([fila('EXC-0001', 55, 610), fila('EXC-0001', 40, 480)], { ambAutocars })
    expect(r[0].valid).toBe(true)
    expect(r[0].substitueix).toEqual({ quants: 2, total: 1100 })
  })

  it('i si no en tenia, no diu res', () => {
    expect(interpreta([fila('EXC-0001', 55, 610)])[0].substitueix).toBeUndefined()
  })
})

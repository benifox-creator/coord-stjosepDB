import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as db from '../../services/db'
import { useBalanc } from './useBalanc'

vi.mock('../../services/db', () => ({ getAll: vi.fn() }))

const files: Record<string, unknown[]> = {}

/** Els paràmetres de sempre que passaria la pantalla, per a les proves. */
const sempre = () => ({ previsio: 0.75, ivaPct: 10 })

beforeEach(() => {
  useBalanc.setState({ sortides: [], loading: false, error: null })
  // Imprescindible: `vitest.config.ts` no té `clearMocks`, així que sense
  // això l'historial de crides s'acumula entre proves i `mock.calls[0]`
  // seria la crida d'una altra prova. Mateix patró que `useExcursions.test.ts`.
  vi.clearAllMocks()
  files.excursions = [{
    id: 'e1', lloc: 'Can Montcau', etapa: 'EP', data: '2026-11-18',
    estat: 'Reservada', preu_alumne: '30.00', curs_escolar: '2026-2027',
  }]
  files.excursio_grups = [
    { id: 'g1', excursio_id: 'e1', alumnes_previstos: 26, alumnes_pagats: 20 },
  ]
  files.excursio_finances = [{
    excursio_id: 'e1', preu_activitat: '8.00', preu_activitat_tipus: 'per_alumne',
    ampa_import: '4.00', ampa_cobreix_activitat: false, cost_acompanyants: '45.00',
    previsio_usada: '0.750', iva_pct_usat: '10.00',
  }]
  files.excursio_autocars = [{ id: 'a1', excursio_id: 'e1', preu: '500.00' }]
  vi.mocked(db.getAll).mockImplementation((taula: string) =>
    Promise.resolve((files[taula] ?? []) as never[]))
})

describe('carregar les dades econòmiques d’un curs', () => {
  it('converteix els números que arriben com a text', async () => {
    await useBalanc.getState().carrega('2026-2027', sempre)
    const s = useBalanc.getState().sortides[0]
    expect(s.preuAlumne).toBe(30)
    expect(s.autocars).toEqual([500])
    expect(s.costAcompanyants).toBe(45)
    expect(s.ivaPct).toBe(10)
    expect(s.previsio).toBe(0.75)
  })

  it('suma els grups de cada sortida', async () => {
    files.excursio_grups = [
      { id: 'g1', excursio_id: 'e1', alumnes_previstos: 26, alumnes_pagats: 20 },
      { id: 'g2', excursio_id: 'e1', alumnes_previstos: 24, alumnes_pagats: 18 },
      { id: 'g3', excursio_id: 'altra', alumnes_previstos: 99, alumnes_pagats: 99 },
    ]
    await useBalanc.getState().carrega('2026-2027', sempre)
    const s = useBalanc.getState().sortides[0]
    expect(s.previstos).toBe(50)
    expect(s.assistents).toBe(38)
  })

  it('un `alumnes_pagats` nul compta com a zero', async () => {
    files.excursio_grups = [
      { id: 'g1', excursio_id: 'e1', alumnes_previstos: 26, alumnes_pagats: null },
    ]
    await useBalanc.getState().carrega('2026-2027', sempre)
    expect(useBalanc.getState().sortides[0].assistents).toBe(0)
  })

  it('una sortida sense fila de finances no és un error: té els costos a zero', async () => {
    // Passa quan encara no s'hi ha entrat res, i també quan qui mira no té
    // accés als diners i l'RLS no li'n torna cap fila.
    files.excursio_finances = []
    files.excursio_autocars = []
    await useBalanc.getState().carrega('2026-2027', sempre)
    const s = useBalanc.getState().sortides[0]
    expect(s.preuActivitat).toBe(0)
    expect(s.costAcompanyants).toBe(0)
    expect(s.autocars).toEqual([])
    expect(useBalanc.getState().error).toBeNull()
  })

  it('sense paràmetres congelats agafa els que diu la configuració, no uns d’escrits a mà', async () => {
    // `previsio_usada` i `iva_pct_usat` només s'omplen en confirmar el preu.
    // Els valors de la funció són clarament distints del 0,75 i el 10 que hi
    // havia escrits al store, perquè la prova no pugui passar per casualitat.
    files.excursio_finances = [{
      excursio_id: 'e1', preu_activitat: '0', preu_activitat_tipus: 'per_alumne',
      ampa_import: '0', ampa_cobreix_activitat: false, cost_acompanyants: '0',
      previsio_usada: null, iva_pct_usat: null,
    }]
    await useBalanc.getState().carrega('2026-2027', () => ({ previsio: 0.8, ivaPct: 21 }))
    const s = useBalanc.getState().sortides[0]
    expect(s.previsio).toBe(0.8)
    expect(s.ivaPct).toBe(21)
  })

  it('un valor congelat mana sobre la configuració d’avui', async () => {
    // El preu es va confirmar amb aquella previsió i aquell IVA: canviar la
    // configuració al març no pot recalcular una sortida tancada a l'octubre.
    await useBalanc.getState().carrega('2026-2027', () => ({ previsio: 0.8, ivaPct: 21 }))
    const s = useBalanc.getState().sortides[0]
    expect(s.previsio).toBe(0.75)
    expect(s.ivaPct).toBe(10)
  })

  it('demana els de sempre de l’etapa de cada sortida', async () => {
    // La previsió no és la mateixa a EI que a BATX: passar-hi una etapa fixa
    // tornaria a donar una xifra en euros d'una etapa que no és.
    files.excursions = [{ ...(files.excursions[0] as object), etapa: 'BATX' }]
    const perDefecte = vi.fn(() => ({ previsio: 0.8, ivaPct: 21 }))
    await useBalanc.getState().carrega('2026-2027', perDefecte)
    expect(perDefecte).toHaveBeenCalledWith('BATX')
  })

  it('un preu no confirmat arriba com a null i no com a zero', async () => {
    files.excursions = [{ ...(files.excursions[0] as object), preu_alumne: null }]
    await useBalanc.getState().carrega('2026-2027', sempre)
    expect(useBalanc.getState().sortides[0].preuAlumne).toBeNull()
  })

  it('demana només el curs que li han dit', async () => {
    await useBalanc.getState().carrega('2025-2026', sempre)
    expect(vi.mocked(db.getAll).mock.calls[0][2]).toEqual({ curs_escolar: '2025-2026' })
  })

  it('un error de lectura es queda al store i no peta', async () => {
    vi.mocked(db.getAll).mockRejectedValue(new Error('Error llegint excursions: nope'))
    await useBalanc.getState().carrega('2026-2027', sempre)
    expect(useBalanc.getState().error).toContain('nope')
    expect(useBalanc.getState().loading).toBe(false)
  })

  it('ignora la resposta d’una càrrega que ja ha quedat enrere', async () => {
    // Mateix patró que `useExcursions.test.ts`: si la resposta lenta del curs
    // anterior arribés després, pisaria la del curs que s'està mirant.
    let resolLenta: (v: unknown) => void = () => {}
    const lenta = new Promise((r) => { resolLenta = r })
    vi.mocked(db.getAll).mockImplementationOnce(() => lenta as never)
      .mockImplementation((taula: string) => Promise.resolve((files[taula] ?? []) as never[]))
    const primera = useBalanc.getState().carrega('2025-2026', sempre)
    await useBalanc.getState().carrega('2026-2027', sempre)
    resolLenta([{
      id: 'vella', lloc: 'Sortida del curs passat', etapa: 'EP', data: '2025-11-18',
      estat: 'Reservada', preu_alumne: '30.00', curs_escolar: '2025-2026',
    }])
    await primera
    expect(useBalanc.getState().sortides.map((s) => s.lloc)).toEqual(['Can Montcau'])
  })
})

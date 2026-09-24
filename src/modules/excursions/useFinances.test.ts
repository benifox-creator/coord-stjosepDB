import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useFinances } from './useFinances'
import * as db from '../../services/db'
import { FINANCES_BUIDES, type Finances } from './finances.types'

vi.mock('../../services/db', () => ({
  getAll: vi.fn(),
  insertRow: vi.fn(),
  updateRowById: vi.fn(),
  deleteRowById: vi.fn(),
  callRpc: vi.fn(),
  supabase: { from: vi.fn() },
}))

/** Respon a getAll segons la taula demanada. */
function taules({ finances = [] as unknown[], autocars = [] as unknown[] } = {}) {
  vi.mocked(db.getAll).mockImplementation((taula: string) => {
    if (taula === 'excursio_finances') return Promise.resolve(finances as never[])
    return Promise.resolve(autocars as never[])
  })
}

/** `desa` sempre passa per `supabase.from(...).upsert(...)` abans de tocar els autocars. */
function mockUpsert(error: { message: string } | null = null) {
  const upsert = vi.fn().mockResolvedValue({ error })
  vi.mocked(db.supabase.from).mockReturnValue({ upsert } as never)
  return upsert
}

beforeEach(() => {
  useFinances.setState({ finances: null, loading: false, error: null })
  vi.clearAllMocks()
})

describe('carregar els costos', () => {
  it('amb zero files deixa els valors per defecte i cap error (RLS o encara res desat)', async () => {
    taules()
    await useFinances.getState().carrega('e1')
    expect(useFinances.getState().finances).toEqual(FINANCES_BUIDES)
    expect(useFinances.getState().error).toBeNull()
  })

  it('en petar la lectura, deixa l’error a la vista i no encalla el loading', async () => {
    vi.mocked(db.getAll).mockRejectedValue(new Error('sense connexió'))
    await useFinances.getState().carrega('e1')
    expect(useFinances.getState().error).toBe('sense connexió')
    expect(useFinances.getState().loading).toBe(false)
  })

  it('en petar just després d’haver-ne carregat una altra, no deixa les seves dades a la vista', async () => {
    // Reprodueix el cas real: s'obre l'excursió A (es carrega bé), es tanca,
    // s'obre la B i la seva càrrega falla. Sense esborrar `finances` al catch,
    // `ExcursioDetall` seguiria ensenyant —i "Desa els costos" escriuria— els
    // autocars i l'AMPA de l'excursió A sota el nom de la B, sense cap avís
    // en pantalla perquè res subscrivia `error`.
    taules({ finances: [{
      excursio_id: 'excursio-A', preu_activitat: '10', preu_activitat_tipus: 'per_alumne',
      ampa_import: '0', ampa_cobreix_activitat: false, cost_acompanyants: '0',
    }] })
    await useFinances.getState().carrega('excursio-A')
    expect(useFinances.getState().finances?.PreuActivitat).toBe(10)

    vi.mocked(db.getAll).mockRejectedValue(new Error('sense connexió'))
    await useFinances.getState().carrega('excursio-B')
    expect(useFinances.getState().finances).toBeNull()
    expect(useFinances.getState().error).toBe('sense connexió')
  })

  it('ignora la resposta d’una càrrega que ja ha quedat enrere', async () => {
    let resolLenta: (v: unknown) => void = () => {}
    const lenta = new Promise((r) => { resolLenta = r })
    vi.mocked(db.getAll).mockImplementationOnce(() => lenta as never)
      .mockImplementation(() => Promise.resolve([] as never[]))
    const primera = useFinances.getState().carrega('excursio-A')
    taules({ finances: [{
      excursio_id: 'excursio-B', preu_activitat: '10', preu_activitat_tipus: 'per_alumne',
      ampa_import: '0', ampa_cobreix_activitat: false, cost_acompanyants: '0',
    }] })
    await useFinances.getState().carrega('excursio-B')
    resolLenta([{
      excursio_id: 'excursio-A', preu_activitat: '999', preu_activitat_tipus: 'total',
      ampa_import: '0', ampa_cobreix_activitat: false, cost_acompanyants: '0',
    }])
    await primera
    expect(useFinances.getState().finances?.PreuActivitat).toBe(10)
  })
})

describe('desar els costos', () => {
  it('en treure un autocar, només esborra aquell i deixa els altres', async () => {
    taules({ autocars: [
      { id: 'b1', excursio_id: 'e1', places: 55, preu: '300' },
      { id: 'b2', excursio_id: 'e1', places: 55, preu: '300' },
    ] })
    mockUpsert()
    const f: Finances = { ...FINANCES_BUIDES, Autocars: [{ id: 'b1', Places: 55, Preu: 300 }] }
    await useFinances.getState().desa('e1', f)
    expect(vi.mocked(db.deleteRowById)).toHaveBeenCalledWith('excursio_autocars', 'b2')
    expect(vi.mocked(db.deleteRowById)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(db.updateRowById)).not.toHaveBeenCalled()
  })

  it('en afegir un autocar nou, l’insereix sense l’id temporal del client', async () => {
    taules({ autocars: [] })
    mockUpsert()
    const f: Finances = { ...FINANCES_BUIDES, Autocars: [{ id: 'temp-123', Places: 40, Preu: 250 }] }
    await useFinances.getState().desa('e1', f)
    expect(vi.mocked(db.insertRow)).toHaveBeenCalledWith('excursio_autocars', { excursio_id: 'e1', places: 40, preu: 250 })
  })
})

describe('importar pressupostos', () => {
  let upsert: ReturnType<typeof mockUpsert>
  beforeEach(() => {
    // Un autocar ja existent per defecte: així el test que vigila l'ordre
    // (nous abans d'esborrar els vells) té alguna cosa per esborrar sense
    // que cada test l'hagi de muntar expressament.
    taules({ autocars: [{ id: 'vell-1', excursio_id: 'e1', places: 20, preu: '200' }] })
    upsert = mockUpsert()
  })

  /** Els objectes enviats a `supabase.from('excursio_finances').upsert(...)`. */
  function upsertsFets(): unknown[] {
    return upsert.mock.calls.map((c) => c[0])
  }

  /** Fa que `getAll` respongui amb aquesta fila per a `excursio_finances`. */
  function financesExistents(overrides: Record<string, unknown>) {
    taules({ finances: [{
      excursio_id: 'e1', preu_activitat: '0', preu_activitat_tipus: 'per_alumne',
      ampa_import: '0', ampa_cobreix_activitat: false, cost_acompanyants: '0',
      ...overrides,
    }] })
  }

  /** Fa que `getAll` respongui amb aquestes files per a `excursio_autocars`. */
  function autocarsExistents(rows: unknown[]) {
    taules({ autocars: rows })
  }

  it('insereix un autocar per fila i esborra els que hi havia', async () => {
    await useFinances.getState().importaPressupostos([
      { excursioId: 'e1', codi: 'c1', dades: { autocars: [{ places: 55, preu: 610 }, { places: 40, preu: 480 }] } },
    ])
    const inserits = vi.mocked(db.insertRow).mock.calls.filter((c) => c[0] === 'excursio_autocars')
    expect(inserits.map((c) => c[1])).toEqual([
      { excursio_id: 'e1', places: 55, preu: 610 },
      { excursio_id: 'e1', places: 40, preu: 480 },
    ])
  })

  it('els nous entren abans que s’esborrin els vells', async () => {
    // Si peta enmig, val més una sortida amb autocars duplicats —que es veuen
    // a la fitxa i s'esborren— que una que s'ha quedat sense cap preu.
    const ordre: string[] = []
    vi.mocked(db.insertRow).mockImplementation(async (taula: string) => { ordre.push(`insert ${taula}`); return {} as never })
    vi.mocked(db.deleteRowById).mockImplementation(async (taula: string) => { ordre.push(`delete ${taula}`) })
    await useFinances.getState().importaPressupostos([
      { excursioId: 'e1', codi: 'c1', dades: { autocars: [{ places: 55, preu: 610 }] } },
    ])
    expect(ordre.indexOf('insert excursio_autocars')).toBeLessThan(ordre.indexOf('delete excursio_autocars'))
  })

  it('el preu de l’activitat entra amb el seu tipus', async () => {
    await useFinances.getState().importaPressupostos([
      { excursioId: 'e1', codi: 'c1', dades: { autocars: [], preuActivitat: 8, preuActivitatTipus: 'per_alumne' } },
    ])
    expect(upsertsFets()[0]).toMatchObject({
      excursio_id: 'e1', preu_activitat: 8, preu_activitat_tipus: 'per_alumne',
    })
  })

  it('sense preu d’activitat, el que ja hi havia no es toca', async () => {
    financesExistents({ preu_activitat: '99', preu_activitat_tipus: 'total' })
    await useFinances.getState().importaPressupostos([
      { excursioId: 'e1', codi: 'c1', dades: { autocars: [{ places: 55, preu: 610 }] } },
    ])
    expect(upsertsFets()[0]).toMatchObject({ preu_activitat: 99, preu_activitat_tipus: 'total' })
  })

  it('no esborra l’AMPA ni el cost dels acompanyants', async () => {
    // L'`upsert` reemplaça la fila sencera: sense tornar-hi el que ja hi havia,
    // una importació de preus d'autocar buidaria l'aportació de l'AMPA.
    financesExistents({ ampa_import: '4', ampa_cobreix_activitat: true, cost_acompanyants: '45' })
    await useFinances.getState().importaPressupostos([
      { excursioId: 'e1', codi: 'c1', dades: { autocars: [{ places: 55, preu: 610 }] } },
    ])
    expect(upsertsFets()[0]).toMatchObject({
      ampa_import: 4, ampa_cobreix_activitat: true, cost_acompanyants: 45,
    })
  })

  it('no toca l’estat del store', async () => {
    // Escriu diverses sortides seguides, i la fitxa que hi hagi oberta és
    // d'una altra: canviar-li els costos de sota ensenyaria els d'una tercera.
    useFinances.setState({ finances: null, loading: false, error: null })
    await useFinances.getState().importaPressupostos([
      { excursioId: 'e1', codi: 'c1', dades: { autocars: [{ places: 55, preu: 610 }] } },
    ])
    expect(useFinances.getState()).toMatchObject({ finances: null, loading: false, error: null })
  })

  it('importar dues vegades el mateix fitxer deixa el mateix resultat', async () => {
    // La raó de substituir en comptes de sumar: sumar-los doblaria el cost en
    // silenci, que és la classe d'error que ningú no troba fins que el preu ja
    // és a casa de les famílies.
    autocarsExistents([{ id: 'a1', places: 55, preu: '610' }])
    await useFinances.getState().importaPressupostos([
      { excursioId: 'e1', codi: 'c1', dades: { autocars: [{ places: 55, preu: 610 }] } },
    ])
    const inserits = vi.mocked(db.insertRow).mock.calls.filter((c) => c[0] === 'excursio_autocars')
    const esborrats = vi.mocked(db.deleteRowById).mock.calls.filter((c) => c[0] === 'excursio_autocars')
    expect(inserits).toHaveLength(1)
    expect(esborrats.map((c) => c[1])).toEqual(['a1'])
  })

  it('escriu totes les sortides de la llista', async () => {
    await useFinances.getState().importaPressupostos([
      { excursioId: 'e1', codi: 'c1', dades: { autocars: [{ places: 55, preu: 610 }] } },
      { excursioId: 'e2', codi: 'c2', dades: { autocars: [{ places: 30, preu: 300 }] } },
    ])
    const inserits = vi.mocked(db.insertRow).mock.calls.filter((c) => c[0] === 'excursio_autocars')
    expect(inserits).toHaveLength(2)
  })

  it('sense cap error, el resum diu quantes s’han escrit i cap error', async () => {
    const resultat = await useFinances.getState().importaPressupostos([
      { excursioId: 'e1', codi: 'c1', dades: { autocars: [{ places: 55, preu: 610 }] } },
      { excursioId: 'e2', codi: 'c2', dades: { autocars: [{ places: 30, preu: 300 }] } },
    ])
    expect(resultat).toEqual({ escrites: 2, errors: [] })
  })

  it('si una sortida peta, es continua amb les següents i el resum ho reflecteix', async () => {
    // La segona de tres peta (error de Supabase a l'`upsert`): les tres s'han
    // d'intentar igualment, i el resum ha de dir que dues s'han escrit, amb
    // un error que nomena el codi de la que ha fallat.
    const upsert = vi.fn()
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: { message: 'sense connexió' } })
      .mockResolvedValueOnce({ error: null })
    vi.mocked(db.supabase.from).mockReturnValue({ upsert } as never)

    const resultat = await useFinances.getState().importaPressupostos([
      { excursioId: 'e1', codi: 'c1', dades: { autocars: [] } },
      { excursioId: 'e2', codi: 'c2', dades: { autocars: [] } },
      { excursioId: 'e3', codi: 'c3', dades: { autocars: [] } },
    ])

    expect(upsert).toHaveBeenCalledTimes(3)
    expect(resultat.escrites).toBe(2)
    expect(resultat.errors).toEqual([{ codi: 'c2', error: 'Error desant els costos: sense connexió' }])
  })

  it('un error guarda el missatge de l’excepció, no un text genèric', async () => {
    vi.mocked(db.getAll).mockRejectedValueOnce(new Error('boom personalitzat'))
    const resultat = await useFinances.getState().importaPressupostos([
      { excursioId: 'e1', codi: 'c1', dades: { autocars: [] } },
    ])
    expect(resultat.errors).toEqual([{ codi: 'c1', error: 'boom personalitzat' }])
  })
})

describe('confirmar el preu', () => {
  it('desa els costos abans de cridar la RPC, amb els mateixos paràmetres amb què s’ha calculat', async () => {
    taules({ autocars: [] })
    const upsert = mockUpsert()
    vi.mocked(db.callRpc).mockResolvedValue(undefined as never)
    const f: Finances = { ...FINANCES_BUIDES, PreuActivitat: 20 }
    await useFinances.getState().confirma('e1', 12.5, f, { previsio: 0.8, margePct: 15, ivaPct: 21, arrodoniment: 0.5 })
    // `desa` (i per tant l'upsert) s'ha de cridar: si el preu es confirma
    // sense desar primer, la fila de costos pot descriure una altra cosa que
    // el preu que s'acaba de congelar.
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ excursio_id: 'e1', preu_activitat: 20 }))
    expect(vi.mocked(db.callRpc)).toHaveBeenCalledWith('confirmar_preu', {
      p_id: 'e1', p_preu: 12.5, p_previsio: 0.8, p_marge_pct: 15, p_iva_pct: 21,
    })
  })

  it('si desar els costos falla, no arriba a confirmar el preu', async () => {
    taules({ autocars: [] })
    mockUpsert({ message: 'sense connexió' })
    vi.mocked(db.callRpc).mockResolvedValue(undefined as never)
    await expect(
      useFinances.getState().confirma('e1', 12.5, FINANCES_BUIDES, { previsio: 0.8, margePct: 15, ivaPct: 21, arrodoniment: 0.5 }),
    ).rejects.toThrow('sense connexió')
    expect(vi.mocked(db.callRpc)).not.toHaveBeenCalled()
  })
})

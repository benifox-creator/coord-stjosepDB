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

describe('confirmar el preu', () => {
  it('crida la RPC confirmar_preu amb p_id i p_preu', async () => {
    vi.mocked(db.callRpc).mockResolvedValue(undefined as never)
    await useFinances.getState().confirma('e1', 12.5)
    expect(vi.mocked(db.callRpc)).toHaveBeenCalledWith('confirmar_preu', { p_id: 'e1', p_preu: 12.5 })
  })
})

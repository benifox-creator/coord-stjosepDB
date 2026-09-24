import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as db from '../../services/db'
import { useAutocarsResum } from './useAutocarsResum'

vi.mock('../../services/db', () => ({ getAll: vi.fn() }))

const files: Record<string, unknown[]> = {}

beforeEach(() => {
  useAutocarsResum.setState({ resum: { ambPreu: new Set(), preus: new Map() }, loading: false, error: null })
  // Imprescindible: `vitest.config.ts` no té `clearMocks`, així que sense
  // això l'historial de crides s'acumula entre proves. Mateix patró que
  // `useBalanc.test.ts`.
  vi.clearAllMocks()
  files.excursio_autocars = [{ id: 'a1', excursio_id: 'e1', preu: '500.00' }]
  vi.mocked(db.getAll).mockImplementation((taula: string) =>
    Promise.resolve((files[taula] ?? []) as never[]))
})

describe('carregar el resum d’autocars', () => {
  it('el conjunt i el mapa surten de les files llegides, amb recomptes i totals correctes quan una sortida té més d’un autocar', async () => {
    files.excursio_autocars = [
      { id: 'a1', excursio_id: 'e1', preu: 500 },
      { id: 'a2', excursio_id: 'e1', preu: 300 },
      { id: 'a3', excursio_id: 'e2', preu: 100 },
    ]
    await useAutocarsResum.getState().carrega()
    const { resum } = useAutocarsResum.getState()
    expect(resum.ambPreu).toEqual(new Set(['e1', 'e2']))
    expect(resum.preus.get('e1')).toEqual({ quants: 2, total: 800 })
    expect(resum.preus.get('e2')).toEqual({ quants: 1, total: 100 })
  })

  it('només hi entren els autocars amb preu > 0: un a zero no fa que la sortida compti com a ja pressupostada', async () => {
    files.excursio_autocars = [{ id: 'a1', excursio_id: 'e1', preu: 0 }]
    await useAutocarsResum.getState().carrega()
    const { resum } = useAutocarsResum.getState()
    expect(resum.ambPreu.has('e1')).toBe(false)
    expect(resum.preus.has('e1')).toBe(false)
  })

  it('converteix els numeric que arriben com a cadena', async () => {
    files.excursio_autocars = [{ id: 'a1', excursio_id: 'e1', preu: '500.00' }]
    await useAutocarsResum.getState().carrega()
    const { resum } = useAutocarsResum.getState()
    expect(resum.ambPreu.has('e1')).toBe(true)
    expect(resum.preus.get('e1')).toEqual({ quants: 1, total: 500 })
  })

  it('un error de lectura es queda al store i no peta', async () => {
    vi.mocked(db.getAll).mockRejectedValue(new Error('Error llegint autocars: nope'))
    await useAutocarsResum.getState().carrega()
    expect(useAutocarsResum.getState().error).toContain('nope')
    expect(useAutocarsResum.getState().loading).toBe(false)
  })

  it('ignora la resposta d’una càrrega que ja ha quedat enrere', async () => {
    // Mateix patró que `useBalanc.test.ts`: si la resposta lenta d'una
    // càrrega anterior arribés després, pisaria la de la que s'està mirant.
    let resolLenta: (v: unknown) => void = () => {}
    const lenta = new Promise((r) => { resolLenta = r })
    vi.mocked(db.getAll).mockImplementationOnce(() => lenta as never)
      .mockImplementation((taula: string) => Promise.resolve((files[taula] ?? []) as never[]))
    const primera = useAutocarsResum.getState().carrega()
    await useAutocarsResum.getState().carrega()
    resolLenta([{ id: 'vell', excursio_id: 'vella', preu: 999 }])
    await primera
    const { resum } = useAutocarsResum.getState()
    expect(resum.ambPreu.has('vella')).toBe(false)
    expect(resum.ambPreu.has('e1')).toBe(true)
    expect(resum.preus.get('e1')).toEqual({ quants: 1, total: 500 })
  })
})

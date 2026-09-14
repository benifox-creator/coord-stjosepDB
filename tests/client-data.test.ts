import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  range: vi.fn(), upsert: vi.fn(), order: vi.fn(),
  auth: { currentUser: { uid: 'teacher' } as { uid: string } | null },
}))
vi.mock('../src/services/firebase', () => ({ auth: mocks.auth }))
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ from: () => {
  const query = { select: () => query, match: () => query, order: (key: string) => { mocks.order(key); return query }, range: mocks.range, upsert: mocks.upsert }
  return query
} }) }))
import { getAll } from '../src/services/db'
import { canAccessModul, useConfigStore } from '../src/store/configStore'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.auth.currentUser = { uid: 'teacher' }
  useConfigStore.setState({ config: {}, loaded: false, loading: false, error: null })
})

describe('complete authenticated reads', () => {
  it('reads beyond the 1000-row server limit', async () => {
    const rows = Array.from({ length: 1203 }, (_, id) => ({ id }))
    mocks.range.mockImplementation(async (from: number, to: number) => ({ data: rows.slice(from, to + 1), count: rows.length, error: null }))
    expect(await getAll('material')).toEqual(rows)
    expect(mocks.range).toHaveBeenCalledTimes(3)
  })
  it('rejects an incomplete response instead of presenting partial data', async () => {
    mocks.range.mockResolvedValue({ data: [], count: 1, error: null })
    await expect(getAll('material')).rejects.toThrow('Lectura incompleta')
  })
  it('discards a response from a previous session', async () => {
    mocks.range.mockImplementation(async () => {
      mocks.auth.currentUser = { uid: 'other' }
      return { data: [{ id: 1 }], count: 1, error: null }
    })
    await expect(getAll('material')).rejects.toThrow('sessió ha canviat')
  })
})

describe('configuration boundaries', () => {
  it('preserves an empty visibility list and uses the config primary key', async () => {
    mocks.range.mockResolvedValue({ data: [{ clau: 'visibilitat.material', valors: [] }], count: 1, error: null })
    await useConfigStore.getState().load()
    expect(useConfigStore.getState().getValues('visibilitat.material')).toEqual([])
    expect(canAccessModul(useConfigStore.getState().config, 'material', 'professorat')).toBe(false)
    expect(mocks.order).not.toHaveBeenCalledWith('id')
  })
  it('keeps access blocked when configuration cannot load', async () => {
    mocks.range.mockResolvedValue({ data: null, count: null, error: { message: 'offline' } })
    await useConfigStore.getState().load()
    expect(useConfigStore.getState().loaded).toBe(false)
    expect(useConfigStore.getState().error).toContain('offline')
  })
  it('does not apply an unsuccessful permissions update locally', async () => {
    useConfigStore.setState({ config: { 'visibilitat.material': [] } })
    mocks.upsert.mockResolvedValue({ error: { message: 'denied' } })
    await expect(useConfigStore.getState().update('visibilitat.material', ['professorat'])).rejects.toThrow('denied')
    expect(useConfigStore.getState().getValues('visibilitat.material')).toEqual([])
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useHoraris } from './useHoraris'
import * as db from '../../services/db'
import { useAuthStore } from '../../store/authStore'

vi.mock('../../services/db', () => ({
  getAll: vi.fn(),
  insertRow: vi.fn(),
  updateRowById: vi.fn(),
  deleteRowById: vi.fn(),
}))

beforeEach(() => {
  useHoraris.setState({ horaris: [], loading: false, error: null })
  useAuthStore.setState({ user: { email: 'profe@stjosep.org' } as never })
  vi.clearAllMocks()
})

describe('useHoraris.crear', () => {
  it('insereix una fila amb el professor de la sessió i l\'afegeix a l\'estat', async () => {
    vi.mocked(db.insertRow).mockResolvedValue({
      id: 'h1', professor: 'profe@stjosep.org', dia_setmana: 'Dilluns', etapa: 'EP',
      franja: '9:00-10:00', tipus: 'Lectiva', grup: 'EP-1r A', materia: 'Matemàtiques',
      creat_el: '', creat_per: 'profe@stjosep.org',
    })

    await useHoraris.getState().crear({
      DiaSetmana: 'Dilluns', Etapa: 'EP', Franja: '9:00-10:00',
      Tipus: 'Lectiva', Grup: 'EP-1r A', Materia: 'Matemàtiques',
      CursEscolar: '2026-2027', VigentDesde: '2026-09-01', VigentFins: '2027-08-31', NecessitaCobertura: true,
    })

    expect(db.insertRow).toHaveBeenCalledWith('horaris', expect.objectContaining({
      professor: 'profe@stjosep.org', dia_setmana: 'Dilluns', franja: '9:00-10:00',
    }))
    expect(useHoraris.getState().horaris).toHaveLength(1)
    expect(useHoraris.getState().horaris[0].Grup).toBe('EP-1r A')
  })
})

describe('useHoraris.eliminar', () => {
  it('elimina la fila i la treu de l\'estat', async () => {
    useHoraris.setState({
      horaris: [{
        id: 'h1', Professor: 'profe@stjosep.org', DiaSetmana: 'Dilluns', Etapa: 'EP',
        Franja: '9:00-10:00', Tipus: 'Lectiva', Grup: 'EP-1r A', Materia: 'Matemàtiques',
      CursEscolar: '2026-2027', VigentDesde: '2026-09-01', VigentFins: '2027-08-31', NecessitaCobertura: true,
        Creat_el: '', Creat_per: 'profe@stjosep.org',
      }],
    })
    vi.mocked(db.deleteRowById).mockResolvedValue(undefined)

    await useHoraris.getState().eliminar(useHoraris.getState().horaris[0])

    expect(db.deleteRowById).toHaveBeenCalledWith('horaris', 'h1')
    expect(useHoraris.getState().horaris).toHaveLength(0)
  })
})

describe('useHoraris.load', () => {
  it('ignores an older response after switching academic years', async () => {
    let finishOld!: (rows: unknown[]) => void
    vi.mocked(db.getAll).mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve }))
      .mockResolvedValueOnce([{ id: 'new-course', curs_escolar: '2027-2028' }])
    const old = useHoraris.getState().load('2026-2027')
    await useHoraris.getState().load('2027-2028')
    finishOld([{ id: 'old-course', curs_escolar: '2026-2027' }])
    await old
    expect(useHoraris.getState().horaris.map(h => h.id)).toEqual(['new-course'])
  })
})

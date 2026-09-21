import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useExcursions } from './useExcursions'
import * as db from '../../services/db'
import type { ExcursioFormData } from './types'

vi.mock('../../services/db', () => ({
  getAll: vi.fn(),
  insertRow: vi.fn(),
  updateRowById: vi.fn(),
  deleteRowById: vi.fn(),
}))

const fila = {
  id: 'e1', codi: 'EXC-001', curs_escolar: '2026-2027', estat: 'Esborrany', etapa: 'EP',
  lloc: 'Can Montcau', poblacio: 'La Roca', activitat: 'Castanyada', data: '2026-10-19',
  hora_sortida: '9:00', hora_tornada: '17:00', transport: 'autocar', transport_detall: '',
  acompanyants_externs: 0, observacions: '', responsable: 'a@stjosep.org',
  motiu_rebuig: null, motiu_cancellacio: null, proposada_per: null,
  aprovada_per: null, reservada_per: null, creat_per: 'a@stjosep.org',
  preu_alumne: null, preu_confirmat_per: null,
  data_circular: null, data_limit_pagament: null, data_limit_resguard: null,
  circular_enviada_per: null, ampa_collabora: false,
}

const dades: ExcursioFormData = {
  Etapa: 'EP', Lloc: 'Can Montcau', Poblacio: 'La Roca', Activitat: 'Castanyada',
  Data: '2026-10-19', HoraSortida: '9:00', HoraTornada: '17:00',
  Transport: 'autocar', TransportDetall: '', AcompanyantsExterns: 0,
  Observacions: '', Responsable: 'a@stjosep.org',
  Grups: [{ Grup: 'EP-1r A', AlumnesPrevistos: 25 }], Acompanyants: [],
}

/** Respon a getAll segons la taula demanada. */
function taules({ excursions = [fila] as unknown[], grups = [] as unknown[], acompanyants = [] as unknown[] } = {}) {
  vi.mocked(db.getAll).mockImplementation((taula: string) => {
    if (taula === 'excursions') return Promise.resolve(excursions as never[])
    if (taula === 'excursio_grups') return Promise.resolve(grups as never[])
    return Promise.resolve(acompanyants as never[])
  })
}

beforeEach(() => {
  useExcursions.setState({ excursions: [], loading: false, error: null })
  vi.clearAllMocks()
})

describe('carregar el pla del curs', () => {
  it('reparteix els grups i els acompanyants a la seva excursió', async () => {
    taules({
      grups: [
        { id: 'g1', excursio_id: 'e1', grup: 'EP-1r A', alumnes_previstos: 25, alumnes_finals: null },
        { id: 'g2', excursio_id: 'ALTRA', grup: 'EP-2n A', alumnes_previstos: 20, alumnes_finals: null },
      ],
      acompanyants: [
        { id: 'a1', excursio_id: 'e1', email: 'b@stjosep.org' },
        { id: 'a2', excursio_id: 'ALTRA', email: 'c@stjosep.org' },
      ],
    })
    await useExcursions.getState().load('2026-2027')
    const [e] = useExcursions.getState().excursions
    expect(e.Codi).toBe('EXC-001')
    expect(e.Grups.map((g) => g.Grup)).toEqual(['EP-1r A'])
    expect(e.Acompanyants).toEqual(['b@stjosep.org'])
  })

  it('demana només les excursions del curs que toca', async () => {
    taules()
    await useExcursions.getState().load('2026-2027')
    expect(vi.mocked(db.getAll)).toHaveBeenCalledWith('excursions', 'data', { curs_escolar: '2026-2027' })
  })

  it('deixa l’error a la vista i no llança, perquè la pantalla el pugui ensenyar', async () => {
    vi.mocked(db.getAll).mockRejectedValue(new Error('sense connexió'))
    await expect(useExcursions.getState().load('2026-2027')).resolves.toBeUndefined()
    expect(useExcursions.getState().error).toBe('sense connexió')
    expect(useExcursions.getState().loading).toBe(false)
  })

  it('ignora la resposta d’una càrrega que ja ha quedat enrere', async () => {
    let resolLenta: (v: unknown) => void = () => {}
    const lenta = new Promise((r) => { resolLenta = r })
    vi.mocked(db.getAll).mockImplementationOnce(() => lenta as never)
      .mockImplementation(() => Promise.resolve([] as never[]))
    const primera = useExcursions.getState().load('2025-2026')
    taules({ excursions: [{ ...fila, codi: 'EXC-999' }] })
    await useExcursions.getState().load('2026-2027')
    resolLenta([{ ...fila, codi: 'EXC-ANTIGA' }])
    await primera
    expect(useExcursions.getState().excursions.map((e) => e.Codi)).toEqual(['EXC-999'])
  })
})

describe('crear i editar', () => {
  it('crea l’excursió i després els seus grups', async () => {
    vi.mocked(db.insertRow).mockResolvedValue(fila as never)
    taules()
    await useExcursions.getState().crear(dades)
    expect(vi.mocked(db.insertRow).mock.calls[0][0]).toBe('excursions')
    expect(vi.mocked(db.insertRow).mock.calls[1]).toEqual(['excursio_grups', { excursio_id: 'e1', grup: 'EP-1r A', alumnes_previstos: 25 }])
  })

  it('en editar només toca el que ha canviat, i no esborra el que es manté', async () => {
    taules({ grups: [
      { id: 'g1', excursio_id: 'e1', grup: 'EP-1r A', alumnes_previstos: 25, alumnes_finals: null },
      { id: 'g2', excursio_id: 'e1', grup: 'EP-2n A', alumnes_previstos: 20, alumnes_finals: null },
    ] })
    vi.mocked(db.updateRowById).mockResolvedValue(fila as never)
    await useExcursions.getState().editar('e1', {
      ...dades,
      Grups: [
        { Grup: 'EP-1r A', AlumnesPrevistos: 25 },   // igual: no s'ha de tocar
        { Grup: 'EP-3r A', AlumnesPrevistos: 30 },   // nou
      ],                                              // EP-2n A desapareix
    })
    const inserits = vi.mocked(db.insertRow).mock.calls.filter((c) => c[0] === 'excursio_grups')
    const esborrats = vi.mocked(db.deleteRowById).mock.calls.filter((c) => c[0] === 'excursio_grups')
    expect(inserits.map((c) => (c[1] as { grup: string }).grup)).toEqual(['EP-3r A'])
    expect(esborrats.map((c) => c[1])).toEqual(['g2'])
  })

  it('actualitza el nombre d’alumnes d’un grup que es manté', async () => {
    taules({ grups: [
      { id: 'g1', excursio_id: 'e1', grup: 'EP-1r A', alumnes_previstos: 25, alumnes_finals: null },
    ] })
    vi.mocked(db.updateRowById).mockResolvedValue(fila as never)
    await useExcursions.getState().editar('e1', { ...dades, Grups: [{ Grup: 'EP-1r A', AlumnesPrevistos: 31 }] })
    expect(vi.mocked(db.updateRowById)).toHaveBeenCalledWith('excursio_grups', 'g1', { alumnes_previstos: 31 })
    expect(vi.mocked(db.deleteRowById)).not.toHaveBeenCalled()
  })
})

describe('canviar d’estat', () => {
  it('envia el motiu quan es rebutja', async () => {
    vi.mocked(db.updateRowById).mockResolvedValue({ ...fila, estat: 'Esborrany', motiu_rebuig: 'Falta data' } as never)
    await useExcursions.getState().canviarEstat('e1', 'Esborrany', 'Falta data')
    expect(vi.mocked(db.updateRowById)).toHaveBeenCalledWith('excursions', 'e1', { estat: 'Esborrany', motiu_rebuig: 'Falta data' })
  })

  it('envia el motiu quan es cancel·la', async () => {
    vi.mocked(db.updateRowById).mockResolvedValue({ ...fila, estat: 'Cancel·lada' } as never)
    await useExcursions.getState().canviarEstat('e1', 'Cancel·lada', 'Pluja')
    expect(vi.mocked(db.updateRowById)).toHaveBeenCalledWith('excursions', 'e1', { estat: 'Cancel·lada', motiu_cancellacio: 'Pluja' })
  })

  it('no inventa motius en una aprovació', async () => {
    vi.mocked(db.updateRowById).mockResolvedValue({ ...fila, estat: 'Aprovada' } as never)
    await useExcursions.getState().canviarEstat('e1', 'Aprovada')
    expect(vi.mocked(db.updateRowById)).toHaveBeenCalledWith('excursions', 'e1', { estat: 'Aprovada' })
  })

  it('conserva els grups ja carregats en refrescar la fila', async () => {
    useExcursions.setState({ excursions: [{
      ...(await import('./excursions.utils')).rowToExcursio(fila),
      Grups: [{ id: 'g1', Grup: 'EP-1r A', AlumnesPrevistos: 25, AlumnesFinals: null }],
      Acompanyants: ['b@stjosep.org'],
    }] })
    vi.mocked(db.updateRowById).mockResolvedValue({ ...fila, estat: 'Proposada' } as never)
    await useExcursions.getState().canviarEstat('e1', 'Proposada')
    const [e] = useExcursions.getState().excursions
    expect(e.Estat).toBe('Proposada')
    expect(e.Grups).toHaveLength(1)
    expect(e.Acompanyants).toEqual(['b@stjosep.org'])
  })
})

describe('copiar del curs anterior', () => {
  const antiga = {
    ...fila, id: 'vella', codi: 'EXC-010', curs_escolar: '2025-2026', data: '2025-10-20',
    estat: 'Circular enviada', responsable: 'algu-que-ja-no-hi-es@stjosep.org', observacions: 'Portar esmorzar',
  }

  function preparaOrigen() {
    taules({
      excursions: [antiga, { ...antiga, id: 'nomes-una', codi: 'EXC-011' }],
      grups: [
        { id: 'g1', excursio_id: 'vella', grup: 'EP-1r A', alumnes_previstos: 25, alumnes_finals: 24 },
        { id: 'g2', excursio_id: 'nomes-una', grup: 'EP-2n A', alumnes_previstos: 20, alumnes_finals: null },
      ],
      acompanyants: [{ id: 'a1', excursio_id: 'vella', email: 'qui-fos@stjosep.org' }],
    })
    vi.mocked(db.insertRow).mockResolvedValue({ ...fila, id: 'nova' } as never)
  }

  it('només copia les excursions triades', async () => {
    preparaOrigen()
    await useExcursions.getState().copiarDelCurs('2025-2026', ['vella'])
    const excursionsInserides = vi.mocked(db.insertRow).mock.calls.filter((c) => c[0] === 'excursions')
    expect(excursionsInserides).toHaveLength(1)
  })

  it('trasllada la data al curs nou i no copia l’estat', async () => {
    preparaOrigen()
    await useExcursions.getState().copiarDelCurs('2025-2026', ['vella'])
    const payload = vi.mocked(db.insertRow).mock.calls.find((c) => c[0] === 'excursions')?.[1] as Record<string, unknown>
    expect(payload.data).toBe('2026-10-20')
    expect(payload.curs_escolar).toBe('2026-2027')
    // Sense estat: el disparador obliga que neixi com a esborrany.
    expect(payload).not.toHaveProperty('estat')
  })

  it('no copia el responsable, perquè qui hi anava pot no ser-hi ja', () => {
    preparaOrigen()
    return useExcursions.getState().copiarDelCurs('2025-2026', ['vella']).then(() => {
      const payload = vi.mocked(db.insertRow).mock.calls.find((c) => c[0] === 'excursions')?.[1] as Record<string, unknown>
      expect(payload).not.toHaveProperty('responsable')
    })
  })

  it('copia els grups amb els alumnes previstos, però no els finals', async () => {
    preparaOrigen()
    await useExcursions.getState().copiarDelCurs('2025-2026', ['vella'])
    const grup = vi.mocked(db.insertRow).mock.calls.find((c) => c[0] === 'excursio_grups')?.[1] as Record<string, unknown>
    expect(grup).toEqual({ excursio_id: 'nova', grup: 'EP-1r A', alumnes_previstos: 25 })
  })

  it('no copia els acompanyants: les persones canvien d’un curs a l’altre', async () => {
    preparaOrigen()
    await useExcursions.getState().copiarDelCurs('2025-2026', ['vella'])
    expect(vi.mocked(db.insertRow).mock.calls.some((c) => c[0] === 'excursio_acompanyants')).toBe(false)
  })
})

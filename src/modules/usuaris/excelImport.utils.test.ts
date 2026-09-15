import { describe, it, expect } from 'vitest'
import * as XLSX from 'xlsx'
import { parsejaExcelUsuaris, CAPÇALERES_IMPORT_USUARIS } from './excelImport.utils'
import type { Usuari } from './types'

function excel(files: unknown[][], capçaleres: readonly string[] = CAPÇALERES_IMPORT_USUARIS): File {
  const worksheet = XLSX.utils.aoa_to_sheet([[...capçaleres], ...files])
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Usuaris')
  const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
  return new File([buffer], 'usuaris.xlsx')
}

const existent: Usuari = {
  id: '1', Email: 'amoreno@stjosep.org', Nom: 'Andrés', Rol: 'coordinador',
  Etapa: null, PotGestionarMaterial: false, Data_alta: '2026-09-01',
}

describe('importació d’usuaris des d’Excel', () => {
  it('llegeix una fila completa', async () => {
    const [fila] = await parsejaExcelUsuaris(excel([['nova@stjosep.org', 'Nova Persona', 'Professorat', 'EP', 'Sí']]), [])
    expect(fila.valid).toBe(true)
    expect(fila.data).toEqual({
      Email: 'nova@stjosep.org', Nom: 'Nova Persona', Rol: 'professorat',
      Etapa: 'EP', PotGestionarMaterial: true,
    })
  })

  it('posa en minúscules el correu i accepta el rol i l’etapa en qualsevol caixa', async () => {
    const [fila] = await parsejaExcelUsuaris(excel([['  Nova@StJosep.ORG ', 'Nova', 'CAP D’ESTUDIS', 'eso 1r-2n', '']]), [])
    expect(fila.data?.Email).toBe('nova@stjosep.org')
    expect(fila.data?.Rol).toBe('cap_estudis')
    expect(fila.data?.Etapa).toBe('ESO 1r-2n')
    expect(fila.data?.PotGestionarMaterial).toBe(false)
  })

  it('accepta les etiquetes amb l’apòstrof o els accents que hi posa l’autocorrecció', async () => {
    for (const rolEscrit of ["Cap d'Estudis", 'Cap d’Estudis', 'CAP D’ESTUDIS', 'cap destudis'.replace('d', "d'")]) {
      const [fila] = await parsejaExcelUsuaris(excel([['nova@stjosep.org', 'Nova', rolEscrit, '', '']]), [])
      expect(fila.data?.Rol, `rol escrit "${rolEscrit}"`).toBe('cap_estudis')
    }
    const [senseAccent] = await parsejaExcelUsuaris(excel([['nova@stjosep.org', 'Nova', 'Direccio', '', '']]), [])
    expect(senseAccent.data?.Rol).toBe('direccio')
  })

  it('omple el rol per defecte i deixa l’etapa buida quan no s’indiquen', async () => {
    const [fila] = await parsejaExcelUsuaris(excel([['nova@stjosep.org', 'Nova', '', '', '']]), [])
    expect(fila.valid).toBe(true)
    expect(fila.data?.Rol).toBe('professorat')
    expect(fila.data?.Etapa).toBeNull()
  })

  it('salta els correus que ja estan donats d’alta, sense marcar-los com a error', async () => {
    const [fila] = await parsejaExcelUsuaris(excel([['AMORENO@stjosep.org', 'Andrés', 'Professorat', '', '']]), [existent])
    expect(fila.valid).toBe(false)
    expect(fila.jaExisteix).toBe(true)
    expect(fila.error).toBeUndefined()
    expect(fila.avis).toMatch(/ja està donat d’alta/)
  })

  it('salta la segona aparició d’un correu repetit dins del mateix fitxer', async () => {
    const files = await parsejaExcelUsuaris(excel([
      ['nova@stjosep.org', 'Primera', 'Professorat', '', ''],
      ['nova@stjosep.org', 'Segona', 'Professorat', '', ''],
    ]), [])
    expect(files[0].valid).toBe(true)
    expect(files[1].valid).toBe(false)
    expect(files[1].error).toMatch(/repetit/)
  })

  it('rebutja els correus de fora del domini del centre', async () => {
    const [fila] = await parsejaExcelUsuaris(excel([['algu@gmail.com', 'Algú', 'Professorat', '', '']]), [])
    expect(fila.valid).toBe(false)
    expect(fila.error).toMatch(/@stjosep\.org/)
  })

  it('rebutja un rol o una etapa que no existeixen, dient quins valen', async () => {
    const [rol] = await parsejaExcelUsuaris(excel([['a@stjosep.org', 'A', 'Conserge', '', '']]), [])
    expect(rol.valid).toBe(false)
    expect(rol.error).toContain('Professorat')
    const [etapa] = await parsejaExcelUsuaris(excel([['b@stjosep.org', 'B', 'Professorat', 'FP Superior', '']]), [])
    expect(etapa.valid).toBe(false)
    expect(etapa.error).toContain('EP')
  })

  it('rebutja les files sense nom i ignora les completament buides', async () => {
    const files = await parsejaExcelUsuaris(excel([
      ['nova@stjosep.org', '', 'Professorat', '', ''],
      ['', '', '', '', ''],
    ]), [])
    expect(files).toHaveLength(1)
    expect(files[0].valid).toBe(false)
    expect(files[0].error).toMatch(/nom/i)
  })

  it('no depèn de l’ordre de les columnes', async () => {
    const [fila] = await parsejaExcelUsuaris(
      excel([['Nova', 'EP', 'nova@stjosep.org']], ['Nom', 'Etapa', 'Correu']),
      [],
    )
    expect(fila.valid).toBe(true)
    expect(fila.data?.Email).toBe('nova@stjosep.org')
    expect(fila.data?.Etapa).toBe('EP')
  })

  it('avisa clarament quan el full no té les columnes mínimes', async () => {
    await expect(parsejaExcelUsuaris(excel([['x']], ['Una altra cosa']), []))
      .rejects.toThrow(/columnes/)
  })

  it('numera les files com les veu l’usuari al full de càlcul', async () => {
    const files = await parsejaExcelUsuaris(excel([
      ['a@stjosep.org', 'A', 'Professorat', '', ''],
      ['b@gmail.com', 'B', 'Professorat', '', ''],
    ]), [])
    expect(files[0].fila).toBe(2)
    expect(files[1].fila).toBe(3)
  })
})

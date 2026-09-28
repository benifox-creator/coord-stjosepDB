import { describe, it, expect } from 'vitest'
import { grupsVisibles, type GrupMenu } from './navGrups'

describe('agrupar el menú lateral', () => {
  const grups: GrupMenu<string>[] = [
    { titol: 'Dia a dia', items: ['Inici', 'Horaris'] },
    { titol: 'Recursos', items: ['Préstecs'] },
    { titol: 'Gestió TIC', items: ['Manteniment', 'Pla d’Acció'] },
  ]

  it('amb tots els elements visibles, cada grup surt sencer', () => {
    expect(grupsVisibles(grups, () => true)).toEqual(grups)
  })

  it('un grup que es queda sense cap element visible no surt', () => {
    // «Recursos» només tenia «Préstecs»: sense ell, el grup sencer desapareix
    // en comptes d'ensenyar un títol sense res a sota.
    const g = grupsVisibles(grups, (item) => item !== 'Préstecs')
    expect(g.map((x) => x.titol)).toEqual(['Dia a dia', 'Gestió TIC'])
  })

  it('un grup amb alguns elements visibles es queda només amb aquells', () => {
    const g = grupsVisibles(grups, (item) => item !== 'Horaris')
    expect(g.find((x) => x.titol === 'Dia a dia')?.items).toEqual(['Inici'])
  })

  it('l’ordre dels grups i dels items no canvia', () => {
    const g = grupsVisibles(grups, () => true)
    expect(g.map((x) => x.titol)).toEqual(['Dia a dia', 'Recursos', 'Gestió TIC'])
    expect(g.find((x) => x.titol === 'Gestió TIC')?.items).toEqual(['Manteniment', 'Pla d’Acció'])
  })

  it('cap element es perd pel camí', () => {
    const g = grupsVisibles(grups, () => true)
    const total = g.reduce((s, x) => s + x.items.length, 0)
    const totalOriginal = grups.reduce((s, x) => s + x.items.length, 0)
    expect(total).toBe(totalOriginal)
  })

  it('si tots els grups es queden buits, no en surt cap', () => {
    expect(grupsVisibles(grups, () => false)).toEqual([])
  })

  it('un grup que ja era buit d’entrada tampoc no surt', () => {
    const ambBuit: GrupMenu<string>[] = [...grups, { titol: 'Buit', items: [] }]
    const g = grupsVisibles(ambBuit, () => true)
    expect(g.map((x) => x.titol)).not.toContain('Buit')
  })
})

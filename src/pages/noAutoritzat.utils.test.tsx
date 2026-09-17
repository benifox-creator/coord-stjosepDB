import { describe, it, expect } from 'vitest'
import { explicacio } from './noAutoritzat.utils'

describe('explicació de per què algú no ha entrat', () => {
  it('només parla del domini quan el problema és realment el domini', () => {
    expect(explicacio('domini-no-autoritzat', 'algu@gmail.com').titol).toBe('Accés no autoritzat')
  })

  it('diu que falta activar l’accés, no que el compte sigui d’un altre domini', () => {
    const { titol, detall } = explicacio('sense-acces', 'prova1@stjosep.org')
    expect(titol).toBe('Sense accés')
    expect(JSON.stringify(detall)).toContain('coordinació')
  })

  it('convida a tornar-ho a provar quan no s’ha pogut llegir el correu', () => {
    const { titol, detall } = explicacio('correu-no-disponible', '')
    expect(titol).toBe('No s’ha pogut completar l’entrada')
    expect(JSON.stringify(detall)).toContain('segon intent')
  })

  it('no inventa un correu que no té', () => {
    expect(JSON.stringify(explicacio('sense-acces', '').text)).not.toContain('undefined')
  })
})

import { describe, it, expect } from 'vitest'
import { planifica, normalitza, claimsAmbRol } from '../supabase/functions/provisiona-usuaris/pla'

const registrats = new Set(['nou@stjosep.org', 'sense@stjosep.org', 'fet@stjosep.org', 'altre@stjosep.org'])

describe('alta automàtica a Firebase', () => {
  it('normalitza els correus: minúscules, sense espais ni repetits', () => {
    expect(normalitza([' Nou@StJosep.org', 'nou@stjosep.org', '', 3, null])).toEqual(['nou@stjosep.org'])
    expect(normalitza('nou@stjosep.org')).toEqual([])
  })

  it('crea qui no té compte, marca qui no té el claim i deixa qui ja el té', () => {
    const pla = planifica(
      ['nou@stjosep.org', 'sense@stjosep.org', 'fet@stjosep.org'],
      registrats,
      [
        { localId: 'u1', email: 'Sense@stjosep.org' },
        { localId: 'u2', email: 'fet@stjosep.org', customAttributes: '{"role":"authenticated"}' },
      ],
    )
    expect(pla.crear).toEqual(['nou@stjosep.org'])
    expect(pla.marcar).toEqual([{ email: 'sense@stjosep.org', localId: 'u1', claims: { role: 'authenticated' } }])
    expect(pla.jaFets).toEqual(['fet@stjosep.org'])
  })

  it('conserva els altres claims en afegir el rol', () => {
    expect(claimsAmbRol('{"admin":true,"role":"anon"}')).toEqual({ admin: true, role: 'authenticated' })
    expect(claimsAmbRol('no és json')).toEqual({ role: 'authenticated' })
  })

  it('no toca correus de fora del domini ni que no siguin a la llista d’usuaris', () => {
    const pla = planifica(['intrus@gmail.com', 'nollistat@stjosep.org'], registrats, [])
    expect(pla.descartats).toEqual(['intrus@gmail.com', 'nollistat@stjosep.org'])
    expect(pla.crear).toEqual([])
  })
})

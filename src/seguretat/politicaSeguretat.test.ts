import { describe, it, expect } from 'vitest'
import { politicaSeguretat } from './politicaSeguretat'

const politica = politicaSeguretat({
  supabaseUrl: 'https://abc.supabase.co/',
  firebaseAuthDomain: 'coord-stjosep.firebaseapp.com',
})
const directiva = (nom: string) => politica.split('; ').find((d) => d.startsWith(nom + ' ')) ?? ''

describe('política de seguretat de contingut', () => {
  it('no deixa executar codi en línia ni de llocs desconeguts', () => {
    expect(directiva('script-src')).toBe("script-src 'self' https://apis.google.com")
    expect(politica).not.toContain("'unsafe-eval'")
    expect(directiva('object-src')).toBe("object-src 'none'")
  })
  it('deixa parlar amb Supabase, també pel canal de temps real', () => {
    expect(directiva('connect-src')).toContain('https://abc.supabase.co')
    expect(directiva('connect-src')).toContain('wss://abc.supabase.co')
  })
  it('deixa obrir l’inici de sessió de Google', () => {
    expect(directiva('frame-src')).toContain('https://coord-stjosep.firebaseapp.com')
    expect(directiva('connect-src')).toContain('https://securetoken.googleapis.com')
  })
})

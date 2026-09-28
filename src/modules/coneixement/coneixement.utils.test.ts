import { describe, it, expect } from 'vitest'
import { formatDateISO, parseLinks, serializeLinks, parseTags } from './coneixement.utils'

describe('formatDateISO', () => {
  it('dona la data en Europe/Madrid, no en UTC', () => {
    // A l'estiu, Europe/Madrid va dues hores per davant d'UTC: a les 23:30
    // UTC del 15 de juny ja és el 16 a Madrid.
    expect(formatDateISO(new Date('2026-06-15T23:30:00Z'))).toBe('2026-06-16')
  })

  it('a la matinada, encara és el dia d’ahir en UTC però ja és avui a Madrid', () => {
    // És exactament el cas que feia caducar tard un avís: entre mitjanit i
    // les dues, `toISOString()` encara deia ahir.
    expect(formatDateISO(new Date('2026-01-01T00:30:00Z'))).toBe('2026-01-01')
  })

  it('a l’hivern, Europe/Madrid va una hora per davant d’UTC', () => {
    expect(formatDateISO(new Date('2026-01-15T23:30:00Z'))).toBe('2026-01-16')
  })
})

describe('parseLinks', () => {
  it('retorna una llista buida si el text és buit', () => {
    expect(parseLinks('')).toEqual([])
  })
  it('retorna una llista buida si el JSON no és vàlid', () => {
    expect(parseLinks('no és json')).toEqual([])
  })
  it('descarta els enllaços sense etiqueta o sense url', () => {
    const raw = JSON.stringify([{ label: 'Bo', url: 'https://x.com' }, { label: '', url: 'https://y.com' }])
    expect(parseLinks(raw)).toEqual([{ label: 'Bo', url: 'https://x.com' }])
  })
})

describe('serializeLinks', () => {
  it('descarta els enllaços amb camps buits i retorna cadena buida si no en queda cap', () => {
    expect(serializeLinks([{ label: '  ', url: 'https://x.com' }])).toBe('')
  })
  it('serialitza només els enllaços vàlids', () => {
    const links = [{ label: 'Bo', url: 'https://x.com' }, { label: '  ', url: '' }]
    expect(JSON.parse(serializeLinks(links))).toEqual([{ label: 'Bo', url: 'https://x.com' }])
  })
})

describe('parseTags', () => {
  it('separa per comes i neteja espais', () => {
    expect(parseTags(' a, b ,, c ')).toEqual(['a', 'b', 'c'])
  })
})

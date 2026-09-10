import { create } from 'zustand'
import { supabase } from '../services/db'

const TABLE = 'config'

export const MODULS_VISIBILITAT = [
  { key: 'incidencies',  label: 'Incidències' },
  { key: 'inventari',    label: 'Inventari' },
  { key: 'material',     label: 'Material i Stock' },
  { key: 'prestecs',     label: 'Préstecs' },
  { key: 'reserves',     label: 'Reserves' },
  { key: 'substitucions', label: 'Substitucions' },
  { key: 'coneixement',  label: 'Base de Coneixement' },
  { key: 'pla-accio',    label: "Pla d'Acció" },
  { key: 'manteniment',  label: 'Manteniment' },
  { key: 'material-infantil', label: 'Material Infantil' },
] as const

export const ROLS_VISIBILITAT = ['direccio', 'titular', 'cap_estudis', 'professorat', 'convidat'] as const
export const ROL_VIS_LABELS: Record<string, string> = {
  direccio: 'Direcció',
  titular: 'Titular',
  cap_estudis: "Cap d'Estudis",
  professorat: 'Professorat',
  convidat: 'Convidat',
}

// Helper reactiu: cal passar config (selector de zustand) per garantir re-renders
export function canAccessModul(
  config: Record<string, string[]>,
  visKey: string,
  rol: string | null,
): boolean {
  if (rol === 'coordinador') return true
  if (!rol) return false
  const key = `visibilitat.${visKey}`
  const saved = config[key]
  const vals = saved && saved.length > 0 ? saved : (CONFIG_DEFAULTS[key] ?? [])
  return vals.includes(rol)
}

export const CONFIG_DEFAULTS: Record<string, string[]> = {
  'reserves.espais': [
    "Aula d'informàtica", 'Sala de reunions', 'Sala de projecció',
    'Laboratori de ciències', 'Biblioteca', 'Aula polivalent',
    "Sala d'actes", 'Gimnàs', 'Pati exterior', 'Altres',
  ],
  'material.categories': [
    'Cable', 'Adaptador', 'Àudio/Vídeo', 'Perifèric',
    'Emmagatzematge', 'Bateria/Carregador', 'Projecció', 'Altre',
  ],
  'inventari.categories': [
    'Portàtil', 'Ordinador', 'Tauleta', 'Projector',
    'Impressora', 'Switch/Router', 'Monitor', 'Servidor', 'Altre',
  ],
  'incidencies.tipus': [
    'Maquinari', 'Programari', 'Xarxa', 'Projector/Pantalla', 'Impressora', 'Altre',
  ],
  'incidencies.localitzacions': [
    'Aula informàtica', 'Sala de professors', 'Secretaria',
    'Biblioteca', 'Laboratori', "Sala d'actes", 'Altra',
  ],
  'coneixement.categories': [
    'Procediments', 'Infraestructura', 'Dispositius', 'Incidències freqüents', 'Administratiu',
  ],
  'pla-accio.categories': [
    'Xarxa', 'Equipament', 'Programari', 'Seguretat', 'Formació', 'Infraestructura',
  ],
  'manteniment.email': [],
  'emails.firma': ['Administració'],
  'absencies.motius': [
    'Visita mèdica', 'Assumptes propis', 'Baixa/malaltia', 'Formació', 'Altre',
  ],
  'reserves.espais-colors': [],
  'substitucions.grups': [
    'EI-3 A', 'EI-4 A', 'EI-5 A',
    'EP-1r A', 'EP-1r B', 'EP-2n A', 'EP-2n B', 'EP-3r A', 'EP-3r B',
    'EP-4t A', 'EP-4t B', 'EP-5è A', 'EP-5è B', 'EP-6è A', 'EP-6è B',
    '1r ESO A', '1r ESO B', '2n ESO A', '2n ESO B',
    '3r ESO A', '3r ESO B', '4t ESO A', '4t ESO B',
    '1r BATX A', '1r BATX B', '2n BATX A', '2n BATX B',
    'GM',
  ],
  'substitucions.franges.EI':    ['9:00-10:00', '10:00-11:00', '11:30-12:30', '12:30-13:00', '15:00-16:00', '16:00-17:00'],
  'substitucions.franges.EP':    ['9:00-10:00', '10:00-11:00', '11:30-12:30', '12:30-13:00', '15:00-16:00', '16:00-17:00'],
  'substitucions.franges.ESO12': ['8:00-9:00', '9:00-10:00', '10:00-11:00', '11:30-12:30', '12:30-13:24', '15:15-16:15', '16:15-17:15'],
  'substitucions.franges.ESO34': ['8:00-9:00', '9:00-10:00', '10:00-11:00', '11:30-12:30', '12:30-13:24', '15:15-16:15', '16:15-17:15'],
  'substitucions.franges.BATX':  ['8:00-9:00', '9:00-10:00', '10:00-11:00', '11:30-12:30', '12:30-13:24', '15:15-16:15', '16:15-17:15'],
  'substitucions.franges.GM':    ['8:00-9:00', '9:00-10:00', '10:00-11:00', '11:30-12:30', '12:30-13:24'],
  'material-infantil.curs-actiu': ['2026-2027'],
  'material-infantil.alumnes-i3': ['0'],
  'material-infantil.alumnes-i4': ['0'],
  'material-infantil.alumnes-i5': ['0'],
  'material-infantil.marge-seguretat-pct': ['0'],
  'material-infantil.pressupost-objectiu': ['0'],
  // Visibilitat per defecte: tots els rols veuen tots els mòduls
  'visibilitat.incidencies':  ['direccio', 'titular', 'cap_estudis', 'professorat', 'convidat'],
  'visibilitat.inventari':    ['direccio', 'titular', 'cap_estudis', 'professorat', 'convidat'],
  'visibilitat.material':     ['direccio', 'titular', 'cap_estudis', 'professorat', 'convidat'],
  'visibilitat.prestecs':     ['direccio', 'titular', 'cap_estudis', 'professorat', 'convidat'],
  'visibilitat.reserves':     ['direccio', 'titular', 'cap_estudis', 'professorat', 'convidat'],
  'visibilitat.substitucions': ['direccio', 'titular', 'cap_estudis', 'professorat', 'convidat'],
  'visibilitat.coneixement':  ['direccio', 'titular', 'cap_estudis', 'professorat', 'convidat'],
  'visibilitat.pla-accio':    ['direccio', 'titular', 'cap_estudis', 'professorat', 'convidat'],
  'visibilitat.manteniment':  ['direccio', 'titular', 'cap_estudis', 'professorat', 'convidat'],
  'visibilitat.material-infantil': ['direccio', 'titular', 'cap_estudis'],
}

interface ConfigState {
  config: Record<string, string[]>
  loaded: boolean
  loading: boolean
  error: string | null
  getValues: (clau: string) => string[]
  load: () => Promise<void>
  update: (clau: string, valors: string[]) => Promise<void>
}

export const useConfigStore = create<ConfigState>((set, get) => ({
  config: {},
  loaded: false,
  loading: false,
  error: null,

  getValues(clau) {
    const saved = get().config[clau]
    return saved && saved.length > 0 ? saved : (CONFIG_DEFAULTS[clau] ?? [])
  },

  async load() {
    if (get().loading) return
    set({ loading: true, error: null })
    try {
      const { data, error } = await supabase.from(TABLE).select('clau, valors')
      if (error) throw error
      const config: Record<string, string[]> = {}
      for (const row of (data ?? []) as { clau: string; valors: string[] }[]) {
        if (row.clau && row.valors?.length > 0) config[row.clau] = row.valors
      }
      set({ config, loaded: true })
    } catch {
      // Taula no existeix o sense accés — usem defaults silenciosament
      set({ loaded: true })
    } finally {
      set({ loading: false })
    }
  },

  async update(clau, valors) {
    set((s) => ({ config: { ...s.config, [clau]: valors } }))
    const { error } = await supabase.from(TABLE).upsert({ clau, valors })
    if (error) throw new Error(`Error desant configuració: ${error.message}`)
  },
}))

// Firma que apareix al peu dels correus automàtics (absències, substitucions, incidències...).
// Funció standalone perquè la criden builders d'email que no són components React.
export function getFirmaEmail(): string {
  return useConfigStore.getState().getValues('emails.firma')[0] || 'Administració'
}

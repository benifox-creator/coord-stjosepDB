import { create } from 'zustand'
import { getAll, supabase } from '../services/db'
import { schoolYear } from '../utils/schoolCalendar'

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
  { key: 'horaris', label: 'Horaris' },
  { key: 'excursions', label: 'Excursions' },
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
  const vals = saved ?? CONFIG_DEFAULTS[key] ?? []
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
  'centre.dies-no-lectius': [],
  'emails.firma': ['Administració'],
  'absencies.motius': [
    'Visita mèdica', 'Assumptes propis', 'Baixa/malaltia', 'Formació', 'Altre',
  ],
  'reserves.espais-colors': [],
  // El centre té tres línies a tots els nivells excepte GM, que no en té.
  // Infantil són I3, I4 i I5. Si algun dia canvia, la llista s'edita des de
  // Configuració → Grups del centre.
  'substitucions.grups': [
    'I3 A', 'I3 B', 'I3 C', 'I4 A', 'I4 B', 'I4 C', 'I5 A', 'I5 B', 'I5 C',
    'EP-1r A', 'EP-1r B', 'EP-1r C', 'EP-2n A', 'EP-2n B', 'EP-2n C',
    'EP-3r A', 'EP-3r B', 'EP-3r C', 'EP-4t A', 'EP-4t B', 'EP-4t C',
    'EP-5è A', 'EP-5è B', 'EP-5è C', 'EP-6è A', 'EP-6è B', 'EP-6è C',
    '1r ESO A', '1r ESO B', '1r ESO C', '2n ESO A', '2n ESO B', '2n ESO C',
    '3r ESO A', '3r ESO B', '3r ESO C', '4t ESO A', '4t ESO B', '4t ESO C',
    '1r BATX A', '1r BATX B', '1r BATX C', '2n BATX A', '2n BATX B', '2n BATX C',
    'GM',
  ],
  // Marcs horaris reals del centre (2026-2027). El pati és una franja més: qui el
  // té el marca al seu horari com a "No lectiva → Pati" i ja genera cobertura.
  'substitucions.franges.EI':    ['9:00-9:45', '9:45-10:30', '10:30-11:00', '11:00-12:00', '12:00-13:00', '15:00-15:45', '15:45-16:30', '16:30-17:00'],
  'substitucions.franges.EP':    ['9:00-9:45', '9:45-10:30', '10:30-11:00', '11:00-12:00', '12:00-13:00', '15:00-15:30', '15:30-16:15', '16:15-17:00'],
  'substitucions.franges.ESO12': ['8:00-9:00', '9:00-10:00', '10:00-11:00', '11:00-11:24', '11:24-12:24', '12:24-13:24', '13:24-14:24', '15:15-16:15', '16:15-17:15'],
  'substitucions.franges.ESO34': ['8:00-9:00', '9:00-10:00', '10:00-11:00', '11:00-11:24', '11:24-12:24', '12:24-13:24', '13:24-14:24', '15:15-16:15', '16:15-17:15'],
  // BATX té dues variants de migdia que se solapen entre elles (13:24-14:24 i
  // 13:35-14:50): totes dues surten a la graella, i el servidor ja impedeix que
  // ningú es marqui les dues alhora.
  'substitucions.franges.BATX':  ['8:00-9:00', '9:00-10:00', '10:00-11:00', '11:00-11:24', '11:24-12:24', '12:24-13:24', '13:24-14:24', '13:35-14:50', '15:15-16:15', '16:15-17:15'],
  'substitucions.franges.GM':    ['8:00-9:00', '9:00-10:00', '10:00-11:00', '11:00-11:24', '11:24-12:24', '12:24-13:24', '13:24-14:24', '15:15-16:15'],
  'material-infantil.categories': [
    'Plàstica', 'Papereria', 'Psicomotricitat', 'Higiene', 'Aula', 'Llibres/quaderns', 'Altres',
  ],
  'material-infantil.curs-actiu': [schoolYear()],
  'material-infantil.alumnes-i3': ['0'],
  'material-infantil.alumnes-i4': ['0'],
  'material-infantil.alumnes-i5': ['0'],
  'material-infantil.marge-seguretat-pct': ['0'],
  'material-infantil.pressupost-objectiu': ['0'],
  'horaris.tipus-no-lectiva': ['Guàrdia', 'Pati', 'Tutoria', 'Coordinació', 'Reunió', 'Hora lliure'],
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
  // El convidat no hi és: no ha de veure el pla del curs.
  'visibilitat.excursions': ['direccio', 'titular', 'cap_estudis', 'professorat'],
  'visibilitat.horaris': ['direccio', 'titular', 'cap_estudis', 'professorat'],
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
    return saved ?? CONFIG_DEFAULTS[clau] ?? []
  },

  async load() {
    if (get().loading) return
    set({ loading: true, error: null })
    try {
      const data = await getAll<{ clau: string; valors: string[] }>(TABLE, 'clau', {}, 'clau')
      const config: Record<string, string[]> = {}
      for (const row of (data ?? []) as { clau: string; valors: string[] }[]) {
        if (row.clau && Array.isArray(row.valors)) config[row.clau] = row.valors
      }
      set({ config, loaded: true })
    } catch (err) {
      set({ loaded: false, error: err instanceof Error ? err.message : 'Error carregant configuració' })
    } finally {
      set({ loading: false })
    }
  },

  async update(clau, valors) {
    const { error } = await supabase.from(TABLE).upsert({ clau, valors })
    if (error) throw new Error(`Error desant configuració: ${error.message}`)
    set((s) => ({ config: { ...s.config, [clau]: valors } }))
  },
}))

// Firma que apareix al peu dels correus automàtics (absències, substitucions, incidències...).
// Funció standalone perquè la criden builders d'email que no són components React.
export function getFirmaEmail(): string {
  return useConfigStore.getState().getValues('emails.firma')[0] || 'Administració'
}

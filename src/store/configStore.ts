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
  { key: 'notificacions', label: 'Correus' },
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
  // Nomenclatura unificada ETAPA-nivell + línia. Abans convivien tres
  // convencions ('I3 A', 'EP-1r A', '1r ESO A') i això ja havia produït
  // registres on el grup i l'etapa es contradeien. La llista s'edita des de
  // Configuració → Grups del centre.
  'substitucions.grups': [
    'EI-3 A', 'EI-3 B', 'EI-3 C', 'EI-4 A', 'EI-4 B', 'EI-4 C', 'EI-5 A', 'EI-5 B', 'EI-5 C',
    'EP-1 A', 'EP-1 B', 'EP-1 C', 'EP-2 A', 'EP-2 B', 'EP-2 C', 'EP-3 A', 'EP-3 B', 'EP-3 C',
    'EP-4 A', 'EP-4 B', 'EP-4 C', 'EP-5 A', 'EP-5 B', 'EP-5 C', 'EP-6 A', 'EP-6 B', 'EP-6 C',
    'ESO-1 A', 'ESO-1 B', 'ESO-1 C', 'ESO-2 A', 'ESO-2 B', 'ESO-2 C',
    'ESO-3 A', 'ESO-3 B', 'ESO-3 C', 'ESO-4 A', 'ESO-4 B', 'ESO-4 C',
    'BATX-1 A', 'BATX-1 B', 'BATX-2 A', 'BATX-2 B',
    'CFGM-1', 'CFGM-2',
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
  // Pantalla operativa: cadascú només veu els correus que ha generat ell,
  // i la coordinació els veu tots. Per defecte, només els càrrecs.
  'visibilitat.notificacions': ['direccio', 'titular', 'cap_estudis'],
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

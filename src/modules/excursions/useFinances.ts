import { create } from 'zustand'
import { getAll, insertRow, updateRowById, deleteRowById, callRpc, supabase } from '../../services/db'
import type { Finances, Autocar } from './finances.types'
import { FINANCES_BUIDES } from './finances.types'
import type { ParametresPreu } from './preu'
import type { PreusImportats } from './pressupostImport.utils'

interface FinancesRow {
  excursio_id: string
  preu_activitat: string | number
  preu_activitat_tipus: 'per_alumne' | 'total'
  ampa_import: string | number
  ampa_cobreix_activitat: boolean
  cost_acompanyants: string | number
}
interface AutocarRow { id: string; excursio_id: string; places: number; preu: string | number }

export interface ResultatImportPressupostos {
  escrites: number
  errors: { codi: string; error: string }[]
}

interface FinancesState {
  finances: Finances | null
  loading: boolean
  error: string | null
  carrega: (excursioId: string) => Promise<void>
  desa: (excursioId: string, f: Finances) => Promise<void>
  confirma: (excursioId: string, preu: number, f: Finances, parametres: ParametresPreu) => Promise<void>
  importaPressupostos: (items: { excursioId: string; codi: string; dades: PreusImportats }[]) => Promise<ResultatImportPressupostos>
}

// Si es demanen els costos de dues excursions seguides (per exemple, en obrir
// la fitxa d'una i tot seguit una altra abans que la primera resposta arribi),
// només val la darrera: si no, una resposta lenta de la primera excursió
// podria pisar la de la que s'està mirant ara i la fitxa ensenyaria el preu
// d'una altra excursió. Mateix criteri que `generacio` a `useExcursions.load`.
let generacio = 0

export const useFinances = create<FinancesState>((set, get) => ({
  finances: null,
  loading: false,
  error: null,

  async carrega(excursioId) {
    const meva = ++generacio
    set({ loading: true, error: null })
    try {
      const [files, autocars] = await Promise.all([
        getAll<FinancesRow>('excursio_finances', 'excursio_id', { excursio_id: excursioId }, 'excursio_id'),
        getAll<AutocarRow>('excursio_autocars', 'id', { excursio_id: excursioId }),
      ])
      if (meva !== generacio) return
      // Zero files no és cap error: o bé encara no s'hi ha entrat res, o bé
      // qui mira no té accés als diners i l'RLS no li'n dona cap. En tots dos
      // casos la pantalla ha d'ensenyar el formulari buit, no un error vermell.
      const f = files[0]
      set({ finances: {
        ...FINANCES_BUIDES,
        ...(f ? {
          PreuActivitat: Number(f.preu_activitat),
          PreuActivitatTipus: f.preu_activitat_tipus,
          AmpaImport: Number(f.ampa_import),
          AmpaCobreixActivitat: f.ampa_cobreix_activitat,
          CostAcompanyants: Number(f.cost_acompanyants),
        } : {}),
        Autocars: autocars.map((a): Autocar => ({ id: a.id, Places: a.places, Preu: Number(a.preu) })),
      } })
    } catch (err) {
      // `finances` també s'esborra i no només `error`: si es deixés la còpia
      // de l'excursió anterior, qui truqui després (`ExcursioDetall`) no té
      // manera de distingir "són els costos d'aquesta excursió" de "són els
      // que hi havia abans i la càrrega ha fallat" — i sense distingir-ho,
      // "Desa els costos" escriuria els números d'una excursió a la fila
      // d'una altra.
      if (meva === generacio) set({ error: err instanceof Error ? err.message : 'Error carregant els costos', finances: null })
    } finally {
      if (meva === generacio) set({ loading: false })
    }
  },

  async desa(excursioId, f) {
    // `upsert` i no els ajudants de sempre: `updateRowById` filtra per una
    // columna `id` fixa, i `excursio_finances` té `excursio_id` com a clau
    // primària i cap columna `id`. Amb la clau primària, un sol `upsert` ja
    // fa inserir-o-actualitzar.
    const { error } = await supabase.from('excursio_finances').upsert({
      excursio_id: excursioId,
      preu_activitat: f.PreuActivitat,
      preu_activitat_tipus: f.PreuActivitatTipus,
      ampa_import: f.AmpaImport,
      ampa_cobreix_activitat: f.AmpaCobreixActivitat,
      cost_acompanyants: f.CostAcompanyants,
    })
    if (error) throw new Error(`Error desant els costos: ${error.message}`)

    // Els autocars es posen al dia per diferència i no esborrant-ho tot: si una
    // escriptura falla, el que ja hi havia no s'ha perdut pel camí. Mateixa idea
    // que `sincronitzaFilles` a `useExcursions`, però no idèntica: allà els grups
    // es comparen pel seu nom (la seva clau natural), mentre que un autocar no en
    // té cap, així que aquí la comparació és per `id`.
    const actuals = await getAll<AutocarRow>('excursio_autocars', 'id', { excursio_id: excursioId })
    for (const a of actuals) {
      const volgut = f.Autocars.find((v) => v.id === a.id)
      if (!volgut) await deleteRowById('excursio_autocars', a.id)
      else if (volgut.Places !== a.places || volgut.Preu !== Number(a.preu)) {
        await updateRowById('excursio_autocars', a.id, { places: volgut.Places, preu: volgut.Preu })
      }
    }
    for (const v of f.Autocars) {
      if (!actuals.some((a) => a.id === v.id)) {
        await insertRow('excursio_autocars', { excursio_id: excursioId, places: v.Places, preu: v.Preu })
      }
    }
    await get().carrega(excursioId)
  },

  async confirma(excursioId, preu, f, parametres) {
    // Es desen els costos abans de congelar el preu, i amb la mateixa `f` amb
    // què `BlocEconomic` ha calculat `preu`: sense això, un preu es podia
    // confirmar amb l'estat del formulari encara no desat, i la fila de
    // costos guardada podia acabar descrivint una altra cosa que el preu
    // congelat. Així els dos surten sempre de la mateixa dada.
    await get().desa(excursioId, f)
    await callRpc('confirmar_preu', {
      p_id: excursioId, p_preu: preu,
      p_previsio: parametres.previsio, p_marge_pct: parametres.margePct, p_iva_pct: parametres.ivaPct,
    })
  },

  /**
   * Escriu els preus que han tornat de l'empresa. No toca l'estat del store:
   * escriu diverses sortides seguides i la fitxa que hi hagi oberta és d'una
   * altra, així que canviar-li els costos de sota ensenyaria els d'una tercera.
   */
  async importaPressupostos(items) {
    const errors: { codi: string; error: string }[] = []
    let escrites = 0
    for (const { excursioId, codi, dades } of items) {
      try {
        // La fila de finances es llegeix abans perquè l'`upsert` la reemplaça
        // sencera: sense tornar-hi el que ja hi havia, importar preus d'autocar
        // buidaria l'aportació de l'AMPA i el cost dels acompanyants.
        const [actual] = await getAll<FinancesRow>(
          'excursio_finances', 'excursio_id', { excursio_id: excursioId }, 'excursio_id')

        const { error } = await supabase.from('excursio_finances').upsert({
          excursio_id: excursioId,
          preu_activitat: dades.preuActivitat ?? Number(actual?.preu_activitat ?? 0),
          preu_activitat_tipus: dades.preuActivitatTipus ?? actual?.preu_activitat_tipus ?? 'per_alumne',
          ampa_import: Number(actual?.ampa_import ?? 0),
          ampa_cobreix_activitat: actual?.ampa_cobreix_activitat ?? false,
          cost_acompanyants: Number(actual?.cost_acompanyants ?? 0),
        })
        if (error) throw new Error(`Error desant els costos: ${error.message}`)

        if (dades.autocars.length > 0) {
          const vells = await getAll<AutocarRow>('excursio_autocars', 'id', { excursio_id: excursioId })
          // Primer els nous i després esborrar els vells: si peta enmig, val més
          // una sortida amb autocars duplicats —que es veuen a la fitxa i
          // s'esborren— que una que s'ha quedat sense cap preu. Aquesta garantia
          // és per sortida i el `try/catch` de fora no l'ha de trencar: si
          // l'inserció peta, l'excepció salta abans d'arribar als `deleteRowById`
          // d'aquí sota, així que el catch de fora mai no executa un esborrat
          // que hauria de dependre d'una inserció que no s'ha arribat a fer.
          for (const a of dades.autocars) {
            await insertRow('excursio_autocars', { excursio_id: excursioId, places: a.places, preu: a.preu })
          }
          for (const v of vells) await deleteRowById('excursio_autocars', v.id)
        }
        escrites++
      } catch (err) {
        // Es continua amb la següent sortida en comptes de tallar tot el
        // bucle: aturar-se aquí deixaria qui ha cridat sense cap manera de
        // saber si les sortides posteriors a la que ha petat s'havien arribat
        // a intentar. Reintentar el fitxer sencer és segur perquè la
        // importació és idempotent (vegeu «importar dues vegades el mateix
        // fitxer deixa el mateix resultat» a les proves).
        errors.push({ codi, error: err instanceof Error ? err.message : String(err) })
      }
    }
    return { escrites, errors }
  },
}))

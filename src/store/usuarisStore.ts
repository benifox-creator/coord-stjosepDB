import { create } from 'zustand'
import { supabase, getAll, insertRow, updateRowById } from '../services/db'
import type { Rol, Usuari, EtapaSubstitucio } from '../modules/usuaris/types'
import { ETAPES_USUARI, ROLS } from '../modules/usuaris/types'

const TABLE = 'usuaris'
let sessionGeneration = 0

const ROLS_VALIDS = new Set<string>(ROLS)
const ETAPES_VALIDES = new Set<string>(ETAPES_USUARI)

function parseRol(value: string | null | undefined): Rol {
  const v = value?.trim()
  if (v && ROLS_VALIDS.has(v)) return v as Rol
  return 'convidat'
}

function parseEtapa(value: string | null | undefined): EtapaSubstitucio | null {
  const v = value?.trim()
  if (v && ETAPES_VALIDES.has(v)) return v as EtapaSubstitucio
  return null
}

interface UsuariRow {
  id: string
  email: string
  nom: string
  rol: string
  etapa: string | null
  pot_gestionar_material: boolean
  data_alta: string
}

function rowToUsuari(row: UsuariRow): Usuari {
  return {
    id: row.id,
    Email: row.email,
    Nom: row.nom,
    Rol: parseRol(row.rol),
    Etapa: parseEtapa(row.etapa),
    PotGestionarMaterial: row.pot_gestionar_material ?? false,
    Data_alta: row.data_alta,
  }
}

// ---------- Permisos ----------

export function potGestionar(rol: Rol | null): boolean {
  return rol === 'coordinador' || rol === 'direccio' || rol === 'titular' || rol === 'cap_estudis'
}

export function potEliminar(rol: Rol | null): boolean {
  return rol === 'coordinador'
}

export function potCrear(rol: Rol | null): boolean {
  return rol !== null && rol !== 'convidat'
}

export function potAprovarAbsencies(rol: Rol | null): boolean {
  return rol === 'coordinador' || rol === 'direccio' || rol === 'titular'
}

// ---------- Store ----------

interface UsuarisState {
  rol: Rol | null
  accesNegat: boolean
  usuaris: Usuari[]
  loading: boolean
  error: string | null

  loadRol: (email: string, displayName?: string | null) => Promise<void>
  loadAll: () => Promise<void>
  crear: (email: string, nom: string, rol: Rol, etapa?: EtapaSubstitucio | null, potGestionarMaterial?: boolean) => Promise<void>
  updateRol: (usuari: Usuari, nouRol: Rol) => Promise<void>
  updateEtapa: (usuari: Usuari, novaEtapa: EtapaSubstitucio | null) => Promise<void>
  updatePotGestionarMaterial: (usuari: Usuari, valor: boolean) => Promise<void>
  reset: () => void
}

export const useUsuarisStore = create<UsuarisState>((set) => ({
  rol: null,
  accesNegat: false,
  usuaris: [],
  loading: false,
  error: null,

  async loadRol(email) {
    const generation = ++sessionGeneration
    const apply = (state: Partial<UsuarisState>) => { if (generation === sessionGeneration) set(state) }
    apply({ rol: null, loading: true, error: null, accesNegat: false })
    try {
      const emailNorm = email.trim().toLowerCase()
      const { data: existing, error: selectError } = await supabase
        .from(TABLE)
        .select('*')
        .ilike('email', emailNorm)
        .maybeSingle()

      if (selectError) throw selectError

      if (existing) {
        apply({ rol: parseRol((existing as UsuariRow).rol), accesNegat: false })
        return
      }

      // Les altes i el primer administrador es provisionen explícitament.
      apply({ accesNegat: true })
    } catch (err) {
      apply({ error: err instanceof Error ? err.message : 'Error carregant rol' })
      apply({ accesNegat: true })
    } finally {
      apply({ loading: false })
    }
  },

  async loadAll() {
    const generation = sessionGeneration
    const apply = (state: Partial<UsuarisState>) => { if (generation === sessionGeneration) set(state) }
    apply({ loading: true, error: null })
    try {
      const rows = await getAll<UsuariRow>(TABLE, 'email')
      apply({ usuaris: rows.map(rowToUsuari) })
    } catch (err) {
      apply({ error: err instanceof Error ? err.message : 'Error carregant usuaris' })
    } finally {
      apply({ loading: false })
    }
  },

  async crear(email, nom, rol, etapa = null, potGestionarMaterial = false) {
    const emailNorm = email.trim().toLowerCase()
    let row: UsuariRow
    try {
      row = await insertRow<UsuariRow>(TABLE, {
        email: emailNorm, nom: nom.trim(), rol, etapa, pot_gestionar_material: potGestionarMaterial,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      if (msg.includes('duplicate key') || msg.includes('unique')) {
        throw new Error('Aquest email ja té un usuari registrat.', { cause: err })
      }
      throw err
    }
    set((s) => ({ usuaris: [...s.usuaris, rowToUsuari(row)].sort((a, b) => a.Email.localeCompare(b.Email)) }))
  },

  async updateRol(usuari, nouRol) {
    await updateRowById(TABLE, usuari.id, { rol: nouRol })
    set((s) => ({
      usuaris: s.usuaris.map((u) => (u.id === usuari.id ? { ...u, Rol: nouRol } : u)),
    }))
  },

  async updateEtapa(usuari, novaEtapa) {
    await updateRowById(TABLE, usuari.id, { etapa: novaEtapa })
    set((s) => ({
      usuaris: s.usuaris.map((u) => (u.id === usuari.id ? { ...u, Etapa: novaEtapa } : u)),
    }))
  },

  async updatePotGestionarMaterial(usuari, valor) {
    await updateRowById(TABLE, usuari.id, { pot_gestionar_material: valor })
    set((s) => ({
      usuaris: s.usuaris.map((u) => (u.id === usuari.id ? { ...u, PotGestionarMaterial: valor } : u)),
    }))
  },

  reset() {
    sessionGeneration++
    set({ rol: null, accesNegat: false, usuaris: [], loading: false, error: null })
  },
}))

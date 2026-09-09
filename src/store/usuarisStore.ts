import { create } from 'zustand'
import { supabase, getAll, insertRow, updateRowById } from '../services/db'
import type { Rol, Usuari, EtapaSubstitucio } from '../modules/usuaris/types'
import { ETAPES_USUARI, ROLS } from '../modules/usuaris/types'

const TABLE = 'usuaris'

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
  data_alta: string
}

function rowToUsuari(row: UsuariRow): Usuari {
  return {
    id: row.id,
    Email: row.email,
    Nom: row.nom,
    Rol: parseRol(row.rol),
    Etapa: parseEtapa(row.etapa),
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
  crear: (email: string, nom: string, rol: Rol, etapa?: EtapaSubstitucio | null) => Promise<void>
  updateRol: (usuari: Usuari, nouRol: Rol) => Promise<void>
  updateEtapa: (usuari: Usuari, novaEtapa: EtapaSubstitucio | null) => Promise<void>
  reset: () => void
}

export const useUsuarisStore = create<UsuarisState>((set) => ({
  rol: null,
  accesNegat: false,
  usuaris: [],
  loading: false,
  error: null,

  async loadRol(email, displayName) {
    set({ loading: true, error: null, accesNegat: false })
    try {
      const emailNorm = email.trim().toLowerCase()
      const { data: existing, error: selectError } = await supabase
        .from(TABLE)
        .select('*')
        .ilike('email', emailNorm)
        .maybeSingle()

      if (selectError) throw selectError

      if (existing) {
        set({ rol: parseRol((existing as UsuariRow).rol), accesNegat: false })
        return
      }

      // Si encara no hi ha cap usuari registrat, el primer que entra es fa coordinador
      const { count, error: countError } = await supabase
        .from(TABLE)
        .select('id', { count: 'exact', head: true })
      if (countError) throw countError

      if ((count ?? 0) === 0) {
        try {
          await insertRow(TABLE, {
            email,
            nom: displayName ?? '',
            rol: 'coordinador',
          })
          set({ rol: 'coordinador' })
        } catch {
          set({ accesNegat: true })
        }
      } else {
        set({ accesNegat: true })
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Error carregant rol' })
      set({ accesNegat: true })
    } finally {
      set({ loading: false })
    }
  },

  async loadAll() {
    set({ loading: true, error: null })
    try {
      const rows = await getAll<UsuariRow>(TABLE, 'email')
      set({ usuaris: rows.map(rowToUsuari) })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Error carregant usuaris' })
    } finally {
      set({ loading: false })
    }
  },

  async crear(email, nom, rol, etapa = null) {
    const emailNorm = email.trim().toLowerCase()
    let row: UsuariRow
    try {
      row = await insertRow<UsuariRow>(TABLE, { email: emailNorm, nom: nom.trim(), rol, etapa })
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

  reset() {
    set({ rol: null, accesNegat: false, usuaris: [], loading: false, error: null })
  },
}))

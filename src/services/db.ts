import { createClient } from '@supabase/supabase-js'
import { auth } from './firebase'

export const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY, {
  accessToken: async () => {
    await auth.authStateReady()
    return auth.currentUser ? auth.currentUser.getIdToken() : null
  },
})

export interface ReadFilters { [column: string]: string | number | boolean }

export async function getAll<T>(table: string, orderBy = 'id', filters: ReadFilters = {}, primaryKey = 'id'): Promise<T[]> {
  const identity = auth.currentUser?.uid
  if (!identity) throw new Error('Cal iniciar sessió.')
  const rows: T[] = []
  const pageSize = 500
  for (;;) {
    let query = supabase.from(table).select('*', { count: 'exact' }).match(filters).order(orderBy)
    if (orderBy !== primaryKey) query = query.order(primaryKey)
    const { data, error, count } = await query.range(rows.length, rows.length + pageSize - 1)
    if (error) throw new Error(`Error llegint ${table}: ${error.message}`)
    if (count === null) throw new Error(`No es pot verificar la lectura completa de ${table}.`)
    rows.push(...(data ?? []) as T[])
    if (auth.currentUser?.uid !== identity) throw new Error('La sessió ha canviat.')
    if (rows.length >= count) return rows
    if (!data?.length) throw new Error(`Lectura incompleta de ${table}. Torna-ho a provar.`)
  }
}

export async function insertRow<T>(table: string, data: Record<string, unknown>): Promise<T> {
  const { data: row, error } = await supabase.from(table).insert(data).select().single()
  if (error) throw new Error(`Error afegint registre a ${table}: ${error.message}`)
  return row as T
}

export async function updateRowById<T>(table: string, id: string, data: Record<string, unknown>): Promise<T> {
  const { data: row, error } = await supabase.from(table).update(data).eq('id', id).select().single()
  if (error) throw new Error(`Error actualitzant registre a ${table}: ${error.message}`)
  return row as T
}

export async function deleteRowById(table: string, id: string): Promise<void> {
  const { data, error } = await supabase.from(table).delete().eq('id', id).select('id')
  if (error) throw new Error(`Error eliminant registre de ${table}: ${error.message}`)
  if (!data?.length) throw new Error('El registre ja no existeix o no tens permís per eliminar-lo.')
}

export async function callRpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(name, args)
  if (error) throw new Error(error.message)
  return data as T
}

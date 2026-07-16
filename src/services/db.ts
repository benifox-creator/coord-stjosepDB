import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export async function getAll<T>(table: string, orderBy?: string): Promise<T[]> {
  const query = supabase.from(table).select('*')
  const { data, error } = orderBy ? await query.order(orderBy) : await query
  if (error) throw new Error(`Error llegint ${table}: ${error.message}`)
  return (data ?? []) as T[]
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
  const { error } = await supabase.from(table).delete().eq('id', id)
  if (error) throw new Error(`Error eliminant registre de ${table}: ${error.message}`)
}

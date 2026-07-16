import { useAuthStore } from '../store/authStore'

const SHEETS_ID = import.meta.env.VITE_GOOGLE_SHEETS_ID
const BASE_URL = `https://sheets.googleapis.com/v4/spreadsheets/${SHEETS_ID}`

function getToken(): string {
  const token = useAuthStore.getState().googleAccessToken
  if (!token) throw new Error('Sessió caducada. Torna a iniciar sessió.')
  return token
}

async function sheetsRequest(path: string, options?: RequestInit, retries = 3): Promise<Response> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${getToken()}`,
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })

  if (res.status === 401) {
    useAuthStore.getState().clearAuth()
    throw new Error('Sessió caducada. Torna a iniciar sessió.')
  }

  // Retry automàtic amb backoff exponencial per a rate-limiting
  if (res.status === 429) {
    if (retries > 0) {
      const delay = (4 - retries) * 1000 // 1s, 2s, 3s
      await new Promise((r) => setTimeout(r, delay))
      return sheetsRequest(path, options, retries - 1)
    }
    throw new Error('SHEETS_RATE_LIMIT: massa peticions simultànies a Google Sheets. Torna-ho a intentar en uns segons.')
  }

  return res
}

async function getRawValues(sheet: string): Promise<string[][]> {
  const res = await sheetsRequest(`/values/${encodeURIComponent(sheet)}`)
  if (res.status === 403) {
    throw new Error('Sense accés al document de dades. El coordinador TIC ha de compartir el full de càlcul amb el teu compte de Google.')
  }
  if (!res.ok) throw new Error(`Error llegint ${sheet}: ${res.status}`)
  const data = await res.json() as { values?: string[][] }
  return data.values ?? []
}

export type SheetRow = Record<string, string>

export async function getRows(sheet: string): Promise<SheetRow[]> {
  const values = await getRawValues(sheet)
  const [headers, ...rows] = values
  if (!headers) return []
  return rows.map((row) =>
    Object.fromEntries(headers.map((h, i) => [h, row[i] ?? '']))
  )
}

export async function appendRow(sheet: string, data: SheetRow): Promise<void> {
  const existing = await getRawValues(sheet)
  const hasHeaders = existing.length > 0
  const headers = hasHeaders ? existing[0] : Object.keys(data)

  // Si el sheet és buit, afegim primer la fila de capçalera
  const valuesToAppend: string[][] = []
  if (!hasHeaders) valuesToAppend.push(headers)
  valuesToAppend.push(headers.map((h) => data[h] ?? ''))

  const res = await sheetsRequest(
    `/values/${encodeURIComponent(sheet)}:append?valueInputOption=USER_ENTERED`,
    { method: 'POST', body: JSON.stringify({ values: valuesToAppend }) }
  )
  if (!res.ok) throw new Error(`Error afegint fila a ${sheet}: ${res.status}`)
}

export async function updateRow(sheet: string, rowIndex: number, data: SheetRow): Promise<void> {
  const existing = await getRawValues(sheet)
  const headers = existing.length > 0 ? existing[0] : Object.keys(data)
  const sheetRow = rowIndex + 2 // +1 capçalera, +1 per ser 1-based
  const range = `${sheet}!A${sheetRow}`
  const values = [headers.map((h) => data[h] ?? '')]

  const res = await sheetsRequest(
    `/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    { method: 'PUT', body: JSON.stringify({ values }) }
  )
  if (!res.ok) throw new Error(`Error actualitzant fila ${sheetRow} a ${sheet}: ${res.status}`)
}

// Cache d'IDs numèrics de fulls per evitar crides repetides a metadades
const sheetIdCache: Record<string, number> = {}

async function getSheetId(sheetName: string): Promise<number> {
  if (sheetIdCache[sheetName] !== undefined) return sheetIdCache[sheetName]
  const res = await sheetsRequest('?fields=sheets.properties')
  if (!res.ok) throw new Error(`Error llegint metadades del document: ${res.status}`)
  const data = await res.json() as {
    sheets: Array<{ properties: { sheetId: number; title: string } }>
  }
  for (const s of data.sheets) {
    sheetIdCache[s.properties.title] = s.properties.sheetId
  }
  if (sheetIdCache[sheetName] === undefined) {
    throw new Error(`Full "${sheetName}" no trobat al document`)
  }
  return sheetIdCache[sheetName]
}

// Elimina físicament la fila del full de càlcul (les files posteriors pugen un índex)
export async function deleteRow(sheet: string, rowIndex: number): Promise<void> {
  const sheetId = await getSheetId(sheet)
  const startIndex = rowIndex + 1 // +1 per capçalera (índex 0 = headers, 1 = primer registre)
  const res = await sheetsRequest(':batchUpdate', {
    method: 'POST',
    body: JSON.stringify({
      requests: [{
        deleteDimension: {
          range: { sheetId, dimension: 'ROWS', startIndex, endIndex: startIndex + 1 },
        },
      }],
    }),
  })
  if (!res.ok) throw new Error(`Error eliminant registre: ${res.status}`)
}

export async function writeHeaders(sheet: string, headers: string[]): Promise<void> {
  const res = await sheetsRequest(
    `/values/${encodeURIComponent(sheet + '!A1')}?valueInputOption=USER_ENTERED`,
    { method: 'PUT', body: JSON.stringify({ values: [headers] }) }
  )
  if (!res.ok) throw new Error(`Error escrivint capçaleres a ${sheet}: ${res.status}`)
}

// Crea un full nou al Spreadsheet si no existeix.
export async function createSheet(name: string): Promise<void> {
  const res = await sheetsRequest(':batchUpdate', {
    method: 'POST',
    body: JSON.stringify({
      requests: [{ addSheet: { properties: { title: name } } }],
    }),
  })
  if (!res.ok) throw new Error(`Error creant full "${name}": ${res.status}`)
}

// Fulls ja verificats aquesta sessió — evita crides API redundants
const sheetsVerificats = new Set<string>()
// Promise en curs per a cada full — evita race conditions entre crides concurrents
const sheetsEnProgres = new Map<string, Promise<void>>()

async function sheetExists(name: string): Promise<boolean> {
  const res = await sheetsRequest('?fields=sheets.properties.title')
  if (!res.ok) return false
  const data = await res.json() as { sheets: Array<{ properties: { title: string } }> }
  return data.sheets.some((s) => s.properties.title === name)
}

async function doEnsureSheetHeaders(sheet: string, headers: string[]): Promise<void> {
  const exists = await sheetExists(sheet)
  if (!exists) {
    await createSheet(sheet)
    await writeHeaders(sheet, headers)
    sheetsVerificats.add(sheet)
    return
  }
  // El full existeix — comprova si té capçaleres
  const res = await sheetsRequest(`/values/${encodeURIComponent(sheet)}`)
  if (!res.ok) throw new Error(`Error llegint ${sheet}: ${res.status}`)
  const data = await res.json() as { values?: string[][] }
  if ((data.values ?? []).length === 0) await writeHeaders(sheet, headers)
  sheetsVerificats.add(sheet)
}

// Comprova si el full existeix i té capçaleres; el crea i les escriu si cal.
// Crides concurrents per al mateix full comparteixen la mateixa Promise per evitar duplicats.
export async function ensureSheetHeaders(sheet: string, headers: string[]): Promise<void> {
  if (sheetsVerificats.has(sheet)) return
  const existing = sheetsEnProgres.get(sheet)
  if (existing) return existing
  const promise = doEnsureSheetHeaders(sheet, headers).finally(() => sheetsEnProgres.delete(sheet))
  sheetsEnProgres.set(sheet, promise)
  return promise
}

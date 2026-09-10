import type { MaterialInfantilFormData, ProveidorInfantil } from './types'
import { CATEGORIES_MATERIAL_INFANTIL, UNITATS_MATERIAL_INFANTIL, COMANDA_HABITUAL_VALORS } from './types'

export const CAPÇALERES_IMPORT_MATERIALS = [
  'Nom', 'Categoria', 'Unitat', 'Proveïdor', 'Preu unitari', 'Unitats per alumne',
  'Comanda habitual', 'Recompte manual', 'Entrades rebudes', 'Consum manual', 'Notes',
] as const

export interface FilaImportMaterial {
  fila: number
  nom: string
  valid: boolean
  error?: string
  avis?: string
  data?: MaterialInfantilFormData
}

function normalitza(s: unknown): string {
  return String(s ?? '').trim()
}

function numero(s: string): number {
  const n = Number(s.replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

export async function generarPlantillaExcel(): Promise<void> {
  const XLSX = await import('xlsx')
  const exemple = [
    'Cola de barra', 'Plàstica', 'unitat', 'Papereria local', '0.9', '1', 'Sí', '0', '0', '0', 'Ús individual freqüent',
  ]
  const worksheet = XLSX.utils.aoa_to_sheet([[...CAPÇALERES_IMPORT_MATERIALS], exemple])
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Materials')
  XLSX.writeFile(workbook, 'plantilla-materials-infantil.xlsx')
}

export async function parsejaExcelMaterials(
  file: File,
  proveidors: ProveidorInfantil[],
): Promise<FilaImportMaterial[]> {
  const XLSX = await import('xlsx')
  const dades = new Uint8Array(await file.arrayBuffer())
  const workbook = XLSX.read(dades, { type: 'array' })
  const worksheet = workbook.Sheets[workbook.SheetNames[0]]
  const files = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, blankrows: false })

  if (files.length === 0) return []

  const capçaleres = (files[0] as unknown[]).map((c) => normalitza(c).toLowerCase())
  const columna = (nom: string) => capçaleres.indexOf(nom.toLowerCase())

  const idx = {
    nom: columna('nom'),
    categoria: columna('categoria'),
    unitat: columna('unitat'),
    proveidor: columna('proveïdor'),
    preu: columna('preu unitari'),
    unitatsAlumne: columna('unitats per alumne'),
    comandaHabitual: columna('comanda habitual'),
    recompte: columna('recompte manual'),
    entrades: columna('entrades rebudes'),
    consum: columna('consum manual'),
    notes: columna('notes'),
  }

  if (idx.nom === -1 || idx.categoria === -1 || idx.unitat === -1) {
    throw new Error(
      'El full no té les columnes esperades (com a mínim calen "Nom", "Categoria" i "Unitat"). Fes servir la plantilla.',
    )
  }

  const resultats: FilaImportMaterial[] = []

  for (let i = 1; i < files.length; i++) {
    const row = files[i] as unknown[]
    const get = (colIdx: number) => (colIdx === -1 ? '' : normalitza(row[colIdx]))
    const nom = get(idx.nom)
    if (!nom) continue

    const fila = i + 1

    const categoriaRaw = get(idx.categoria)
    const categoria = CATEGORIES_MATERIAL_INFANTIL.find((c) => c.toLowerCase() === categoriaRaw.toLowerCase())
    if (!categoria) {
      resultats.push({ fila, nom, valid: false, error: `Categoria "${categoriaRaw}" no reconeguda.` })
      continue
    }

    const unitatRaw = get(idx.unitat)
    const unitat = UNITATS_MATERIAL_INFANTIL.find((u) => u.toLowerCase() === unitatRaw.toLowerCase())
    if (!unitat) {
      resultats.push({ fila, nom, valid: false, error: `Unitat "${unitatRaw}" no reconeguda.` })
      continue
    }

    const comandaHabitualRaw = get(idx.comandaHabitual) || 'Sí'
    const comandaHabitual = COMANDA_HABITUAL_VALORS.find((v) => v.toLowerCase() === comandaHabitualRaw.toLowerCase())
    if (!comandaHabitual) {
      resultats.push({
        fila, nom, valid: false,
        error: `Comanda habitual "${comandaHabitualRaw}" no reconeguda (Sí / Revisar / No).`,
      })
      continue
    }

    const proveidorNom = get(idx.proveidor)
    const proveidor = proveidorNom
      ? proveidors.find((p) => p.Nom.toLowerCase() === proveidorNom.toLowerCase())
      : undefined
    const avis = proveidorNom && !proveidor
      ? `Proveïdor "${proveidorNom}" no trobat — es deixarà sense proveïdor.`
      : undefined

    resultats.push({
      fila,
      nom,
      valid: true,
      avis,
      data: {
        Nom: nom,
        Categoria: categoria,
        Unitat: unitat,
        ProveidorId: proveidor?.id ?? null,
        PreuUnitari: numero(get(idx.preu)),
        UnitatsPerAlumne: numero(get(idx.unitatsAlumne)),
        ComandaHabitual: comandaHabitual,
        RecompteManual: numero(get(idx.recompte)),
        EntradesRebudes: numero(get(idx.entrades)),
        ConsumManual: numero(get(idx.consum)),
        Notes: get(idx.notes),
      },
    })
  }

  return resultats
}

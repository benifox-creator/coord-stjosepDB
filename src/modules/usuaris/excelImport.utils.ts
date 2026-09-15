import { ROLS, ROL_LABELS, ETAPES_USUARI } from './types'
import type { Rol, EtapaSubstitucio, Usuari } from './types'

export const CAPÇALERES_IMPORT_USUARIS = ['Correu', 'Nom', 'Rol', 'Etapa', 'Pot gestionar material'] as const

export const DOMINI_CENTRE = '@stjosep.org'

export interface DadesUsuariImportat {
  Email: string
  Nom: string
  Rol: Rol
  Etapa: EtapaSubstitucio | null
  PotGestionarMaterial: boolean
}

export interface FilaImportUsuari {
  /** Número de fila tal com es veu al full de càlcul, per poder-la buscar. */
  fila: number
  correu: string
  nom: string
  valid: boolean
  /** Cert quan la fila se salta perquè el correu ja consta a Usuaris: no és un error. */
  jaExisteix?: boolean
  error?: string
  avis?: string
  data?: DadesUsuariImportat
}

function normalitza(s: unknown): string {
  return String(s ?? '').trim()
}

const SI = ['sí', 'si', 'yes', 'x', 'true', '1']

// Compara etiquetes escrites a mà a un full de càlcul. Iguala els apòstrofs
// (Excel i Word converteixen ' en ’ tots sols, i llavors "Cap d'Estudis" no
// coincidiria amb l'etiqueta del codi) i ignora els accents, perquè qui ompli
// el full no hagi d'encertar "Direcció" amb accent.
function clau(s: string): string {
  return s.trim().toLowerCase().replace(/[’‘`´]/g, '\'').normalize('NFD').replace(/\p{Diacritic}/gu, '')
}

export async function generarPlantillaExcel(): Promise<void> {
  const XLSX = await import('xlsx')
  const exemple = ['nom.cognom@stjosep.org', 'Nom Cognom', 'Professorat', 'EP', 'No']
  const worksheet = XLSX.utils.aoa_to_sheet([[...CAPÇALERES_IMPORT_USUARIS], exemple])
  worksheet['!cols'] = [{ wch: 32 }, { wch: 28 }, { wch: 16 }, { wch: 14 }, { wch: 22 }]
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Usuaris')
  XLSX.writeFile(workbook, 'plantilla-usuaris.xlsx')
}

export async function parsejaExcelUsuaris(file: File, usuarisExistents: Usuari[]): Promise<FilaImportUsuari[]> {
  const XLSX = await import('xlsx')
  const dades = new Uint8Array(await file.arrayBuffer())
  const workbook = XLSX.read(dades, { type: 'array' })
  const worksheet = workbook.Sheets[workbook.SheetNames[0]]
  const files = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, blankrows: false })

  if (files.length === 0) return []

  const capçaleres = (files[0] as unknown[]).map((c) => normalitza(c).toLowerCase())
  const columna = (nom: string) => capçaleres.indexOf(nom.toLowerCase())
  const idx = {
    correu: columna('correu'),
    nom: columna('nom'),
    rol: columna('rol'),
    etapa: columna('etapa'),
    material: columna('pot gestionar material'),
  }

  if (idx.correu === -1 || idx.nom === -1) {
    throw new Error('El full no té les columnes esperades (com a mínim calen "Correu" i "Nom"). Fes servir la plantilla.')
  }

  // Els correus ja donats d'alta i els que van apareixent al full es comparen
  // sempre en minúscules: per al servidor «A@stjosep.org» i «a@stjosep.org»
  // són la mateixa persona, i importar-los tots dos duplicaria l'usuari.
  const jaDonatsAlta = new Set(usuarisExistents.map((u) => u.Email.toLowerCase()))
  const vistosAlFull = new Set<string>()
  const resultats: FilaImportUsuari[] = []

  for (let i = 1; i < files.length; i++) {
    const row = files[i] as unknown[]
    const get = (colIdx: number) => (colIdx === -1 ? '' : normalitza(row[colIdx]))
    const correu = get(idx.correu).toLowerCase()
    const nom = get(idx.nom)
    if (!correu && !nom) continue

    const fila = i + 1
    const base = { fila, correu, nom }

    if (!correu) {
      resultats.push({ ...base, valid: false, error: 'Falta el correu.' })
      continue
    }
    if (!nom) {
      resultats.push({ ...base, valid: false, error: 'Falta el nom.' })
      continue
    }
    if (!correu.endsWith(DOMINI_CENTRE)) {
      // Tota la identitat del sistema penja del domini: un correu de fora no
      // podria iniciar sessió mai, així que donar-lo d'alta només crearia una
      // fila morta que confondria qui miri la llista.
      resultats.push({ ...base, valid: false, error: `El correu ha de ser del domini ${DOMINI_CENTRE}.` })
      continue
    }
    if (jaDonatsAlta.has(correu)) {
      resultats.push({ ...base, valid: false, jaExisteix: true, avis: 'Aquest correu ja està donat d’alta; la fila se saltarà.' })
      continue
    }
    if (vistosAlFull.has(correu)) {
      resultats.push({ ...base, valid: false, error: 'Correu repetit al fitxer; només s’importarà la primera aparició.' })
      continue
    }

    const rolRaw = get(idx.rol)
    const rol = rolRaw
      ? ROLS.find((r) => clau(r) === clau(rolRaw) || clau(ROL_LABELS[r]) === clau(rolRaw))
      : 'professorat'
    if (!rol) {
      resultats.push({ ...base, valid: false, error: `Rol "${rolRaw}" no reconegut (${ROLS.map((r) => ROL_LABELS[r]).join(', ')}).` })
      continue
    }

    const etapaRaw = get(idx.etapa)
    const etapa = etapaRaw ? ETAPES_USUARI.find((e) => clau(e) === clau(etapaRaw)) : null
    if (etapaRaw && !etapa) {
      resultats.push({ ...base, valid: false, error: `Etapa "${etapaRaw}" no reconeguda (${ETAPES_USUARI.join(', ')}).` })
      continue
    }

    vistosAlFull.add(correu)
    resultats.push({
      ...base,
      valid: true,
      data: {
        Email: correu,
        Nom: nom,
        Rol: rol,
        Etapa: etapa ?? null,
        PotGestionarMaterial: SI.includes(get(idx.material).toLowerCase()),
      },
    })
  }

  return resultats
}

import { rowToProveidor, type ProveidorInfantilRow } from './materialInfantil.utils'
import type { SheetData, CellObject } from 'write-excel-file/browser'
import type { ComandaInfantil, MaterialInfantil, ProveidorInfantil, EtapaInfantil } from './types'

export interface LiniaComandaExport {
  comanda: ComandaInfantil
  material: MaterialInfantil | undefined
  quantitat: number
  cost: number
}

const N_COLS = 8
const COST_FORMAT = '#,##0.00" €"'
const MARRO = '#861414'
const MARRO_SUAU = '#F5E4E1'
const VORA = '#E4DED3'

function buida(n: number): null[] {
  return Array(n).fill(null)
}

function capçalera(text: string): CellObject {
  return {
    value: text,
    fontWeight: 'bold',
    backgroundColor: MARRO_SUAU,
    textColor: MARRO,
    borderColor: VORA,
    borderStyle: 'thin',
    align: 'left',
    height: 20,
  }
}

export async function generarPedidoExcel(
  linies: LiniaComandaExport[],
  proveidors: ProveidorInfantil[],
  cursEscolar: string,
  etapa: EtapaInfantil,
): Promise<void> {
  const writeExcelFile = (await import('write-excel-file/browser')).default

  const grups = new Map<string, { proveidor: ProveidorInfantil | undefined; linies: typeof linies }>()
  for (const linia of linies) {
    const snap = linia.comanda.Fotografia?.proveidor
    const proveidor = linia.comanda.Fotografia
      ? (snap ? rowToProveidor(snap as unknown as ProveidorInfantilRow) : undefined)
      : proveidors.find((p) => p.id === linia.material?.ProveidorId)
    const clau = proveidor?.id ?? '_sense'
    if (!grups.has(clau)) grups.set(clau, { proveidor, linies: [] })
    grups.get(clau)!.linies.push(linia)
  }
  const grupsOrdenats = [...grups.values()].sort((a, b) =>
    (a.proveidor?.Nom ?? 'Sense proveïdor').localeCompare(b.proveidor?.Nom ?? 'Sense proveïdor'),
  )

  const files: SheetData = []

  files.push([
    {
      value: `Comanda de material — Etapa ${etapa} · Curs ${cursEscolar}`,
      fontWeight: 'bold',
      fontSize: 14,
      textColor: '#FFFFFF',
      backgroundColor: MARRO,
      align: 'left',
      height: 26,
      columnSpan: N_COLS,
    },
    ...buida(N_COLS - 1),
  ])

  files.push([
    capçalera('Material'), capçalera('Categoria'), capçalera('A demanar'), capçalera('Unitat'),
    capçalera('Preu unitari'), capçalera('Cost'), capçalera('Estat'), capçalera('Notes'),
  ])

  let totalGeneral = 0

  for (const { proveidor, linies: liniesGrup } of grupsOrdenats) {
    const nomProveidor = proveidor?.Nom ?? 'Sense proveïdor'
    const etiqueta = proveidor?.Email ? `${nomProveidor} — ${proveidor.Email}` : nomProveidor

    files.push([
      { value: etiqueta, fontWeight: 'bold', textColor: MARRO, backgroundColor: MARRO_SUAU, height: 18, columnSpan: N_COLS },
      ...buida(N_COLS - 1),
    ])

    let subtotal = 0
    for (const l of liniesGrup.sort((a, b) => (a.material?.Nom ?? '').localeCompare(b.material?.Nom ?? ''))) {
      subtotal += l.cost
      files.push([
        { value: l.material?.Nom ?? '(material eliminat)', borderColor: VORA, borderStyle: 'thin' },
        { value: l.material?.Categoria ?? '', borderColor: VORA, borderStyle: 'thin' },
        {
          value: l.quantitat, type: Number, align: 'right', fontWeight: 'bold', borderColor: VORA, borderStyle: 'thin',
        },
        { value: l.material?.Unitat ?? '', align: 'center', borderColor: VORA, borderStyle: 'thin' },
        {
          value: l.material?.PreuUnitari ?? 0, type: Number, format: COST_FORMAT, align: 'right',
          borderColor: VORA, borderStyle: 'thin',
        },
        { value: l.cost, type: Number, format: COST_FORMAT, align: 'right', borderColor: VORA, borderStyle: 'thin' },
        { value: l.comanda.Estat, borderColor: VORA, borderStyle: 'thin' },
        { value: l.comanda.Notes, borderColor: VORA, borderStyle: 'thin' },
      ])
    }

    files.push([
      { value: 'Subtotal', align: 'right', fontWeight: 'bold', columnSpan: 5 },
      ...buida(4),
      { value: subtotal, type: Number, format: COST_FORMAT, align: 'right', fontWeight: 'bold', topBorderStyle: 'thin' },
      null,
      null,
    ])

    totalGeneral += subtotal
  }

  files.push([
    {
      value: 'TOTAL', align: 'right', fontWeight: 'bold', textColor: '#FFFFFF', backgroundColor: MARRO,
      height: 20, columnSpan: 5,
    },
    ...buida(4),
    {
      value: totalGeneral, type: Number, format: COST_FORMAT, align: 'right', fontWeight: 'bold',
      textColor: '#FFFFFF', backgroundColor: MARRO,
    },
    { value: '', backgroundColor: MARRO },
    { value: '', backgroundColor: MARRO },
  ])

  await writeExcelFile(files, {
    sheet: 'Comanda',
    stickyRowsCount: 2,
    columns: [
      { width: 28 }, { width: 16 }, { width: 11 }, { width: 10 }, { width: 13 }, { width: 13 }, { width: 14 }, { width: 24 },
    ],
  }).toFile(`comanda-${etapa}-${cursEscolar}.xlsx`)
}

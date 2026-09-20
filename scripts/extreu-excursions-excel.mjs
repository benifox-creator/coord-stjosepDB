// scripts/extreu-excursions-excel.mjs
// Extreu les excursions reals del curs 2022-23 de l'Excel del centre cap al
// fixture de proves. L'Excel no és al repositori (conté dades del centre);
// es passa per paràmetre.
//
// Ús: node scripts/extreu-excursions-excel.mjs "<ruta a Excursió Curs.xlsm>"
import * as XLSX from 'xlsx'
import { readFileSync, writeFileSync } from 'node:fs'

const origen = process.argv[2]
if (!origen) { console.error('Cal la ruta de l\'Excel'); process.exit(1) }

const buf = readFileSync(origen)
const wb = XLSX.read(buf, { type: 'buffer' })
const files = XLSX.utils.sheet_to_json(wb.Sheets['Final'], { header: 1, raw: true })

// "75+5" vol dir 75 alumnes i 5 acompanyants. De vegades només hi ha el primer.
function parteix(text) {
  const trossos = String(text ?? '').split('+').map(t => Number(t.trim()))
  return { alumnes: trossos[0] || 0, acompanyants: trossos[1] || 0 }
}

const excursions = []
for (const f of files) {
  if (typeof f[0] !== 'number' || !f[2]) continue   // files de títol i buides
  const { alumnes, acompanyants } = parteix(f[5])
  const preuExcel = Number(f[11])
  // Files amb dades mal registrades: sense alumnes o sense preu calculat no
  // es pot comprovar res. La spec ja comptava que n'hi hauria.
  if (!alumnes || !Number.isFinite(preuExcel) || preuExcel <= 0) continue
  excursions.push({
    lloc: String(f[2]),
    curs: String(f[4] ?? ''),
    alumnes,
    acompanyants,
    autocars: Number(f[9]) > 0 ? [Number(f[9])] : [],
    preuActivitat: Number(f[10]) || 0,
    previsio: Number(f[19]) || 0.75,
    ampaPerAlumne: Number(f[20]) || 0,
    preuExcel,
  })
}

writeFileSync('tests/fixtures/excursions-excel.json', JSON.stringify(excursions, null, 2) + '\n')
console.log(`${excursions.length} excursions desades`)

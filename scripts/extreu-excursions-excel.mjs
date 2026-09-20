// scripts/extreu-excursions-excel.mjs
// Extreu les excursions reals del curs 2022-23 de l'Excel del centre cap al
// fixture de proves. L'Excel no és al repositori (conté dades del centre);
// es passa per paràmetre.
//
// Cal creuar dos fulls perquè el full 'Final' només dona el preu final, sense
// dir si l'import de l'activitat és per alumne o total del grup, ni quant hi
// posa l'AMPA (el que semblava l'AMPA a la columna 20 de 'Final' no ho és:
// no té capçalera i és un altre càlcul intern del full). La informació bona
// és al full 'Preu Activitat': la columna 'Ampa', i el fet que la columna
// 'Preu' i la columna 'Preu + IVA' coincideixin o no diu si l'import és total
// (coincideixen) o per alumne (Preu + IVA = Preu × alumnes).
//
// Ús: node scripts/extreu-excursions-excel.mjs "<ruta a Excursió Curs.xlsm>"
import * as XLSX from 'xlsx'
import { readFileSync, writeFileSync } from 'node:fs'

const origen = process.argv[2]
if (!origen) { console.error('Cal la ruta de l\'Excel'); process.exit(1) }

const buf = readFileSync(origen)
const wb = XLSX.read(buf, { type: 'buffer' })

// Mateix criteri de filtratge de files (títols i buides fora) als dos fulls,
// perquè després es puguin aparellar per posició.
const esFilaDeDades = (f) => typeof f[0] === 'number' && !!f[2]

const finalRows = XLSX.utils.sheet_to_json(wb.Sheets['Final'], { header: 1, raw: true }).filter(esFilaDeDades)
const preuActivitatRows = XLSX.utils.sheet_to_json(wb.Sheets['Preu Activitat'], { header: 1, raw: true }).filter(esFilaDeDades)

// Els dos fulls haurien de portar les mateixes excursions, en el mateix
// ordre. Si mai deixessin de coincidir, val més petar aquí que barrejar
// l'AMPA d'una excursió amb el preu d'una altra sense adonar-se'n.
if (finalRows.length !== preuActivitatRows.length) {
  console.error(
    `Els fulls 'Final' (${finalRows.length} files) i 'Preu Activitat' (${preuActivitatRows.length} files) ` +
    `no tenen el mateix nombre de files. No es pot assumir que estan alineats.`,
  )
  process.exit(1)
}
// Només `lloc` no basta: "Can Montcau", "Casa Colònies" i "Museu de les
// matemàtiques Can Mercader" hi apareixen repetits (cursos diferents, el
// mateix lloc). Si es comparés només `lloc`, dues files reordenades amb el
// mateix nom passarien per alineades i s'aparellaria l'activitat d'una
// excursió amb el preu d'una altra sense cap error. `curs` desfà l'empat.
for (let i = 0; i < finalRows.length; i++) {
  const llocFinal = String(finalRows[i][2])
  const cursFinal = String(finalRows[i][4] ?? '')
  const llocPreuActivitat = String(preuActivitatRows[i][2])
  const cursPreuActivitat = String(preuActivitatRows[i][4] ?? '')
  if (llocFinal !== llocPreuActivitat || cursFinal !== cursPreuActivitat) {
    console.error(
      `Desalineació a la fila ${i}: 'Final' diu "${llocFinal}" (${cursFinal}) i 'Preu Activitat' diu ` +
      `"${llocPreuActivitat}" (${cursPreuActivitat}). S'atura abans d'extreure dades incorrectes.`,
    )
    process.exit(1)
  }
}

// "75+5" vol dir 75 alumnes i 5 acompanyants. De vegades només hi ha el primer.
function parteix(text) {
  const trossos = String(text ?? '').split('+').map(t => Number(t.trim()))
  return { alumnes: trossos[0] || 0, acompanyants: trossos[1] || 0 }
}

const excursions = []
for (let i = 0; i < finalRows.length; i++) {
  const f = finalRows[i]
  const p = preuActivitatRows[i]
  const { alumnes, acompanyants } = parteix(f[5])
  const preuExcel = Number(f[11])
  // Files amb dades mal registrades: sense alumnes o sense preu calculat no
  // es pot comprovar res. La spec ja comptava que n'hi hauria.
  if (!alumnes || !Number.isFinite(preuExcel) || preuExcel <= 0) continue

  const preu = Number(p[10]) || 0
  const preuAmbIva = Number(p[12]) || 0
  // Si 'Preu' i 'Preu + IVA' són el mateix número, és perquè cap dels dos
  // s'ha multiplicat pels alumnes: l'import és del grup sencer. Si no,
  // 'Preu + IVA' = 'Preu' × alumnes, és a dir, l'import és per alumne.
  //
  // Amb preu 0 aquesta comparació sempre dona igualtat (0 == 0 × alumnes)
  // sense que vulgui dir res: no hi ha manera de saber, només amb aquestes
  // dues columnes, si una activitat gratuïta "era" per alumne o total. Es
  // desempata cap a 'per_alumne' a posta i no perquè s'hagi comprovat cap
  // fila real amb aquest cas (a hores d'ara, quan preu val 0 sempre hi val 0
  // també l'AMPA d'aquell full): amb preu 0 el cost que en resulta és el
  // mateix (0) es reparteixi com es reparteixi, i com que 'per_alumne' és la
  // interpretació que ja triaria aquesta mateixa regla en qualsevol altre
  // cas on 'Preu + IVA' no fos exactament 0 × alumnes, mantenir-la aquí és
  // la tria que menys sorprèn qui llegeixi el codi.
  const preuActivitatTipus = preu === 0 ? 'per_alumne' : Math.abs(preu - preuAmbIva) < 1e-9 ? 'total' : 'per_alumne'

  excursions.push({
    lloc: String(f[2]),
    curs: String(f[4] ?? ''),
    alumnes,
    acompanyants,
    autocars: Number(f[9]) > 0 ? [Number(f[9])] : [],
    preuActivitat: Number(f[10]) || 0,
    preuActivitatTipus,
    previsio: Number(f[19]) || 0.75,
    ampaExcel: Number(p[9]) || 0,
    // Quirk del full de càlcul, no de com ha de funcionar el sistema nou:
    // quan l'activitat és per alumne, el full 'Preu Activitat' ja resta
    // l'AMPA abans que el número arribi a 'Final' (columna "Preu-Ampa").
    // Quan és total del grup, no la resta enlloc.
    ampaJaInclosaAlPreu: preuActivitatTipus === 'per_alumne',
    preuExcel,
  })
}

writeFileSync('tests/fixtures/excursions-excel.json', JSON.stringify(excursions, null, 2) + '\n')
console.log(`${excursions.length} excursions desades`)

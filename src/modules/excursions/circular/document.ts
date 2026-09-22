// Genera el .docx de la circular d'excursió.
//
// Port directe del prototip aprovat (`Circular excursió - generador.js`,
// disseny validat el 2026-09-17): colors, mides, marges i estructura de
// taules es copien tal qual. Els únics canvis respecte del prototip són
// tècnics — CommonJS → ESM, el logo llegit de disc → `logoBytes()`, i
// l'objecte `d` d'exemple → el paràmetre `d: DadesCircular` amb els textos
// que ara vénen de `d.textos` en comptes d'estar escrits aquí dins.
import {
  Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell,
  Header, Footer, WidthType, ShadingType, BorderStyle, AlignmentType,
  VerticalAlign, LevelFormat, TableLayoutType,
  type IBorderOptions, type ITableBordersOptions, type IRunOptions,
} from 'docx'
import { logoBytes } from './logo'
import type { DadesCircular } from './dades'

// ── Identitat (colors del logo, que són els de l'app) ─────────────────
const GRANATE = '861414'
const TARONJA = 'FF9C02'
const TARONJA_FOSC = 'A86400'   // per a text sobre fons clar: el taronja pur no té contrast
const FONS_AVIS = 'FFF4E0'
const FONS_FITXA = 'F5F3F1'
const TEXT = '222222'
const GRIS = '5F5F5F'
const GRIS_CLAR = '8C8C8C'
const LINIA = 'E4E0DC'
const FONT = 'Calibri'

// ── Mides (A4, marges de 2 cm) ────────────────────────────────────────
const AMPLE = 11906 - 2 * 1134   // 9638 DXA útils

const cap: IBorderOptions = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
const senseVores: ITableBordersOptions = {
  top: cap, bottom: cap, left: cap, right: cap, insideHorizontal: cap, insideVertical: cap,
}

const t = (text: string, o: Partial<IRunOptions> = {}) =>
  new TextRun({ text, font: FONT, color: TEXT, size: 21, ...o })

/**
 * Construeix el document Word de la circular. Pur: no llegeix de disc ni
 * escriu enlloc — qui el crida decideix què fer amb el `Document` resultant
 * (empaquetar-lo amb `Packer`, per exemple `circularBlob` més avall).
 */
export function circularDocx(d: DadesCircular): Document {
  // ── Capçalera: logo a l'esquerra, identificació del document a la dreta ─
  const header = new Header({
    children: [
      new Table({
        width: { size: AMPLE, type: WidthType.DXA },
        columnWidths: [4200, AMPLE - 4200],
        layout: TableLayoutType.FIXED,
        borders: senseVores,
        rows: [new TableRow({
          children: [
            new TableCell({
              width: { size: 4200, type: WidthType.DXA },
              borders: senseVores,
              verticalAlign: VerticalAlign.CENTER,
              children: [new Paragraph({
                children: [new ImageRun({ type: 'jpg', data: logoBytes(), transformation: { width: 150, height: 85 } })],
              })],
            }),
            new TableCell({
              width: { size: AMPLE - 4200, type: WidthType.DXA },
              borders: senseVores,
              verticalAlign: VerticalAlign.CENTER,
              children: [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [t("COMUNICAT D'EXCURSIÓ", { bold: true, color: GRANATE, size: 17, characterSpacing: 30 })],
                }),
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [t(`Curs ${d.cursEscolar}`, { color: GRIS_CLAR, size: 17 })],
                }),
              ],
            }),
          ],
        })],
      }),
      // Filet de color sota la capçalera (paràgraf amb vora, no una taula)
      new Paragraph({
        spacing: { before: 60, after: 0 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: GRANATE, space: 1 } },
        children: [],
      }),
    ],
  })

  // ── Peu: dades del centre ─────────────────────────────────────────────
  const footer = new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 40 },
        border: { top: { style: BorderStyle.SINGLE, size: 4, color: LINIA, space: 6 } },
        children: [t('Col·legi Sant Josep Obrer · Serventes del Sagrat Cor de Jesús · Centre concertat per la Generalitat de Catalunya', { color: GRIS_CLAR, size: 15 })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [t("Covadonga, 2 · 08906 L'Hospitalet (Barcelona) · 93 438 17 45 · www.stjosep.org · secretaria@stjosep.org", { color: GRIS_CLAR, size: 15 })],
      }),
    ],
  })

  // ── Fitxa de dades clau: graella 3×2 de targetes ──────────────────────
  const COL = Math.floor(AMPLE / 3)
  const COLS = [COL, COL, AMPLE - 2 * COL]
  // Vores blanques gruixudes sobre cel·les amb fons: fan de separació entre targetes.
  const vora: IBorderOptions = { style: BorderStyle.SINGLE, size: 36, color: 'FFFFFF' }
  const voresTargeta = { top: vora, bottom: vora, left: vora, right: vora }

  function targeta(
    etiqueta: string, valor: string,
    { destacat = false, detall = null }: { destacat?: boolean, detall?: string | null } = {},
    amplada: number,
  ): TableCell {
    const fills = [
      new Paragraph({
        spacing: { after: 40 },
        children: [t(etiqueta, { bold: true, color: GRIS_CLAR, size: 15, characterSpacing: 20 })],
      }),
      new Paragraph({
        children: [t(valor, destacat
          ? { bold: true, color: GRANATE, size: 36 }
          : { bold: true, color: TEXT, size: 23 })],
      }),
    ]
    if (detall) fills.push(new Paragraph({ children: [t(detall, { color: GRIS, size: 18 })] }))
    return new TableCell({
      width: { size: amplada, type: WidthType.DXA },
      shading: { type: ShadingType.CLEAR, fill: destacat ? 'FBEFEF' : FONS_FITXA, color: 'auto' },
      borders: voresTargeta,
      margins: { top: 140, bottom: 140, left: 200, right: 160 },
      verticalAlign: VerticalAlign.TOP,
      children: fills,
    })
  }

  const fitxa = new Table({
    width: { size: AMPLE, type: WidthType.DXA },
    columnWidths: COLS,
    layout: TableLayoutType.FIXED,
    borders: senseVores,
    rows: [
      new TableRow({ children: [
        targeta('DIA', d.dia, {}, COLS[0]),
        targeta('SORTIDA', d.sortida, {}, COLS[1]),
        targeta('TORNADA', d.tornada, {}, COLS[2]),
      ] }),
      new TableRow({ children: [
        targeta('LLOC', d.lloc, { detall: d.poblacio }, COLS[0]),
        targeta('ACTIVITAT', d.activitat, {}, COLS[1]),
        targeta('PREU PER ALUMNE', d.preu, { destacat: true }, COLS[2]),
      ] }),
    ],
  })

  // ── Requadre de la data límit: l'únic que la família no pot passar per alt
  const avis = new Table({
    width: { size: AMPLE, type: WidthType.DXA },
    columnWidths: [AMPLE],
    layout: TableLayoutType.FIXED,
    borders: senseVores,
    rows: [new TableRow({ children: [new TableCell({
      width: { size: AMPLE, type: WidthType.DXA },
      shading: { type: ShadingType.CLEAR, fill: FONS_AVIS, color: 'auto' },
      borders: {
        top: cap, bottom: cap, right: cap,
        left: { style: BorderStyle.SINGLE, size: 36, color: TARONJA },
      },
      margins: { top: 160, bottom: 160, left: 280, right: 240 },
      children: [
        new Paragraph({ spacing: { after: 20 }, children: [t('DATA LÍMIT DE PAGAMENT', { bold: true, color: TARONJA_FOSC, size: 16, characterSpacing: 20 })] }),
        new Paragraph({ spacing: { after: 80 }, children: [t(d.limitPagament, { bold: true, size: 34 })] }),
        new Paragraph({ children: [t(d.textos.devolucions, { color: GRIS, size: 18 })] }),
      ],
    })] })],
  })

  const titolSeccio = (text: string) => new Paragraph({
    spacing: { before: 300, after: 100 },
    children: [t(text, { bold: true, color: GRANATE, size: 25 })],
  })

  const cos = [
    new Paragraph({ spacing: { before: 120, after: 40 }, children: [t('EXCURSIÓ', { bold: true, color: GRANATE, size: 17, characterSpacing: 40 })] }),
    new Paragraph({ spacing: { after: 40 }, children: [t('Alumnes de ', { bold: true, size: 48 }), t(d.curs, { bold: true, size: 48, color: GRANATE })] }),
    new Paragraph({ spacing: { after: 220 }, children: [t(`${d.activitat} · ${d.lloc}`, { color: GRIS, size: 25 })] }),

    fitxa,

    // Línia de l'AMPA: només surt quan l'AMPA hi col·labora
    ...(d.ampa ? [new Paragraph({
      spacing: { before: 160, after: 200 },
      // Word dibuixa la vora a l'esquerra del sagnat (sagnat − espai − gruix):
      // amb 220 DXA la barra cau al marge, alineada amb la del requadre del termini.
      indent: { left: 220 },
      border: { left: { style: BorderStyle.SINGLE, size: 18, color: GRANATE, space: 8 } },
      children: [t(d.textos.ampa, { color: GRIS, size: 20, italics: true })],
    })] : [new Paragraph({ spacing: { after: 200 }, children: [] })]),

    avis,

    titolSeccio('Com fer el pagament'),
    new Paragraph({
      spacing: { after: 120 },
      children: [t(d.textos.pagamentIntro)],
    }),
    ...d.textos.passosPagament.map((p) => new Paragraph({
      numbering: { reference: 'passos', level: 0 },
      spacing: { after: 50 },
      children: [t(p, { size: 20 })],
    })),
    new Paragraph({
      spacing: { before: 100 },
      children: [t("Per a qualsevol dubte poden demanar ajuda als empleats de l'oficina.", { color: GRIS, size: 18, italics: true })],
    }),

    titolSeccio('Lliurament del resguard'),
    new Paragraph({
      children: [
        t(d.textos.resguard + ' '),
        t(d.limitResguard, { bold: true }),
        t('.'),
      ],
    }),

    // Nota lliure d'aquesta excursió concreta: no la té el prototip, perquè
    // al prototip no hi havia excursions reals amb particularitats a avisar.
    ...(d.nota ? [new Paragraph({
      spacing: { before: 200 },
      children: [t(d.nota, { color: GRIS, italics: true })],
    })] : []),

    new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { before: 360 },
      children: [t(`L'Hospitalet, ${d.dataCircular}`, { color: GRIS })],
    }),
  ]

  return new Document({
    creator: 'SJO Hub',
    title: `Excursió ${d.curs} — ${d.lloc}`,
    styles: { default: { document: { run: { font: FONT, size: 21, color: TEXT } } } },
    numbering: {
      config: [{
        reference: 'passos',
        levels: [{
          level: 0,
          format: LevelFormat.DECIMAL,
          text: '%1.',
          alignment: AlignmentType.LEFT,
          style: {
            run: { bold: true, color: GRANATE, font: FONT },
            paragraph: { indent: { left: 440, hanging: 300 } },
          },
        }],
      }],
    },
    sections: [{
      properties: {
        page: { margin: { top: 1800, bottom: 1300, left: 1134, right: 1134, header: 560, footer: 480 } },
      },
      headers: { default: header },
      footers: { default: footer },
      children: cos,
    }],
  })
}

/** El mateix document, ja empaquetat com a `.docx` a punt de descarregar. */
export async function circularBlob(d: DadesCircular): Promise<Blob> {
  return Packer.toBlob(circularDocx(d))
}

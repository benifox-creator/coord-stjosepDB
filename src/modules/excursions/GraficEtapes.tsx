import { useState } from 'react'
import { esNegatiu, perEtapa, type BalancSortida, type MesuraEtapa } from './balanc'

const MESURES: { clau: MesuraEtapa; etiqueta: string; ajuda: string }[] = [
  { clau: 'total', etiqueta: 'Total gastat', ajuda: 'On van els diners. La més alta sol ser la que té més alumnes, no la més cara.' },
  { clau: 'per_alumne', etiqueta: 'Per alumne', ajuda: 'El que costa portar-hi un alumne. És l’única xifra comparable entre etapes.' },
  { clau: 'coixi', etiqueta: 'Coixí', ajuda: 'Quina etapa es queda curta.' },
]

const eur = (n: number) => n.toLocaleString('ca-ES', { style: 'currency', currency: 'EUR' })

export function GraficEtapes({ fetes }: { fetes: BalancSortida[] }) {
  const [mesura, setMesura] = useState<MesuraEtapa>('total')
  const files = perEtapa(fetes, mesura)

  // Amb una sola barra no es compara res, i amb cap no hi ha gràfic possible.
  if (files.length < 2) return null

  // L'escala es fa amb el valor absolut més gran perquè el coixí pot ser
  // negatiu i una barra negativa ha de poder créixer cap avall.
  const sostre = Math.max(...files.map((f) => Math.abs(f.valor))) || 1
  const ajuda = MESURES.find((m) => m.clau === mesura)?.ajuda ?? ''

  return (
    <section className="mb-6">
      <div className="inline-flex bg-gray-100 rounded-xl p-0.5 gap-0.5 mb-1" role="tablist">
        {MESURES.map((m) => (
          <button
            key={m.clau}
            role="tab"
            aria-selected={mesura === m.clau}
            onClick={() => setMesura(m.clau)}
            className={`text-xs px-3 py-1 rounded-lg ${
              mesura === m.clau ? 'bg-white text-text-main font-medium shadow-sm' : 'text-gray-500'
            }`}
          >
            {m.etiqueta}
          </button>
        ))}
      </div>
      <p className="text-xs text-gray-500 mb-3">{ajuda}</p>

      <div className="flex items-end gap-4 h-28">
        {files.map((f) => (
          <div key={f.etapa} className="flex-1 flex flex-col justify-end items-center gap-1">
            <span className={`text-xs font-semibold ${
              mesura === 'coixi' ? (esNegatiu(f.valor) ? 'text-red-700' : 'text-emerald-700') : 'text-text-main'
            }`}>{eur(f.valor)}</span>
            <div
              className={`w-full rounded-t-md ${
                mesura === 'coixi' && esNegatiu(f.valor) ? 'bg-red-300' : 'bg-indigo-300'
              }`}
              style={{ height: `${Math.max(4, (Math.abs(f.valor) / sostre) * 80)}px` }}
            />
            <span className="text-[11px] text-gray-500">{f.etapa}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

type Variant = 'estat' | 'prioritat' | 'inventari-estat' | 'garantia' | 'prestec-estat'

interface Props {
  label: string
  variant: Variant
}

const COLOR_MAP: Record<Variant, Record<string, string>> = {
  'estat': {
    'Oberta':   'bg-green-100 text-green-700',
    'En curs':  'bg-yellow-100 text-yellow-700',
    'Tancada':  'bg-red-100 text-red-700',
  },
  'prioritat': {
    'Alta':    'bg-red-100 text-red-800',
    'Mitjana': 'bg-amber-100 text-amber-800',
    'Baixa':   'bg-blue-100 text-blue-700',
  },
  'inventari-estat': {
    'Actiu':        'bg-green-100 text-green-700',
    'En reparació': 'bg-yellow-100 text-yellow-700',
    'En préstec':   'bg-blue-100 text-blue-700',
    'De baixa':     'bg-red-100 text-red-700',
  },
  'garantia': {
    'vigent':     'bg-green-100 text-green-700',
    'caducada':   'bg-red-100 text-red-700',
    'desconegut': 'bg-gray-100 text-gray-500',
  },
  'prestec-estat': {
    'Actiu':    'bg-blue-100 text-blue-700',
    'Retornat': 'bg-green-100 text-green-700',
    'Vençut':   'bg-red-100 text-red-700',
  },
}

export function Badge({ label, variant }: Props) {
  const cls = COLOR_MAP[variant][label] ?? 'bg-gray-100 text-gray-500'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${cls}`}>
      {label}
    </span>
  )
}

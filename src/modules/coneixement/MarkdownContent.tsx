// src/modules/coneixement/MarkdownContent.tsx
//
// Pinta l'arbre que produeix `markdown.ts`. Capa prima i sense decisions:
// si sembla que en cal una, és que ha de tornar a `markdown.ts`, que és on
// es pot provar sense muntar cap component.
import type { NodeBloc, NodeInline } from './markdown'
import { analitzaMarkdown } from './markdown'

function pintaInline(nodes: NodeInline[]): React.ReactNode {
  return nodes.map((node, i) => {
    switch (node.tipus) {
      case 'text':
        return node.valor
      case 'negreta':
        return <strong key={i}>{pintaInline(node.fills)}</strong>
      case 'cursiva':
        return <em key={i}>{pintaInline(node.fills)}</em>
      case 'codi':
        return (
          <code key={i} className="px-1 py-0.5 bg-gray-100 rounded text-[13px] font-mono">
            {node.valor}
          </code>
        )
      case 'enllac':
        return (
          <a
            key={i}
            href={node.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2 hover:no-underline"
          >
            {pintaInline(node.text)}
          </a>
        )
    }
  })
}

function pintaBloc(bloc: NodeBloc, i: number): React.ReactNode {
  switch (bloc.tipus) {
    case 'titol':
      return bloc.nivell === 2 ? (
        <h2 key={i} className="text-base font-semibold text-text-main mt-1">
          {pintaInline(bloc.contingut)}
        </h2>
      ) : (
        <h3 key={i} className="text-sm font-semibold text-text-main mt-1">
          {pintaInline(bloc.contingut)}
        </h3>
      )
    case 'paragraf':
      return (
        <p key={i} className="text-sm text-gray-700 leading-relaxed">
          {pintaInline(bloc.contingut)}
        </p>
      )
    case 'llista': {
      const Etiqueta = bloc.ordenada ? 'ol' : 'ul'
      return (
        <Etiqueta key={i} className={`text-sm text-gray-700 leading-relaxed pl-5 space-y-1 ${bloc.ordenada ? 'list-decimal' : 'list-disc'}`}>
          {bloc.items.map((item, j) => <li key={j}>{pintaInline(item)}</li>)}
        </Etiqueta>
      )
    }
    case 'cita':
      return (
        <blockquote key={i} className="border-l-2 border-gray-300 pl-3 text-sm text-gray-500 italic">
          {pintaInline(bloc.contingut)}
        </blockquote>
      )
    case 'imatge':
      return (
        <img
          key={i}
          src={bloc.url}
          alt={bloc.alt}
          className="rounded-lg border border-gray-200 max-w-full"
        />
      )
  }
}

export function MarkdownContent({ text }: { text: string }) {
  const blocs = analitzaMarkdown(text)
  if (blocs.length === 0) {
    return <p className="text-sm text-gray-500 italic">Sense contingut.</p>
  }
  return <div className="space-y-3">{blocs.map(pintaBloc)}</div>
}

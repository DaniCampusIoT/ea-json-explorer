/**
 * MarkdownView — renderiza Markdown enriquecido (GFM: tablas, listas, código).
 * No depende de Tailwind ni de ningún framework CSS externo.
 * Los estilos se aplican mediante clases .md-body definidas en index.css.
 */
import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export default function MarkdownView({ children, className = '' }) {
  if (!children) return null
  return (
    <div className={`md-body ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {children}
      </ReactMarkdown>
    </div>
  )
}

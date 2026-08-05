/**
 * Utilidades de exportación: Markdown y PDF (via print).
 */

/**
 * Descarga el contenido como archivo .md
 */
export function exportMarkdown(filename, content) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename.endsWith('.md') ? filename : `${filename}.md`
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Abre una ventana de impresión/PDF con el contenido renderizado.
 * No requiere librerías externas.
 */
export function exportPDF(title, htmlContent) {
  const win = window.open('', '_blank')
  win.document.write(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8" />
      <title>${title}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        body   { font-family: 'Inter', sans-serif; max-width: 820px; margin: 2rem auto; color: #1a1a1a; line-height: 1.7; padding: 0 1.5rem; }
        h1     { font-size: 1.5rem; margin-bottom: 0.25rem; }
        h2     { font-size: 1.1rem; color: #01696f; border-bottom: 1.5px solid #d0eaeb; padding-bottom: 0.25rem; margin-top: 1.5rem; }
        h3     { font-size: 0.95rem; margin-top: 1rem; }
        p      { margin-bottom: 0.65rem; font-size: 0.9rem; }
        code   { background: #f0f9fa; color: #01696f; padding: 0.1em 0.4em; border-radius: 0.25rem; font-size: 0.85em; }
        pre    { background: #f5f5f0; padding: 0.75rem 1rem; border-radius: 0.5rem; overflow-x: auto; }
        ul,ol  { padding-left: 1.25rem; margin-bottom: 0.65rem; font-size: 0.9rem; }
        table  { width: 100%; border-collapse: collapse; margin-bottom: 1rem; font-size: 0.85rem; }
        th     { background: #e8f5f5; color: #01696f; text-align: left; padding: 0.45rem 0.75rem; border-bottom: 2px solid #b2d8da; }
        td     { padding: 0.4rem 0.75rem; border-bottom: 1px solid #e0e0da; }
        .meta  { font-size: 0.8rem; color: #888; margin-bottom: 1.5rem; }
        @media print { body { margin: 0; } }
      </style>
    </head>
    <body>
      <h1>${title}</h1>
      <p class="meta">Generado por Arcana — ${new Date().toLocaleString('es-ES')}</p>
      <hr />
      ${htmlContent}
    </body>
    </html>
  `)
  win.document.close()
  setTimeout(() => win.print(), 400)
}

/**
 * Construye el Markdown de un resumen de bloque.
 */
export function buildBlockMarkdown({ block, summary, ports, parentName }) {
  const lines = []
  lines.push(`# ${block.name}`)
  lines.push('')
  if (parentName) lines.push(`**Paquete:** ${parentName}  `)
  if (block.stereotype) lines.push(`**Estereotipo:** ${block.stereotype}  `)
  if (ports?.length) lines.push(`**Puertos:** ${ports.map(p => p.name).join(', ')}  `)
  lines.push('')
  if (block.documentation) {
    lines.push('## Documentación')
    lines.push('')
    lines.push(block.documentation)
    lines.push('')
  }
  if (summary?.summary) {
    lines.push('## Resumen IA')
    lines.push('')
    lines.push(summary.summary)
    lines.push('')
  }
  lines.push('---')
  lines.push(`*Generado por Arcana — ${new Date().toLocaleString('es-ES')}*`)
  return lines.join('\n')
}

/**
 * Construye el Markdown de una conversación del Panel IA.
 */
export function buildChatMarkdown(history) {
  const lines = ['# Conversación IA — Arcana', '']
  history.forEach(({ question, answer }, i) => {
    lines.push(`## ${i + 1}. ${question}`)
    lines.push('')
    lines.push(answer)
    lines.push('')
  })
  lines.push('---')
  lines.push(`*Exportado el ${new Date().toLocaleString('es-ES')}*`)
  return lines.join('\n')
}

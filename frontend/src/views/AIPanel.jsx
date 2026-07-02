import React, { useState } from 'react'

// Simple local "AI": answers questions from window.eaProject data
function answerFromProject(question) {
  const proj = window.eaProject
  if (!proj) return 'No hay proyecto cargado. Carga primero un archivo desde la página de inicio.'

  const q = question.toLowerCase()
  const { packages, blocks, connectors, ports, idMap } = proj

  // Most connected blocks
  if (q.includes('dependencia') || q.includes('conectad') || q.includes('crític')) {
    const freq = {}
    connectors.forEach(c => {
      if (c.source) freq[c.source] = (freq[c.source] || 0) + 1
      if (c.target) freq[c.target] = (freq[c.target] || 0) + 1
    })
    const sorted = Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([id, n]) => `  • ${idMap[id]?.name || id}: ${n} conexión(es)`)
    return sorted.length
      ? `Bloques con más conexiones en el modelo:\n${sorted.join('\n')}`
      : 'No se encontraron conectores en el modelo.'
  }

  // Documentation gaps
  if (q.includes('documentación') || q.includes('vacío') || q.includes('hueco') || q.includes('sin doc')) {
    const nodoc = blocks.filter(b => !b.documentation)
    return nodoc.length === 0
      ? 'Todos los bloques tienen documentación registrada.'
      : `${nodoc.length} bloque(s) sin documentación:\n${nodoc.slice(0, 15).map(b => `  • ${b.name}`).join('\n')}${nodoc.length > 15 ? `\n  ... y ${nodoc.length - 15} más` : ''}`
  }

  // Ports info
  if (q.includes('puerto') || q.includes('interfaz') || q.includes('port')) {
    const byBlock = {}
    ports.forEach(p => { byBlock[p.parentId] = (byBlock[p.parentId] || 0) + 1 })
    const sorted = Object.entries(byBlock)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([id, n]) => `  • ${idMap[id]?.name || id}: ${n} puerto(s)`)
    return `Bloques con más puertos:\n${sorted.join('\n')}`
  }

  // Package list
  if (q.includes('paquete') || q.includes('subsistema')) {
    return `Paquetes del proyecto (${packages.length}):\n${packages.map(p => `  • ${p.name}`).join('\n')}`
  }

  // Executive summary
  if (q.includes('resumen') || q.includes('ejecutivo') || q.includes('proyecto')) {
    const connRatio = blocks.length > 0 ? (connectors.length / blocks.length).toFixed(1) : 0
    return [
      `📋 Resumen ejecutivo del proyecto`,
      ``,
      `Paquetes: ${packages.length}`,
      `Bloques (uml:Class): ${blocks.length}`,
      `Conectores: ${connectors.length}`,
      `Puertos: ${ports.length}`,
      `Ratio conectores/bloque: ${connRatio}`,
      ``,
      `Paquetes principales:`,
      ...packages.slice(0, 8).map(p => `  • ${p.name}`),
      ``,
      `Bloques más "conectados" (según parentId compartido):`,
      ...blocks.slice(0, 5).map(b => {
        const bp = (window.eaProject?.ports || []).filter(p => p.parentId === b.id).length
        return `  • ${b.name} — ${bp} puerto(s)`
      }),
    ].join('\n')
  }

  // Block search
  const words = q.split(' ').filter(w => w.length > 3)
  const matched = blocks.filter(b => words.some(w => b.name.toLowerCase().includes(w)))
  if (matched.length > 0) {
    return `Bloques relacionados con tu consulta:\n${matched.slice(0, 10).map(b => {
      const bp = ports.filter(p => p.parentId === b.id).length
      const parent = idMap[b.parentId]?.name || ''
      return `  • ${b.name}${parent ? ` (en ${parent})` : ''}${bp ? ` — ${bp} puertos` : ''}`
    }).join('\n')}`
  }

  return [
    'No encontré una respuesta específica. Puedes preguntar sobre:',
    '  • "bloques críticos" o "dependencias"',
    '  • "huecos de documentación"',
    '  • "puertos e interfaces"',
    '  • "paquetes del proyecto"',
    '  • "resumen ejecutivo"',
    '  • El nombre de un bloque concreto',
  ].join('\n')
}

export default function AIPanel() {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState(null)
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState([])

  const suggestedQuestions = [
    '¿Cuáles son los bloques más críticos del sistema?',
    '¿Qué bloques tienen más dependencias?',
    '¿Qué huecos de documentación existen?',
    '¿Qué paquetes hay en el proyecto?',
    'Dame un resumen ejecutivo del proyecto',
  ]

  function sendQuestion(q) {
    const questionToSend = q || question
    if (!questionToSend.trim()) return
    setLoading(true)
    setAnswer(null)

    // Simulate async for UX
    setTimeout(() => {
      const resp = answerFromProject(questionToSend)
      setAnswer(resp)
      setHistory(prev => [{ question: questionToSend, answer: resp }, ...prev.slice(0, 9)])
      setLoading(false)
    }, 200)
  }

  return (
    <div style={{ maxWidth: '800px' }}>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>Panel IA</h2>
      <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
        Consulta libre sobre el proyecto cargado. Las respuestas se generan a partir del modelo en memoria, sin backend ni API externa.
      </p>

      {/* Suggested */}
      <div style={{ marginBottom: '1rem' }}>
        <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>Preguntas sugeridas</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {suggestedQuestions.map(q => (
            <button key={q} className="btn btn-ghost" style={{ fontSize: '0.8rem' }}
              onClick={() => { setQuestion(q); sendQuestion(q) }}>
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Input */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <input
          type="text"
          value={question}
          onChange={e => setQuestion(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendQuestion()}
          placeholder="Escribe tu pregunta sobre el proyecto..."
          style={{
            flex: 1, padding: '0.625rem 0.875rem',
            border: '1px solid var(--color-border)', borderRadius: '0.5rem',
            fontSize: '0.875rem', background: 'var(--color-surface)',
          }}
        />
        <button className="btn btn-primary" onClick={() => sendQuestion()} disabled={loading}>
          {loading ? '⏳' : 'Preguntar'}
        </button>
      </div>

      {/* Answer */}
      {answer && (
        <div className="card" style={{ marginBottom: '1.5rem', background: 'var(--color-primary-highlight)' }}>
          <div className="card-title">🤖 Respuesta</div>
          <pre style={{ background: 'transparent', padding: 0, fontSize: '0.875rem', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{answer}</pre>
        </div>
      )}

      {/* History */}
      {history.length > 1 && (
        <div>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>Historial</div>
          {history.slice(1).map((item, i) => (
            <div key={i} className="card" style={{ marginBottom: '0.75rem', opacity: 0.65 }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-primary)', marginBottom: '0.4rem' }}>❓ {item.question}</div>
              <pre style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', whiteSpace: 'pre-wrap', background: 'transparent', padding: 0 }}>
                {item.answer.slice(0, 300)}{item.answer.length > 300 ? '…' : ''}
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

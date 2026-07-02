import React, { useState } from 'react'

export default function AIPanel() {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState(null)
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState([])

  const suggestedQuestions = [
    '¿Cuáles son los bloques más críticos del sistema?',
    '¿Qué bloques tienen más dependencias?',
    '¿Qué huecos de documentación existen?',
    '¿Cómo se relacionan los subsistemas de comunicación y procesamiento?',
    'Dame un resumen ejecutivo del proyecto',
  ]

  async function sendQuestion(q) {
    const questionToSend = q || question
    if (!questionToSend.trim()) return
    setLoading(true)
    setAnswer(null)
    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: questionToSend })
      })
      const data = await res.json()
      setAnswer(data.answer)
      setHistory(prev => [{ question: questionToSend, answer: data.answer }, ...prev.slice(0, 9)])
    } catch (err) {
      setAnswer('Error al contactar con la IA. Verifica que el backend esté corriendo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: '800px' }}>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>Panel IA</h2>
      <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
        Consulta libre sobre el proyecto cargado.
      </p>

      {/* Preguntas sugeridas */}
      <div style={{ marginBottom: '1rem' }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>Preguntas sugeridas</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {suggestedQuestions.map(q => (
            <button key={q} className="btn btn-ghost" style={{ fontSize: '0.8rem' }} onClick={() => { setQuestion(q); sendQuestion(q) }}>
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
            fontSize: '0.875rem', background: 'var(--color-surface)'
          }}
        />
        <button className="btn btn-primary" onClick={() => sendQuestion()} disabled={loading}>
          {loading ? '⏳' : 'Preguntar'}
        </button>
      </div>

      {/* Respuesta actual */}
      {answer && (
        <div className="card" style={{ marginBottom: '1.5rem', background: '#f0fafb' }}>
          <div className="card-title">🤖 Respuesta</div>
          <pre style={{ background: 'transparent', padding: 0, fontSize: '0.875rem', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{answer}</pre>
        </div>
      )}

      {/* Historial */}
      {history.length > 0 && (
        <div>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>Historial</div>
          {history.map((item, i) => (
            <div key={i} className="card" style={{ marginBottom: '0.75rem', opacity: i === 0 ? 1 : 0.7 }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-primary)', marginBottom: '0.5rem' }}>❓ {item.question}</div>
              <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', whiteSpace: 'pre-wrap' }}>{item.answer.slice(0, 300)}{item.answer.length > 300 ? '…' : ''}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

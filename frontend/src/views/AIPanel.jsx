import React, { useState } from 'react'

export default function AIPanel() {
  const [question, setQuestion] = useState('')
  const [answer,   setAnswer]   = useState(null)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState(null)
  const [history,  setHistory]  = useState([])

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
    setError(null)
    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: questionToSend }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || `Error ${res.status}`)
      }
      const data = await res.json()
      setAnswer(data.answer)
      setHistory(prev => [{ question: questionToSend, answer: data.answer }, ...prev.slice(0, 9)])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: '800px' }}>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>Panel IA</h2>
      <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
        Consulta libre sobre el proyecto cargado. Requiere backend con <code>OPENAI_API_KEY</code> configurada.
      </p>

      {/* Suggested */}
      <div style={{ marginBottom: '1rem' }}>
        <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>Preguntas sugeridas</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {suggestedQuestions.map(q => (
            <button key={q} className="btn btn-ghost" style={{ fontSize: '0.8rem' }}
              onClick={() => { setQuestion(q); sendQuestion(q) }}>{q}</button>
          ))}
        </div>
      </div>

      {/* Input */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <input
          type="text" value={question}
          onChange={e => setQuestion(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendQuestion()}
          placeholder="Escribe tu pregunta sobre el proyecto..."
          style={{ flex: 1, padding: '0.625rem 0.875rem', border: '1px solid var(--color-border)', borderRadius: '0.5rem', fontSize: '0.875rem', background: 'var(--color-surface)' }}
        />
        <button className="btn btn-primary" onClick={() => sendQuestion()} disabled={loading}>
          {loading ? '⏳' : 'Preguntar'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', background: '#fffbea', border: '1px solid #f0c040', borderRadius: '0.5rem', fontSize: '0.85rem', color: '#7a5800' }}>
          ⚠️ {error}
          {error.includes('OPENAI_API_KEY') || error.includes('500') ? (
            <div style={{ marginTop: '0.5rem', fontWeight: 600 }}>
              Configura la clave: en <code>backend/</code> crea un archivo <code>.env</code> con <code>OPENAI_API_KEY=sk-...</code> y reinicia el backend.
            </div>
          ) : null}
        </div>
      )}

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

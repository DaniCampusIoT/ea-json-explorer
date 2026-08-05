import React, { useState } from 'react'
import MarkdownView from '../components/MarkdownView'
import { SkeletonAIAnswer } from '../components/Skeleton'
import { useAI } from '../context/AIContext'
import { exportMarkdown, exportPDF, buildChatMarkdown } from '../utils/exportUtils'

function chatToHtml(history) {
  return history.map(({ question, answer }, i) =>
    `<h2>${i + 1}. ${question}</h2><p>${answer.replace(/\n/g, '<br/>')}</p>`
  ).join('<hr/>')
}

export default function AIPanel() {
  const { history, answer, loading, error, ask, clearHistory } = useAI()
  const [question, setQuestion] = useState('')

  const suggestedQuestions = [
    '¿Cuáles son los bloques más críticos del sistema?',
    '¿Qué bloques tienen más dependencias?',
    '¿Qué huecos de documentación existen?',
    '¿Cómo se relacionan los subsistemas de comunicación y procesamiento?',
    'Dame un resumen ejecutivo del proyecto',
  ]

  function sendQuestion(q) {
    const toSend = q || question
    if (!toSend.trim()) return
    setQuestion('')
    ask(toSend)
  }

  function handleExportMD() {
    exportMarkdown('arcana-chat', buildChatMarkdown(history))
  }

  function handleExportPDF() {
    exportPDF('Conversación IA — Arcana', chatToHtml(history))
  }

  return (
    <div style={{ maxWidth: '800px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, flex: 1 }}>Panel IA</h2>
        {history.length > 0 && (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-ghost" style={{ fontSize: '0.78rem' }} onClick={handleExportMD}>💾 .md</button>
            <button className="btn btn-ghost" style={{ fontSize: '0.78rem' }} onClick={handleExportPDF}>🖨 PDF</button>
            <button className="btn btn-ghost" style={{ fontSize: '0.78rem', color: 'var(--color-error)' }} onClick={clearHistory}>🗑️ Limpiar</button>
          </div>
        )}
      </div>
      <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
        Consulta libre sobre el proyecto cargado. Requiere backend con <code>OPENAI_API_KEY</code> configurada.
        {history.length > 0 && <span style={{ marginLeft: '0.5rem', color: 'var(--color-primary)', fontWeight: 500 }}>{history.length} mensajes guardados</span>}
      </p>

      {/* Suggested */}
      <div style={{ marginBottom: '1rem' }}>
        <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>Preguntas sugeridas</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {suggestedQuestions.map(q => (
            <button key={q} className="btn btn-ghost" style={{ fontSize: '0.8rem' }}
              onClick={() => sendQuestion(q)}>{q}</button>
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
          style={{ flex: 1, padding: '0.625rem 0.875rem', border: '1px solid var(--color-border)', borderRadius: '0.5rem', fontSize: '0.875rem', background: 'var(--color-surface)', color: 'var(--color-text)' }}
        />
        <button className="btn btn-primary" onClick={() => sendQuestion()} disabled={loading}>
          {loading ? '…' : 'Preguntar'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', background: '#fffbea', border: '1px solid #f0c040', borderRadius: '0.5rem', fontSize: '0.85rem', color: '#7a5800' }}>
          ⚠️ {error}
        </div>
      )}

      {/* Skeleton */}
      {loading && <SkeletonAIAnswer />}

      {/* Respuesta actual */}
      {!loading && answer && (
        <div className="card" style={{ marginBottom: '1.5rem', background: 'var(--color-primary-highlight)' }}>
          <div className="card-title">🤖 Respuesta</div>
          <MarkdownView>{answer}</MarkdownView>
        </div>
      )}

      {/* Historial persistente */}
      {history.length > 1 && (
        <div>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>
            Historial ({history.length - 1} anteriores)
          </div>
          {history.slice(1).map((item, i) => (
            <div key={i} className="card" style={{ marginBottom: '0.75rem', opacity: 0.65 }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-primary)', marginBottom: '0.4rem' }}>❓ {item.question}</div>
              <MarkdownView className="md-body--compact">
                {item.answer.slice(0, 400) + (item.answer.length > 400 ? '\n\n…' : '')}
              </MarkdownView>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

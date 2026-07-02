import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'

export default function Summary() {
  const { blockId } = useParams()
  const navigate = useNavigate()
  const [block, setBlock]               = useState(null)
  const [loadingBlock, setLoadingBlock] = useState(false)
  const [summary, setSummary]           = useState(null)
  const [loadingSummary, setLoadingSummary] = useState(false)
  const [prompts, setPrompts]           = useState(null)
  const [loadingPrompt, setLoadingPrompt]   = useState(false)
  const [aiError, setAiError]           = useState(null)

  useEffect(() => {
    if (!blockId) return
    setSummary(null)
    setPrompts(null)
    setAiError(null)
    setLoadingBlock(true)

    // Try backend first, fallback to local
    fetch(`/api/blocks/${blockId}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => { setBlock(data); setLoadingBlock(false) })
      .catch(() => {
        const proj = window.eaProject
        if (proj) {
          const found = proj.blocks.find(b => b.id === blockId)
          setBlock(found || null)
        }
        setLoadingBlock(false)
      })
  }, [blockId])

  async function generateSummary() {
    setLoadingSummary(true)
    setAiError(null)
    try {
      const res = await fetch(`/api/blocks/${blockId}/summary`)
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setSummary(data)
    } catch (e) {
      setAiError('No se pudo generar el resumen IA. ¿Está el backend corriendo con OPENAI_API_KEY configurada?')
    } finally {
      setLoadingSummary(false)
    }
  }

  async function generatePrompt() {
    setLoadingPrompt(true)
    setAiError(null)
    try {
      const res = await fetch(`/api/blocks/${blockId}/image-prompt`)
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setPrompts([data.prompt])
    } catch (e) {
      setAiError('No se pudo generar el prompt visual. ¿Está el backend corriendo con OPENAI_API_KEY configurada?')
    } finally {
      setLoadingPrompt(false)
    }
  }

  if (!blockId) return (
    <div className="empty-state">
      <span style={{ fontSize: '3rem' }}>📋</span>
      <p>Selecciona un bloque desde el <strong>Explorador</strong>.</p>
    </div>
  )

  if (loadingBlock) return <div className="empty-state"><p>Cargando bloque…</p></div>
  if (!block) return (
    <div className="empty-state">
      <span style={{ fontSize: '3rem' }}>🔍</span>
      <p>Bloque no encontrado. <button className="btn btn-ghost" onClick={() => navigate('/explorer')}>Volver al explorador</button></p>
    </div>
  )

  const ports = (window.eaProject?.ports || []).filter(p => p.parentId === blockId)
  const idMap = window.eaProject?.idMap || {}
  const parentName = idMap[block.parentId || block.parent_id]?.name

  return (
    <div style={{ maxWidth: '820px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <span style={{ fontSize: '2rem', flexShrink: 0 }}>🧻</span>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>{block.name}</h2>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
            {parentName && <span className="tag">📦 {parentName}</span>}
            {ports.length > 0 && <span className="tag">🔌 {ports.length} puertos</span>}
            {block.stereotype && <span className="tag">{block.stereotype}</span>}
          </div>
        </div>
        <button className="btn btn-ghost" style={{ fontSize: '0.8rem', flexShrink: 0 }}
          onClick={() => navigate('/explorer')}>← Explorador</button>
      </div>

      {/* Documentation */}
      {block.documentation && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div className="card-title">📔 Documentación</div>
          <p style={{ fontSize: '0.875rem', lineHeight: 1.7 }}>{block.documentation}</p>
        </div>
      )}

      {/* Ports */}
      {ports.length > 0 && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div className="card-title">🔌 Puertos ({ports.length})</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.5rem' }}>
            {ports.map(p => <span key={p.id} className="tag" style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{p.name}</span>)}
          </div>
        </div>
      )}

      {/* AI actions */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <button className="btn btn-primary" onClick={generateSummary} disabled={loadingSummary}>
          {loadingSummary ? '⏳ Generando…' : '🤖 Resumen IA'}
        </button>
        <button className="btn btn-ghost" onClick={generatePrompt} disabled={loadingPrompt}>
          {loadingPrompt ? '⏳ Generando…' : '🎨 Prompt visual'}
        </button>
      </div>

      {aiError && (
        <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', background: '#fffbea', border: '1px solid #f0c040', borderRadius: '0.5rem', fontSize: '0.83rem', color: '#7a5800' }}>
          ⚠️ {aiError}
        </div>
      )}

      {/* Summary */}
      {summary && (
        <div className="card" style={{ marginBottom: '1.25rem', background: 'var(--color-primary-highlight)' }}>
          <div className="card-title">🤖 Resumen IA</div>
          <pre style={{ background: 'transparent', padding: 0, fontSize: '0.85rem', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
            {summary.summary}
          </pre>
        </div>
      )}

      {/* Visual prompts */}
      {prompts && prompts.map((p, i) => (
        <div key={i} className="card" style={{ marginBottom: '0.75rem' }}>
          <div className="card-title">🎨 Prompt visual</div>
          <p style={{ fontSize: '0.85rem', lineHeight: 1.7, marginBottom: '0.75rem' }}>{p}</p>
          <button className="btn btn-ghost" style={{ fontSize: '0.78rem' }}
            onClick={() => navigator.clipboard.writeText(p)}>📋 Copiar</button>
        </div>
      ))}
    </div>
  )
}

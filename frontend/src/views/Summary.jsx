import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'

export default function Summary() {
  const { blockId } = useParams()
  const navigate = useNavigate()
  const [block, setBlock]                   = useState(null)
  const [loadingBlock, setLoadingBlock]     = useState(false)
  const [summary, setSummary]               = useState(null)
  const [loadingSummary, setLoadingSummary] = useState(false)
  const [prompts, setPrompts]               = useState(null)
  const [loadingPrompt, setLoadingPrompt]   = useState(false)
  const [imageData, setImageData]           = useState(null)
  const [loadingImage, setLoadingImage]     = useState(false)
  const [aiError, setAiError]               = useState(null)

  useEffect(() => {
    if (!blockId) return
    setSummary(null)
    setPrompts(null)
    setImageData(null)
    setAiError(null)
    setLoadingBlock(true)

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

  async function generateImage() {
    setLoadingImage(true)
    setAiError(null)
    setImageData(null)
    try {
      const res = await fetch(`/api/blocks/${blockId}/image`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }))
        throw new Error(err.detail || res.statusText)
      }
      const data = await res.json()
      setImageData(data)
    } catch (e) {
      setAiError(`No se pudo generar la imagen: ${e.message}`)
    } finally {
      setLoadingImage(false)
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
        <button
          className="btn btn-ghost"
          onClick={generateImage}
          disabled={loadingImage}
          style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}
        >
          {loadingImage ? '⏳ Generando imagen…' : '🖼️ Generar imagen'}
        </button>
      </div>

      {aiError && (
        <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', background: '#fffbea', border: '1px solid #f0c040', borderRadius: '0.5rem', fontSize: '0.83rem', color: '#7a5800' }}>
          ⚠️ {aiError}
        </div>
      )}

      {/* Generated image */}
      {loadingImage && (
        <div className="card" style={{ marginBottom: '1.25rem', textAlign: 'center', padding: '2rem' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🎨</div>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
            Generando imagen con DALL-E 3… (puede tardar 10-20 segundos)
          </p>
          <div style={{ marginTop: '1rem', height: '4px', borderRadius: '2px', background: 'var(--color-surface-offset)', overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: '40%', borderRadius: '2px',
              background: 'var(--color-primary)',
              animation: 'shimmer 1.5s ease-in-out infinite',
            }} />
          </div>
        </div>
      )}

      {imageData && (
        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <div className="card-title" style={{ marginBottom: '0.75rem' }}>🖼️ Imagen generada — {imageData.block_name}</div>
          <img
            src={imageData.image_url}
            alt={`Diagrama técnico de ${imageData.block_name}`}
            style={{ width: '100%', borderRadius: '0.5rem', display: 'block', marginBottom: '0.75rem' }}
            loading="lazy"
          />
          <details style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
            <summary style={{ cursor: 'pointer', marginBottom: '0.4rem' }}>🔍 Ver prompt usado</summary>
            <p style={{ lineHeight: 1.6, padding: '0.5rem', background: 'var(--color-surface-offset)', borderRadius: '0.375rem' }}>
              {imageData.prompt_used}
            </p>
          </details>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
            <a
              href={imageData.image_url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost"
              style={{ fontSize: '0.78rem' }}
            >
              🔗 Abrir en nueva pestaña
            </a>
            <button
              className="btn btn-ghost"
              style={{ fontSize: '0.78rem' }}
              onClick={() => navigator.clipboard.writeText(imageData.image_url)}
            >
              📋 Copiar URL
            </button>
          </div>
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

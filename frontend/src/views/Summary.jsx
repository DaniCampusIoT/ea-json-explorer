import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

export default function Summary() {
  const { blockId } = useParams()
  const [block, setBlock] = useState(null)
  const [summary, setSummary] = useState(null)
  const [imagePrompt, setImagePrompt] = useState(null)
  const [loadingBlock, setLoadingBlock] = useState(false)
  const [loadingSummary, setLoadingSummary] = useState(false)
  const [loadingPrompt, setLoadingPrompt] = useState(false)

  useEffect(() => {
    if (!blockId) return
    setLoadingBlock(true)
    setSummary(null)
    setImagePrompt(null)
    fetch(`/api/blocks/${blockId}`)
      .then(r => r.json())
      .then(data => { setBlock(data); setLoadingBlock(false) })
      .catch(() => setLoadingBlock(false))
  }, [blockId])

  async function generateSummary() {
    setLoadingSummary(true)
    const res = await fetch(`/api/blocks/${blockId}/summary`)
    const data = await res.json()
    setSummary(data)
    setLoadingSummary(false)
  }

  async function generatePrompt() {
    setLoadingPrompt(true)
    const res = await fetch(`/api/blocks/${blockId}/image-prompt`)
    const data = await res.json()
    setImagePrompt(data.prompt)
    setLoadingPrompt(false)
  }

  if (!blockId) return (
    <div className="empty-state">
      <span style={{ fontSize: '3rem' }}>📋</span>
      <p>Selecciona un bloque desde el Explorador para ver su ficha.</p>
    </div>
  )

  if (loadingBlock) return <div className="empty-state"><p>Cargando bloque...</p></div>
  if (!block) return <div className="empty-state"><p>Bloque no encontrado.</p></div>

  return (
    <div style={{ maxWidth: '800px' }}>
      {/* Cabecera del bloque */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <span style={{ fontSize: '2rem' }}>🧱</span>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>{block.name}</h2>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
            <span className="tag">{block.stereotype}</span>
            {block.package_id && <span className="tag" style={{ background: '#f0f4ff', color: '#3050c0' }}>pkg: {block.package_id.slice(0, 8)}</span>}
          </div>
        </div>
      </div>

      {/* Documentación */}
      {block.documentation && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div className="card-title">📄 Documentación</div>
          <p style={{ fontSize: '0.875rem', lineHeight: 1.6 }}>{block.documentation}</p>
        </div>
      )}

      {/* Puertos y Partes */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        <div className="card">
          <div className="card-title">🔌 Puertos ({block.ports?.length ?? 0})</div>
          {block.ports?.length ? block.ports.map(p => (
            <div key={p.id} style={{ fontSize: '0.8rem', padding: '0.25rem 0', borderBottom: '1px solid var(--color-border)' }}>
              <strong>{p.name}</strong> {p.direction ? <span className="tag">{p.direction}</span> : null}
            </div>
          )) : <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Sin puertos</p>}
        </div>
        <div className="card">
          <div className="card-title">🔧 Partes ({block.parts?.length ?? 0})</div>
          {block.parts?.length ? block.parts.map(p => (
            <div key={p.id} style={{ fontSize: '0.8rem', padding: '0.25rem 0', borderBottom: '1px solid var(--color-border)' }}>
              <strong>{p.name}</strong>
              {p.type_id && <span style={{ color: 'var(--color-text-muted)' }}> : {p.type_id.slice(0, 12)}</span>}
            </div>
          )) : <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Sin partes</p>}
        </div>
      </div>

      {/* Conexiones */}
      {block.connected_to?.length > 0 && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div className="card-title">🔗 Conectado a</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
            {block.connected_to.map(c => <span key={c.block_id} className="tag" style={{ background: '#fff3e0', color: '#e65100' }}>{c.block_name}</span>)}
          </div>
        </div>
      )}

      {/* Acciones IA */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <button className="btn btn-primary" onClick={generateSummary} disabled={loadingSummary}>
          {loadingSummary ? '⏳ Generando...' : '🤖 Generar resumen IA'}
        </button>
        <button className="btn btn-ghost" onClick={generatePrompt} disabled={loadingPrompt}>
          {loadingPrompt ? '⏳ Generando...' : '🎨 Generar prompt visual'}
        </button>
      </div>

      {/* Resumen IA */}
      {summary && (
        <div className="card" style={{ marginBottom: '1rem', background: '#f0fafb' }}>
          <div className="card-title">🤖 Resumen IA</div>
          <pre style={{ background: 'transparent', padding: 0, fontSize: '0.85rem', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{summary.summary}</pre>
        </div>
      )}

      {/* Prompt visual */}
      {imagePrompt && (
        <div className="card" style={{ background: '#fffbf0' }}>
          <div className="card-title">🎨 Prompt visual</div>
          <p style={{ fontSize: '0.85rem', lineHeight: 1.7, marginBottom: '0.75rem' }}>{imagePrompt}</p>
          <button className="btn btn-ghost" style={{ fontSize: '0.8rem' }} onClick={() => navigator.clipboard.writeText(imagePrompt)}>
            📋 Copiar prompt
          </button>
        </div>
      )}
    </div>
  )
}

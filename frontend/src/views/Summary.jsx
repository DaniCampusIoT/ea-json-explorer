import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'

// Generates a structured summary from block data (no backend)
function buildSummary(block, ports, connectors, idMap) {
  const connIn = connectors.filter(c => c.target === block.id || c.source === block.id)
  const parentName = idMap[block.parentId]?.name || 'desconocido'

  const structural = [
    `Bloque: ${block.name}`,
    `Paquete contenedor: ${parentName}`,
    `Puertos: ${ports.length > 0 ? ports.map(p => p.name).join(', ') : 'ninguno'}`,
    `Conectores relacionados: ${connIn.length}`,
  ].join('\n')

  const contextual = connIn.length > 0
    ? `Se relaciona con: ${connIn.map(c => {
        const otherId = c.source === block.id ? c.target : c.source
        return idMap[otherId]?.name || otherId
      }).filter(Boolean).join(', ')}`
    : 'No se han detectado conexiones directas con otros bloques.'

  const functional =
    `${block.name} es un bloque de tipo UML Class dentro del paquete «${parentName}». ` +
    (ports.length > 0
      ? `Expone ${ports.length} puerto(s): ${ports.map(p => p.name).join(', ')}. `
      : '') +
    (connIn.length > 0
      ? `Está conectado a ${connIn.length} elemento(s) del sistema.`
      : 'No presenta conexiones explícitas en el modelo.')

  return { structural, contextual, functional }
}

function buildVisualPrompt(block, ports, idMap) {
  const parentName = idMap[block.parentId]?.name || ''
  const portList = ports.map(p => p.name).join(', ') || 'sin puertos'

  return [
    `Technical block diagram of "${block.name}" system component` +
      (parentName ? `, part of the ${parentName} subsystem` : '') +
      `. Interfaces: ${portList}. Clean engineering drawing style, white background, labeled connectors, isometric view.`,

    `Exploded view illustration of ${block.name} hardware module showing internal structure. ` +
      `Ports visible: ${portList}. Technical blueprint aesthetic, precise labels, dark background with teal highlights.`,

    `System architecture diagram showing ${block.name}` +
      (parentName ? ` within ${parentName}` : '') +
      `. Node-link layout, minimalist flat design, showing connections to neighboring subsystems. Monochrome with accent color.`,

    `Icon for ${block.name}: a single geometric mark that represents its function. ` +
      `Minimal, scalable, suitable for a SysML block diagram. No text, vector style.`,
  ]
}

export default function Summary() {
  const { blockId } = useParams()
  const navigate = useNavigate()
  const [block, setBlock] = useState(null)
  const [ports, setPorts] = useState([])
  const [summary, setSummary] = useState(null)
  const [prompts, setPrompts] = useState(null)

  useEffect(() => {
    if (!blockId || !window.eaProject) return
    const proj = window.eaProject
    const found = proj.blocks.find(b => b.id === blockId)
    if (found) {
      setBlock(found)
      setPorts(proj.ports.filter(p => p.parentId === blockId))
    }
    setSummary(null)
    setPrompts(null)
  }, [blockId])

  if (!blockId) return (
    <div className="empty-state">
      <span style={{ fontSize: '3rem' }}>📋</span>
      <p>Selecciona un bloque desde el <strong>Explorador</strong> para ver su ficha.</p>
    </div>
  )

  if (!window.eaProject) return (
    <div className="empty-state">
      <span style={{ fontSize: '3rem' }}>📋</span>
      <p>No hay proyecto cargado. Ve a <strong>Cargar proyecto</strong> primero.</p>
    </div>
  )

  if (!block) return (
    <div className="empty-state">
      <span style={{ fontSize: '3rem' }}>🔍</span>
      <p>Bloque no encontrado en el proyecto.</p>
    </div>
  )

  const { connectors, idMap } = window.eaProject
  const parentName = idMap[block.parentId]?.name

  function handleGenerateSummary() {
    setSummary(buildSummary(block, ports, connectors, idMap))
  }

  function handleGeneratePrompts() {
    setPrompts(buildVisualPrompt(block, ports, idMap))
  }

  return (
    <div style={{ maxWidth: '820px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <span style={{ fontSize: '2rem' }}>🧻</span>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>{block.name}</h2>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
            {parentName && <span className="tag">📦 {parentName}</span>}
            {ports.length > 0 && <span className="tag">🔌 {ports.length} puertos</span>}
          </div>
        </div>
        <button
          className="btn btn-ghost"
          style={{ marginLeft: 'auto', fontSize: '0.8rem' }}
          onClick={() => navigate('/explorer')}
        >
          ← Explorador
        </button>
      </div>

      {/* Ports */}
      {ports.length > 0 && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div className="card-title">🔌 Puertos ({ports.length})</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.5rem' }}>
            {ports.map(p => (
              <span key={p.id} className="tag" style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{p.name}</span>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <button className="btn btn-primary" onClick={handleGenerateSummary}>
          🤖 Generar resumen
        </button>
        <button className="btn btn-ghost" onClick={handleGeneratePrompts}>
          🎨 Generar prompts visuales
        </button>
      </div>

      {/* Summary */}
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
          <div className="card">
            <div className="card-title">📏 Estructural</div>
            <pre style={{ background: 'transparent', padding: 0, fontSize: '0.82rem', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{summary.structural}</pre>
          </div>
          <div className="card">
            <div className="card-title">🔗 Contextual</div>
            <p style={{ fontSize: '0.82rem', lineHeight: 1.7 }}>{summary.contextual}</p>
          </div>
          <div className="card" style={{ gridColumn: '1 / -1' }}>
            <div className="card-title">⚙️ Funcional</div>
            <p style={{ fontSize: '0.85rem', lineHeight: 1.8 }}>{summary.functional}</p>
          </div>
        </div>
      )}

      {/* Visual prompts */}
      {prompts && (
        <div className="card">
          <div className="card-title">🎨 Prompts visuales</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.75rem' }}>
            {prompts.map((p, i) => (
              <div key={i} style={{
                padding: '0.75rem', background: 'var(--color-bg)',
                borderRadius: '0.5rem', fontSize: '0.82rem', lineHeight: 1.7,
                border: '1px solid var(--color-border)'
              }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: '0.35rem' }}>
                  Prompt {i + 1}
                </div>
                <p style={{ margin: 0 }}>{p}</p>
                <button
                  className="btn btn-ghost"
                  style={{ marginTop: '0.5rem', fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
                  onClick={() => navigator.clipboard.writeText(p)}
                >
                  📋 Copiar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

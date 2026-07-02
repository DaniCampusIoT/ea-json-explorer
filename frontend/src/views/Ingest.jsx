import React, { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

// ─── EA XMI/JSON Client-side parser (for immediate stats + fallback) ───
function parseEAJson(raw) {
  let data
  try { data = JSON.parse(raw) } catch (e) {
    throw new Error('El archivo no es JSON válido: ' + e.message)
  }
  const packages = [], blocks = [], connectors = [], ports = [], idMap = {}
  function walk(el, parentId = null) {
    if (!el || typeof el !== 'object') return
    const type = el['_xmi:type'] || el['xmi:type'] || ''
    const id   = el['_xmi:id']   || el['xmi:id']   || ''
    const name = el['_name']     || el['name']      || ''
    if (id) idMap[id] = { type, name, id, parentId }
    if (type === 'uml:Package' || type === 'uml:Model') packages.push({ id, name, parentId })
    else if (type === 'uml:Class' || type === 'uml:Component') blocks.push({ id, name, parentId })
    else if (type === 'uml:Port') ports.push({ id, name, parentId })
    else if (['uml:Connector','uml:Association','uml:Dependency','uml:InformationFlow','uml:Realization'].includes(type)) {
      const src = el['_supplier'] || el['supplier'] || (Array.isArray(el.end) ? el.end[0]?.['_role'] || '' : '')
      const tgt = el['_client']   || el['client']   || (Array.isArray(el.end) ? el.end[1]?.['_role'] || '' : '')
      connectors.push({ id, name, parentId, source: src, target: tgt, kind: type })
    }
    const childKeys = ['packagedElement','nestedClassifier','ownedAttribute','ownedConnector','ownedOperation','qualifier']
    for (const key of childKeys) {
      const child = el[key]
      if (!child) continue
      if (Array.isArray(child)) child.forEach(c => walk(c, id || parentId))
      else if (typeof child === 'object') walk(child, id || parentId)
    }
  }
  const root = data?.XMI?.Model || data?.['xmi:XMI']?.['uml:Model'] || data?.Model || data
  if (root) walk(root)
  window.eaProject = { packages, blocks, connectors, ports, idMap, raw: data }
  return { packages: packages.length, blocks: blocks.length, connectors: connectors.length, ports: ports.length }
}

// ─── Component ───
export default function Ingest({ onLoaded }) {
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)
  const [result, setResult]     = useState(null)
  const [dragging, setDragging] = useState(false)
  const [backendOk, setBackendOk] = useState(null) // null=unknown, true, false
  const inputRef = useRef(null)
  const navigate = useNavigate()

  async function processFile(file) {
    if (!file) return
    const ext = file.name.split('.').pop().toLowerCase()
    if (!['json', 'txt'].includes(ext)) {
      setError('Formato no válido. Usa .json o .txt exportado de EA.')
      return
    }
    setLoading(true)
    setError(null)
    setResult(null)

    // 1. Read text and parse client-side for immediate stats + window.eaProject
    const text = await file.text()
    let stats
    try {
      stats = parseEAJson(text)
    } catch (err) {
      setError(err.message)
      setLoading(false)
      return
    }

    // 2. Also POST to backend (for AI features). Non-blocking if backend is down.
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/ingest', { method: 'POST', body: fd })
      if (res.ok) {
        const backendStats = await res.json()
        setBackendOk(true)
        // Use backend counts if available (more accurate)
        stats = backendStats
        onLoaded(backendStats)
      } else {
        setBackendOk(false)
        onLoaded(stats)
      }
    } catch {
      setBackendOk(false)
      onLoaded(stats)
    }

    setResult(stats)
    setLoading(false)
  }

  function handleInputChange(e) { processFile(e.target.files[0]); e.target.value = '' }
  function handleDrop(e)        { e.preventDefault(); setDragging(false); processFile(e.dataTransfer.files[0]) }
  function handleDragOver(e)    { e.preventDefault(); setDragging(true) }
  function handleDragLeave()    { setDragging(false) }

  const statLabels = { packages: 'paquetes', blocks: 'bloques', connectors: 'conectores', ports: 'puertos' }

  return (
    <div style={{ maxWidth: '600px' }}>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>Cargar proyecto</h2>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
        Sube el archivo exportado desde Enterprise Architect. Se aceptan <strong>.json</strong> y <strong>.txt</strong>.
      </p>

      <div
        onClick={() => !loading && inputRef.current?.click()}
        onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave}
        role="button" tabIndex={0} aria-label="Zona de carga"
        onKeyDown={e => e.key === 'Enter' && inputRef.current?.click()}
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem',
          padding: '2.5rem 2rem',
          border: `2px dashed ${dragging ? 'var(--color-primary)' : 'var(--color-border)'}`,
          borderRadius: '0.75rem', cursor: loading ? 'wait' : 'pointer',
          background: dragging ? 'var(--color-primary-highlight)' : 'var(--color-surface)',
          transition: 'border-color 180ms, background 180ms', userSelect: 'none',
        }}
      >
        <span style={{ fontSize: '2.5rem' }}>{loading ? '⏳' : dragging ? '📥' : '📂'}</span>
        <span style={{ fontWeight: 600 }}>{loading ? 'Procesando…' : dragging ? 'Suelta aquí' : 'Selecciona o arrastra el archivo'}</span>
        <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Formatos: <code>.json</code> y <code>.txt</code> de EA</span>
        <input ref={inputRef} type="file" accept=".json,.txt" onChange={handleInputChange} style={{ display: 'none' }} disabled={loading} />
      </div>

      {error && (
        <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: 'var(--color-error-highlight)', border: '1px solid var(--color-error)', borderRadius: '0.5rem', color: 'var(--color-error)', fontSize: '0.85rem' }}>
          ⚠️ {error}
        </div>
      )}

      {result && (
        <div style={{ marginTop: '1.5rem' }} className="card">
          <div className="card-title">✅ Proyecto cargado</div>

          {backendOk === false && (
            <div style={{ margin: '0.5rem 0 0.75rem', padding: '0.6rem 0.75rem', background: '#fffbea', border: '1px solid #f0c040', borderRadius: '0.4rem', fontSize: '0.8rem', color: '#7a5800' }}>
              ⚠️ Backend no disponible. Las funciones de IA no estarán activas. Para activarlas, arranca el backend con tu OPENAI_API_KEY (ver README).
            </div>
          )}
          {backendOk === true && (
            <div style={{ margin: '0.5rem 0 0.75rem', padding: '0.6rem 0.75rem', background: '#f0faf0', border: '1px solid var(--color-success)', borderRadius: '0.4rem', fontSize: '0.8rem', color: 'var(--color-success)' }}>
              ✅ Backend conectado. IA disponible.
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.25rem' }}>
            {Object.entries(result).map(([k, v]) => (
              <div key={k} style={{ padding: '0.75rem', background: 'var(--color-bg)', borderRadius: '0.375rem', textAlign: 'center' }}>
                <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--color-primary)' }}>{v}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.15rem' }}>{statLabels[k] || k}</div>
              </div>
            ))}
          </div>
          <button className="btn btn-primary" style={{ marginTop: '1rem', width: '100%' }} onClick={() => navigate('/explorer')}>
            Explorar proyecto →
          </button>
        </div>
      )}
    </div>
  )
}

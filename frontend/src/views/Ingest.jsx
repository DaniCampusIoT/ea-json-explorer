import React, { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

// ─── EA XMI/JSON Parser (client-side) ───────────────────────────────────────

function parseEAJson(raw) {
  let data
  try {
    data = JSON.parse(raw)
  } catch (e) {
    throw new Error('El archivo no es JSON válido: ' + e.message)
  }

  const packages = []
  const blocks = []
  const connectors = []
  const ports = []
  const idMap = {}

  function walkElement(el, parentId = null) {
    if (!el || typeof el !== 'object') return

    const type = el['_xmi:type'] || el['xmi:type'] || ''
    const id = el['_xmi:id'] || el['xmi:id'] || ''
    const name = el['_name'] || el['name'] || ''

    if (id) idMap[id] = { type, name, id, parentId }

    if (type === 'uml:Package' || type === 'uml:Model') {
      packages.push({ id, name, parentId })
    } else if (type === 'uml:Class' || type === 'uml:Component') {
      blocks.push({ id, name, parentId })
    } else if (type === 'uml:Port') {
      ports.push({ id, name, parentId })
    } else if (
      type === 'uml:Connector' ||
      type === 'uml:Association' ||
      type === 'uml:Dependency' ||
      type === 'uml:InformationFlow' ||
      type === 'uml:Realization'
    ) {
      const src = el['_supplier'] || el['supplier'] ||
        (el.end && Array.isArray(el.end) ? el.end[0]?.['_role'] || el.end[0]?.role || '' : '')
      const tgt = el['_client'] || el['client'] ||
        (el.end && Array.isArray(el.end) ? el.end[1]?.['_role'] || el.end[1]?.role || '' : '')
      connectors.push({ id, name, parentId, source: src, target: tgt, kind: type })
    }

    // recurse into all known child arrays/objects
    const childKeys = [
      'packagedElement', 'nestedClassifier', 'ownedAttribute',
      'ownedConnector', 'ownedOperation', 'ownedBehavior',
      'clientDependency', 'interfaceRealization',
      'packageImport', 'elementImport',
    ]
    for (const key of childKeys) {
      const child = el[key]
      if (!child) continue
      const childId = id || parentId
      if (Array.isArray(child)) {
        child.forEach(c => walkElement(c, childId))
      } else if (typeof child === 'object') {
        walkElement(child, childId)
      }
    }

    // also recurse into qualifier (ports nested under properties)
    if (el.qualifier) {
      const q = el.qualifier
      const childId = id || parentId
      if (Array.isArray(q)) q.forEach(c => walkElement(c, childId))
      else walkElement(q, childId)
    }
  }

  // Entry points for different EA export shapes
  const root =
    data?.XMI?.Model ||
    data?.['xmi:XMI']?.['uml:Model'] ||
    data?.Model ||
    data

  if (root) walkElement(root)

  // Persist globally for Explorer / Summary / AIPanel views
  window.eaProject = { packages, blocks, connectors, ports, idMap, raw: data }

  return {
    packages: packages.length,
    blocks: blocks.length,
    connectors: connectors.length,
    ports: ports.length,
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function Ingest({ onLoaded }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef(null)
  const navigate = useNavigate()

  function processFile(file) {
    if (!file) return
    const ext = file.name.split('.').pop().toLowerCase()
    if (!['json', 'txt'].includes(ext)) {
      setError('Formato no válido. Usa un archivo .json o .txt exportado desde EA.')
      return
    }
    setLoading(true)
    setError(null)
    setResult(null)

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const stats = parseEAJson(e.target.result)
        setResult(stats)
        onLoaded(stats)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    reader.onerror = () => {
      setError('No se pudo leer el archivo.')
      setLoading(false)
    }
    reader.readAsText(file, 'utf-8')
  }

  function handleInputChange(e) {
    processFile(e.target.files[0])
    // reset so the same file can be re-selected
    e.target.value = ''
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    processFile(file)
  }

  function handleDragOver(e) {
    e.preventDefault()
    setDragging(true)
  }

  function handleDragLeave() {
    setDragging(false)
  }

  const statLabels = {
    packages: 'paquetes',
    blocks: 'bloques',
    connectors: 'conectores',
    ports: 'puertos',
  }

  return (
    <div style={{ maxWidth: '600px' }}>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>Cargar proyecto</h2>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
        Sube el archivo exportado desde Enterprise Architect.
        Se aceptan <strong>.json</strong> y <strong>.txt</strong>.
        El análisis se realiza en el navegador, sin necesidad de backend.
      </p>

      {/* Drop zone */}
      <div
        onClick={() => !loading && inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        role="button"
        tabIndex={0}
        aria-label="Zona de carga de archivo"
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1rem',
          padding: '2.5rem 2rem',
          border: `2px dashed ${dragging ? 'var(--color-primary)' : 'var(--color-border)'}`,
          borderRadius: '0.75rem',
          cursor: loading ? 'wait' : 'pointer',
          background: dragging ? 'var(--color-primary-highlight)' : 'var(--color-surface)',
          transition: 'border-color 180ms, background 180ms',
          userSelect: 'none',
        }}
      >
        <span style={{ fontSize: '2.5rem' }}>{loading ? '⏳' : dragging ? '📥' : '📂'}</span>
        <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>
          {loading ? 'Procesando archivo…' : dragging ? 'Suelta el archivo aquí' : 'Selecciona o arrastra el archivo'}
        </span>
        <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
          Formatos aceptados: <code>.json</code> y <code>.txt</code> exportados de EA
        </span>
        <input
          ref={inputRef}
          type="file"
          accept=".json,.txt"
          onChange={handleInputChange}
          style={{ display: 'none' }}
          disabled={loading}
        />
      </div>

      {/* Error */}
      {error && (
        <div style={{
          marginTop: '1rem',
          padding: '0.75rem 1rem',
          background: 'var(--color-error-highlight)',
          border: '1px solid var(--color-error)',
          borderRadius: '0.5rem',
          color: 'var(--color-error)',
          fontSize: '0.85rem',
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div style={{ marginTop: '1.5rem' }} className="card">
          <div className="card-title">✅ Proyecto cargado</div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '0.5rem',
            marginTop: '0.75rem',
          }}>
            {Object.entries(result).map(([k, v]) => (
              <div key={k} style={{
                padding: '0.75rem',
                background: 'var(--color-bg)',
                borderRadius: '0.375rem',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--color-primary)' }}>{v}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.15rem' }}>
                  {statLabels[k] || k}
                </div>
              </div>
            ))}
          </div>
          <button
            className="btn btn-primary"
            style={{ marginTop: '1rem', width: '100%' }}
            onClick={() => navigate('/explorer')}
          >
            Explorar proyecto →
          </button>
        </div>
      )}
    </div>
  )
}

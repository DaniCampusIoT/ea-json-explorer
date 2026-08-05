import React, { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProjectHistory } from '../utils/useProjectHistory'
import { useAI } from '../context/AIContext'

const VALID_EXTS = ['json', 'txt', 'xml', 'xmi']

/**
 * Parsea JSON/XMI de EA en el cliente.
 *
 * CAMBIO CLAVE: después del walk() detectamos qué bloques actúan como
 * contenedores (son parentId de otros bloques) y los elevamos también
 * a packages para que el filtro de Explorer los encuentre.
 *
 * Devuelve { stats, project }.
 */
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
    if (type === 'uml:Package' || type === 'uml:Model')
      packages.push({ id, name, parentId })
    else if (type === 'uml:Class' || type === 'uml:Component')
      blocks.push({ id, name, parentId })
    else if (type === 'uml:Port')
      ports.push({ id, name, parentId })
    else if (['uml:Connector','uml:Association','uml:Dependency',
               'uml:InformationFlow','uml:Realization'].includes(type)) {
      const src = el['_supplier'] || el['supplier'] ||
                  (Array.isArray(el.end) ? el.end[0]?.['_role'] || '' : '')
      const tgt = el['_client']   || el['client']   ||
                  (Array.isArray(el.end) ? el.end[1]?.['_role'] || '' : '')
      connectors.push({ id, name, parentId, source: src, target: tgt, kind: type })
    }
    const childKeys = ['packagedElement','nestedClassifier','ownedAttribute',
                       'ownedConnector','ownedOperation','qualifier']
    for (const key of childKeys) {
      const child = el[key]
      if (!child) continue
      if (Array.isArray(child)) child.forEach(c => walk(c, id || parentId))
      else if (typeof child === 'object') walk(child, id || parentId)
    }
  }

  const root = data?.XMI?.Model || data?.['xmi:XMI']?.['uml:Model'] || data?.Model || data
  if (root) walk(root)

  // ── Promover bloques-contenedor a packages ──────────────────────
  // Hay bloques (uml:Class) que contienen nestedClassifiers (otros bloques).
  // El Explorer filtra por parentId === pkgId, pero esos padres solo están
  // en `blocks`, no en `packages`. Los registramos en ambas listas.
  const pkgIds        = new Set(packages.map(p => p.id))
  const blockIds      = new Set(blocks.map(b => b.id))
  const parentIdsUsed = new Set(blocks.map(b => b.parentId).filter(Boolean))

  for (const pid of parentIdsUsed) {
    if (!pkgIds.has(pid) && blockIds.has(pid)) {
      const entry = idMap[pid]
      if (entry) packages.push({ id: entry.id, name: entry.name, parentId: entry.parentId })
    }
  }

  const project = { packages, blocks, connectors, ports, idMap }
  window.eaProject = { ...project, raw: data }
  return {
    stats: {
      packages:   packages.length,
      blocks:     blocks.length,
      connectors: connectors.length,
      ports:      ports.length,
    },
    project,
  }
}

/**
 * Tras ingest exitoso al backend, reconstruye window.eaProject
 * descargando /api/packages + /api/blocks.
 */
async function fetchAndRebuildProject() {
  try {
    const [pkgRes, blkRes] = await Promise.all([
      fetch('/api/packages'),
      fetch('/api/blocks'),
    ])
    if (!pkgRes.ok || !blkRes.ok) return null
    const packages = await pkgRes.json()
    const blocks   = await blkRes.json()
    const idMap = {}, ports = []
    for (const pkg of packages) {
      if (pkg.id) idMap[pkg.id] = { type: 'uml:Package', name: pkg.name, id: pkg.id, parentId: pkg.parentId || pkg.parent_id || null }
    }
    for (const blk of blocks) {
      if (blk.id) idMap[blk.id] = { type: 'uml:Class', name: blk.name, id: blk.id, parentId: blk.parentId || blk.parent_id || null }
      if (blk.ports) {
        for (const p of blk.ports) {
          ports.push({ id: p.id, name: p.name, parentId: blk.id })
          if (p.id) idMap[p.id] = { type: 'uml:Port', name: p.name, id: p.id, parentId: blk.id }
        }
      }
    }
    const project = { packages, blocks, connectors: [], ports, idMap }
    window.eaProject = { ...project }
    return project
  } catch { return null }
}

function stripExt(f) { return f.replace(/\.[^.]+$/, '') }
function timeAgo(iso) {
  const m = Math.floor((Date.now() - new Date(iso)) / 60000)
  if (m < 1) return 'ahora mismo'
  if (m < 60) return `hace ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `hace ${h}h`
  return `hace ${Math.floor(h / 24)}d`
}

export default function Ingest({ onLoaded }) {
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState(null)
  const [result,   setResult]   = useState(null)
  const [dragging, setDragging] = useState(false)
  const [beOk,     setBeOk]     = useState(null)
  const inputRef = useRef(null)
  const navigate = useNavigate()
  const { history, saveProject, loadProject, removeProject, clearHistory } = useProjectHistory()
  const { bumpProject } = useAI()

  async function processFile(file) {
    if (!file) return
    const ext = file.name.split('.').pop().toLowerCase()
    if (!VALID_EXTS.includes(ext)) {
      setError('Formato no válido. Usa .json, .txt, .xml o .xmi exportado de EA.')
      return
    }
    setLoading(true); setError(null); setResult(null)
    const isXml      = ext === 'xml' || ext === 'xmi'
    const projName   = stripExt(file.name)
    let stats        = { packages: 0, blocks: 0, connectors: 0, ports: 0 }
    let project      = null
    let backendOk    = false

    if (!isXml) {
      const text = await file.text()
      try { const p = parseEAJson(text); stats = p.stats; project = p.project }
      catch (err) { setError(err.message); setLoading(false); return }
    }

    try {
      const fd = new FormData(); fd.append('file', file)
      const res = await fetch('/api/ingest', { method: 'POST', body: fd })
      if (res.ok) {
        stats = await res.json(); backendOk = true
        onLoaded({ ...stats, projectName: projName })
        const bp = await fetchAndRebuildProject()
        if (bp) project = bp
      } else {
        const err = await res.json().catch(() => ({}))
        if (isXml) { setError(err.detail || 'Error al procesar el XML.'); setLoading(false); return }
        onLoaded({ ...stats, projectName: projName })
      }
    } catch {
      if (isXml) { setError('No se pudo conectar con el backend.'); setLoading(false); return }
      onLoaded({ ...stats, projectName: projName })
    }

    setBeOk(backendOk)
    if (project) saveProject(projName, stats, project)
    bumpProject()
    setResult(stats)
    setLoading(false)
  }

  function handleRecentLoad(entry) {
    loadProject(entry)
    onLoaded({ ...entry.stats, projectName: entry.name })
    bumpProject()
    setResult(entry.stats)
    setBeOk(null)
  }

  const handleInputChange = e => { processFile(e.target.files[0]); e.target.value = '' }
  const handleDrop       = e => { e.preventDefault(); setDragging(false); processFile(e.dataTransfer.files[0]) }
  const handleDragOver   = e => { e.preventDefault(); setDragging(true) }
  const handleDragLeave  = ()  => setDragging(false)

  const statLabels = { packages: 'paquetes', blocks: 'bloques', connectors: 'conectores', ports: 'puertos' }

  return (
    <div style={{ maxWidth: '600px' }}>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>Cargar proyecto</h2>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
        Sube el archivo exportado desde Enterprise Architect.
        Se aceptan <strong>.json</strong>, <strong>.txt</strong>, <strong>.xml</strong> y <strong>.xmi</strong>.
      </p>

      <div onClick={() => !loading && inputRef.current?.click()}
        onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave}
        role="button" tabIndex={0} aria-label="Zona de carga"
        onKeyDown={e => e.key === 'Enter' && inputRef.current?.click()}
        style={{
          display:'flex', flexDirection:'column', alignItems:'center', gap:'1rem',
          padding:'2.5rem 2rem',
          border:`2px dashed ${dragging?'var(--color-primary)':'var(--color-border)'}`,
          borderRadius:'0.75rem', cursor: loading?'wait':'pointer',
          background: dragging?'var(--color-primary-highlight)':'var(--color-surface)',
          transition:'border-color 180ms, background 180ms', userSelect:'none',
        }}>
        <span style={{fontSize:'2.5rem'}}>{loading?'⏳':dragging?'📥':'📂'}</span>
        <span style={{fontWeight:600}}>{loading?'Procesando…':dragging?'Suelta aquí':'Selecciona o arrastra el archivo'}</span>
        <span style={{fontSize:'0.8rem',color:'var(--color-text-muted)'}}>Formatos: <code>.json</code> <code>.txt</code> <code>.xml</code> <code>.xmi</code></span>
        <input ref={inputRef} type="file" accept=".json,.txt,.xml,.xmi"
          onChange={handleInputChange} style={{display:'none'}} disabled={loading} />
      </div>

      {error && (
        <div style={{marginTop:'1rem',padding:'0.75rem 1rem',background:'var(--color-error-highlight)',
          border:'1px solid var(--color-error)',borderRadius:'0.5rem',color:'var(--color-error)',fontSize:'0.85rem'}}>
          ⚠️ {error}
        </div>
      )}

      {result && (
        <div style={{marginTop:'1.5rem'}} className="card">
          <div className="card-title">✅ Proyecto cargado</div>
          {beOk === false && (
            <div style={{margin:'0.5rem 0 0.75rem',padding:'0.6rem 0.75rem',background:'#fffbea',
              border:'1px solid #f0c040',borderRadius:'0.4rem',fontSize:'0.8rem',color:'#7a5800'}}>
              ⚠️ Backend no disponible — IA desactivada.
            </div>
          )}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.5rem',marginTop:'0.25rem'}}>
            {Object.entries(result).filter(([k])=>k!=='projectName').map(([k,v])=>(
              <div key={k} style={{padding:'0.75rem',background:'var(--color-bg)',borderRadius:'0.375rem',textAlign:'center'}}>
                <div style={{fontSize:'1.75rem',fontWeight:700,color:'var(--color-primary)'}}>{v}</div>
                <div style={{fontSize:'0.75rem',color:'var(--color-text-muted)',marginTop:'0.15rem'}}>{statLabels[k]||k}</div>
              </div>
            ))}
          </div>
          <button className="btn btn-primary" style={{marginTop:'1rem',width:'100%'}}
            onClick={() => navigate('/explorer')}>
            Explorar proyecto →
          </button>
        </div>
      )}

      {history.length > 0 && (
        <div style={{marginTop:'2rem'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'0.75rem'}}>
            <span style={{fontSize:'0.7rem',fontWeight:700,textTransform:'uppercase',
              letterSpacing:'0.08em',color:'var(--color-text-muted)'}}>
              Proyectos recientes
            </span>
            <button onClick={() => clearHistory()}
              style={{fontSize:'0.7rem',color:'var(--color-text-muted)',background:'none',
                border:'none',cursor:'pointer',padding:'0.1rem 0.3rem'}}>
              Limpiar historial
            </button>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:'0.4rem'}}>
            {history.map((entry, i) => (
              <div key={i} className="recent-project-row">
                <button className="recent-project-main" onClick={() => handleRecentLoad(entry)}>
                  <span style={{fontSize:'1.1rem'}}>📁</span>
                  <span className="recent-project-name">{entry.name}</span>
                  <span className="recent-project-meta">
                    {entry.stats?.blocks ?? '?'} bloques · {timeAgo(entry.date)}
                  </span>
                </button>
                <button className="recent-project-remove"
                  onClick={() => removeProject(entry.name)} title="Eliminar">✕</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

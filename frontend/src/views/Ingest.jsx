import React, { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProjectHistory } from '../utils/useProjectHistory'
import { useAI } from '../context/AIContext'

const VALID_EXTS = ['json', 'txt', 'xml', 'xmi']

/**
 * Normaliza un proyecto garantizando que TODOS los items tengan `parentId`.
 * El backend usa:  package.parent_id | block.package_id | port.owner_id
 * El parser JSON:  parentId en todo
 * Esta función unifica ambas fuentes.
 */
function normalizeProject(proj) {
  if (!proj) return proj

  function normItem(item, altKey) {
    const parentId = item.parentId || item.parent_id || item[altKey] || null
    return { ...item, parentId }
  }

  const packages   = (proj.packages   || []).map(p => normItem(p, 'parent_id'))
  const blocks     = (proj.blocks     || []).map(b => normItem(b, 'package_id'))  // ← clave real del backend
  const connectors = (proj.connectors || []).map(c => normItem(c, 'parent_id'))
  const ports      = (proj.ports      || []).map(p => normItem(p, 'owner_id'))    // ← clave real del backend

  // Reconstruir idMap completo con los parentId ya normalizados
  const idMap = {}
  for (const p of packages)
    if (p.id) idMap[p.id] = { type: 'uml:Package', name: p.name || '', id: p.id, parentId: p.parentId }
  for (const b of blocks)
    if (b.id) idMap[b.id] = { type: 'uml:Class',   name: b.name || '', id: b.id, parentId: b.parentId }
  for (const p of ports)
    if (p.id) idMap[p.id] = { type: 'uml:Port',    name: p.name || '', id: p.id, parentId: p.parentId }

  // Promover bloques-contenedor a packages si su parentId no está en packages
  const pkgIds   = new Set(packages.map(p => p.id))
  const blockIds = new Set(blocks.map(b => b.id))
  for (const pid of new Set(blocks.map(b => b.parentId).filter(Boolean))) {
    if (!pkgIds.has(pid) && blockIds.has(pid)) {
      const e = idMap[pid]
      if (e) { packages.push({ id: e.id, name: e.name, parentId: e.parentId }); pkgIds.add(pid) }
    }
  }

  return { packages, blocks, connectors, ports, idMap }
}

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
    for (const key of ['packagedElement','nestedClassifier','ownedAttribute',
                        'ownedConnector','ownedOperation','qualifier']) {
      const child = el[key]
      if (!child) continue
      if (Array.isArray(child)) child.forEach(c => walk(c, id || parentId))
      else if (typeof child === 'object') walk(child, id || parentId)
    }
  }

  const root = data?.XMI?.Model || data?.['xmi:XMI']?.['uml:Model'] || data?.Model || data
  if (root) walk(root)

  const project = normalizeProject({ packages, blocks, connectors, ports, idMap })
  return {
    stats: {
      packages:   project.packages.length,
      blocks:     project.blocks.length,
      connectors: project.connectors.length,
      ports:      project.ports.length,
    },
    project,
  }
}

async function fetchProjectFromBackend() {
  try {
    const [pr, br, cr, por] = await Promise.all([
      fetch('/api/packages'),
      fetch('/api/blocks'),
      fetch('/api/connectors').catch(() => ({ ok: false })),
      fetch('/api/ports').catch(()      => ({ ok: false })),
    ])
    if (!pr.ok || !br.ok) return null

    const packagesRaw = await pr.json()
    const blocksRaw   = await br.json()
    const connsRaw    = cr.ok  ? await cr.json().catch(() => []) : []
    const portsRaw    = por.ok ? await por.json().catch(() => []) : []

    // Extraer puertos anidados en bloques si /api/ports no existe
    const portsFromBlocks = []
    for (const b of blocksRaw) {
      const bid = b.id || b.xmi_id
      for (const p of (b.ports || [])) {
        const ppid = p.id || p.xmi_id
        if (ppid) portsFromBlocks.push({ id: ppid, name: p.name || '', owner_id: bid })
      }
    }
    const ports = portsRaw.length > 0
      ? portsRaw.map(p => ({ ...p, id: p.id || p.xmi_id }))
      : portsFromBlocks

    // Normalizar conectores (backend usa source_id/target_id)
    const connectors = (connsRaw || []).map(c => ({
      id:       c.id || c.xmi_id || '',
      name:     c.name || c.label || '',
      parentId: c.parentId || c.parent_id || null,
      source:   c.source    || c.source_id || c.supplier || '',
      target:   c.target    || c.target_id || c.client   || '',
      kind:     c.kind      || c.connector_type || c.type || 'uml:Connector',
    }))

    return normalizeProject({
      packages:   packagesRaw.map(p => ({ ...p, id: p.id || p.xmi_id })),
      blocks:     blocksRaw.map(b   => ({ ...b, id: b.id || b.xmi_id })),
      connectors,
      ports,
      idMap: {},
    })
  } catch (e) {
    console.warn('[Ingest] fetchProjectFromBackend error:', e)
    return null
  }
}

function stripExt(f) { return f.replace(/\.[^.]+$/, '') }
function timeAgo(iso) {
  const m = Math.floor((Date.now() - new Date(iso)) / 60000)
  if (m < 1) return 'ahora mismo'
  if (m < 60) return `hace ${m} min`
  const h = Math.floor(m / 60)
  return h < 24 ? `hace ${h}h` : `hace ${Math.floor(h / 24)}d`
}

export default function Ingest({ onLoaded }) {
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState(null)
  const [result,   setResult]   = useState(null)
  const [dragging, setDragging] = useState(false)
  const [beOk,     setBeOk]     = useState(null)
  const inputRef = useRef(null)
  const navigate = useNavigate()
  const { history, saveProject, removeProject, clearHistory } = useProjectHistory()
  const { setProject } = useAI()

  async function processFile(file) {
    if (!file) return
    const ext = file.name.split('.').pop().toLowerCase()
    if (!VALID_EXTS.includes(ext)) { setError('Formato no válido.'); return }
    setLoading(true); setError(null); setResult(null)
    const isXml    = ext === 'xml' || ext === 'xmi'
    const projName = stripExt(file.name)
    let stats   = { packages: 0, blocks: 0, connectors: 0, ports: 0 }
    let project = null
    let backendOk = false

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
        const bp = await fetchProjectFromBackend()
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

    if (project) {
      setProject(project)
      saveProject(projName, stats, project)
    }
    setBeOk(backendOk)
    setResult(stats)
    setLoading(false)
  }

  function handleRecentLoad(entry) {
    const proj = normalizeProject(entry.project)
    setProject(proj)
    onLoaded({ ...entry.stats, projectName: entry.name })
    setResult(entry.stats)
    setBeOk(null)
  }

  const onInput     = e => { processFile(e.target.files[0]); e.target.value = '' }
  const onDrop      = e => { e.preventDefault(); setDragging(false); processFile(e.dataTransfer.files[0]) }
  const onDragOver  = e => { e.preventDefault(); setDragging(true) }
  const onDragLeave = () => setDragging(false)

  const statLabels = { packages:'paquetes', blocks:'bloques', connectors:'conectores', ports:'puertos' }

  return (
    <div style={{ maxWidth: '600px' }}>
      <h2 style={{ fontSize:'1.25rem', fontWeight:700, marginBottom:'0.5rem' }}>Cargar proyecto</h2>
      <p style={{ color:'var(--color-text-muted)', marginBottom:'1.5rem', fontSize:'0.9rem' }}>
        Sube el archivo exportado desde Enterprise Architect.
        Se aceptan <strong>.json</strong>, <strong>.txt</strong>, <strong>.xml</strong> y <strong>.xmi</strong>.
      </p>

      <div onClick={() => !loading && inputRef.current?.click()}
        onDrop={onDrop} onDragOver={onDragOver} onDragLeave={onDragLeave}
        role="button" tabIndex={0} aria-label="Zona de carga"
        onKeyDown={e => e.key==='Enter' && inputRef.current?.click()}
        style={{
          display:'flex', flexDirection:'column', alignItems:'center', gap:'1rem',
          padding:'2.5rem 2rem',
          border:`2px dashed ${dragging?'var(--color-primary)':'var(--color-border)'}`,
          borderRadius:'0.75rem', cursor:loading?'wait':'pointer',
          background:dragging?'var(--color-primary-highlight)':'var(--color-surface)',
          transition:'border-color 180ms, background 180ms', userSelect:'none',
        }}>
        <span style={{fontSize:'2.5rem'}}>{loading?'⏳':dragging?'📥':'📂'}</span>
        <span style={{fontWeight:600}}>{loading?'Procesando…':dragging?'Suelta aquí':'Selecciona o arrastra el archivo'}</span>
        <span style={{fontSize:'0.8rem',color:'var(--color-text-muted)'}}>
          Formatos: <code>.json</code> <code>.txt</code> <code>.xml</code> <code>.xmi</code>
        </span>
        <input ref={inputRef} type="file" accept=".json,.txt,.xml,.xmi"
          onChange={onInput} style={{display:'none'}} disabled={loading} />
      </div>

      {error && (
        <div style={{marginTop:'1rem',padding:'0.75rem 1rem',
          background:'var(--color-error-highlight)',border:'1px solid var(--color-error)',
          borderRadius:'0.5rem',color:'var(--color-error)',fontSize:'0.85rem'}}>
          ⚠️ {error}
        </div>
      )}

      {result && (
        <div style={{marginTop:'1.5rem'}} className="card">
          <div className="card-title">✅ Proyecto cargado</div>
          {beOk === false && (
            <div style={{margin:'0.5rem 0 0.75rem',padding:'0.6rem 0.75rem',
              background:'#fffbea',border:'1px solid #f0c040',
              borderRadius:'0.4rem',fontSize:'0.8rem',color:'#7a5800'}}>
              ⚠️ Backend no disponible — IA desactivada.
            </div>
          )}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.5rem',marginTop:'0.25rem'}}>
            {Object.entries(result).filter(([k])=>k!=='projectName').map(([k,v])=>(
              <div key={k} style={{padding:'0.75rem',background:'var(--color-bg)',
                borderRadius:'0.375rem',textAlign:'center'}}>
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
            <button onClick={clearHistory}
              style={{fontSize:'0.7rem',color:'var(--color-text-muted)',
                background:'none',border:'none',cursor:'pointer',padding:'0.1rem 0.3rem'}}>
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

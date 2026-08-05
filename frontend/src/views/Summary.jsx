import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import MarkdownView from '../components/MarkdownView'
import { Skeleton } from '../components/Skeleton'
import { exportMarkdown, exportPDF, buildBlockMarkdown } from '../utils/exportUtils'
import { useAI } from '../context/AIContext'

function mdToHtml(md) {
  return md
    .replace(/^### (.+)$/gm,  '<h3>$1</h3>')
    .replace(/^## (.+)$/gm,   '<h2>$1</h2>')
    .replace(/^# (.+)$/gm,    '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,     '<em>$1</em>')
    .replace(/`(.+?)`/g,       '<code>$1</code>')
    .replace(/^- (.+)$/gm,     '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/s,'<ul>$1</ul>')
    .replace(/\n\n/g,          '</p><p>')
    || `<p>${md}</p>`
}

// ── Conectividad ──────────────────────────────────────
function BlockConnectivity({ blockId, project, onNavigate }) {
  const { connectors = [], idMap = {}, blocks = [], ports = [] } = project

  // Los extremos de los conectores son IDs de puertos
  // Obtener todos los puertos de este bloque
  const myPortIds = new Set(ports.filter(p => p.parentId === blockId).map(p => p.id))
  // Incluir también el propio blockId por si conector va directo al bloque
  myPortIds.add(blockId)

  const related = connectors.filter(c =>
    myPortIds.has(c.source) || myPortIds.has(c.target)
  )
  if (related.length === 0) return null

  // Resolver ID (puerto o bloque) -> bloque
  function resolveBlock(id) {
    if (id === blockId) return null  // es el propio
    const entry = idMap[id]
    if (!entry) return null
    if (entry.type === 'uml:Port') {
      const parent = idMap[entry.parentId]
      return (parent?.type === 'uml:Class' || parent?.type === 'uml:Component') &&
             parent.id !== blockId ? parent : null
    }
    return (entry.type === 'uml:Class' || entry.type === 'uml:Component') &&
           entry.id !== blockId ? entry : null
  }

  // Deduplicar: pares únicos de (bloque peer, dirección)
  const outPeers = new Map(), inPeers = new Map()
  for (const c of related) {
    const isSrc = myPortIds.has(c.source)
    const peerId = isSrc ? c.target : c.source
    const peer = resolveBlock(peerId)
    if (!peer) continue
    if (isSrc) outPeers.set(peer.id, peer)
    else       inPeers.set(peer.id, peer)
  }

  const rows = [
    { label:'→ Sale hacia',  peers: [...outPeers.values()], icon:'🟢' },
    { label:'← Entra desde', peers: [...inPeers.values()],  icon:'🟡' },
  ].filter(r => r.peers.length > 0)

  if (rows.length === 0) return null

  return (
    <div className="card" style={{marginBottom:'1rem'}}>
      <div className="card-title">🔗 Conectividad</div>
      {rows.map(({ label, peers, icon }) => (
        <div key={label} style={{marginTop:'0.6rem'}}>
          <div style={{fontSize:'0.72rem',fontWeight:700,color:'var(--color-text-muted)',
            textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:'0.4rem'}}>
            {icon} {label} ({peers.length})
          </div>
          <div style={{display:'flex',flexWrap:'wrap',gap:'0.35rem'}}>
            {peers.map(peer => (
              <button key={peer.id}
                onClick={() => onNavigate(`/summary/${peer.id}`)}
                style={{
                  padding:'0.3rem 0.65rem',borderRadius:'999px',fontSize:'0.76rem',
                  border:'1px solid var(--color-border)',
                  background:'var(--color-surface)',color:'var(--color-primary)',
                  cursor:'pointer',fontWeight:600,
                }}>
                {peer.name || peer.id.slice(0,16)}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function Summary() {
  const { blockId } = useParams()
  const navigate    = useNavigate()
  const { project } = useAI()

  const [block,          setBlock]          = useState(null)
  const [loadingBlock,   setLoadingBlock]   = useState(false)
  const [summary,        setSummary]        = useState(null)
  const [loadingSummary, setLoadingSummary] = useState(false)
  const [prompts,        setPrompts]        = useState(null)
  const [loadingPrompt,  setLoadingPrompt]  = useState(false)
  const [imageData,      setImageData]      = useState(null)
  const [loadingImage,   setLoadingImage]   = useState(false)
  const [aiError,        setAiError]        = useState(null)

  useEffect(() => {
    if (!blockId) return
    setSummary(null); setPrompts(null); setImageData(null); setAiError(null)
    setLoadingBlock(true)
    fetch(`/api/blocks/${blockId}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => setBlock(data))
      .catch(() => {
        const found = (project.blocks || []).find(b => b.id === blockId) || null
        setBlock(found)
      })
      .finally(() => setLoadingBlock(false))
  }, [blockId, project])

  async function generateSummary() {
    setLoadingSummary(true); setAiError(null)
    try {
      const res = await fetch(`/api/blocks/${blockId}/summary`)
      if (!res.ok) throw new Error(await res.text())
      setSummary(await res.json())
    } catch { setAiError('No se pudo generar el resumen IA.') }
    finally  { setLoadingSummary(false) }
  }
  async function generatePrompt() {
    setLoadingPrompt(true); setAiError(null)
    try {
      const res = await fetch(`/api/blocks/${blockId}/image-prompt`)
      if (!res.ok) throw new Error(await res.text())
      setPrompts([(await res.json()).prompt])
    } catch { setAiError('No se pudo generar el prompt visual.') }
    finally  { setLoadingPrompt(false) }
  }
  async function generateImage() {
    setLoadingImage(true); setAiError(null); setImageData(null)
    try {
      const res = await fetch(`/api/blocks/${blockId}/image`)
      if (!res.ok) { const e = await res.json().catch(() => ({detail:res.statusText})); throw new Error(e.detail) }
      setImageData(await res.json())
    } catch (e) { setAiError(`No se pudo generar la imagen: ${e.message}`) }
    finally    { setLoadingImage(false) }
  }

  const ports      = (project.ports  || []).filter(p => p.parentId === blockId)
  const idMap      = project.idMap   || {}
  const parentName = idMap[block?.parentId || block?.parent_id]?.name
  const canExport  = !!(block?.documentation || summary)

  function handleExportMD()  { const md = buildBlockMarkdown({ block, summary, ports, parentName }); exportMarkdown(`${block.name}-arcana`, md) }
  function handleExportPDF() { const md = buildBlockMarkdown({ block, summary, ports, parentName }); exportPDF(block.name, mdToHtml(md)) }

  if (!blockId) return (
    <div className="empty-state"><span style={{fontSize:'3rem'}}>📋</span>
      <p>Selecciona un bloque desde el <strong>Explorador</strong>.</p></div>
  )
  if (loadingBlock) return (
    <div style={{maxWidth:'820px',display:'flex',flexDirection:'column',gap:'0.75rem'}}>
      <Skeleton width="40%" height="1.6rem" /><Skeleton width="25%" height="1rem" />
    </div>
  )
  if (!block) return (
    <div className="empty-state"><span style={{fontSize:'3rem'}}>🔍</span>
      <p>Bloque no encontrado.
        <button className="btn btn-ghost" onClick={() => navigate('/explorer')}>Volver al explorador</button>
      </p></div>
  )

  return (
    <div style={{maxWidth:'820px'}}>
      <div style={{display:'flex',alignItems:'flex-start',gap:'0.75rem',marginBottom:'1.5rem'}}>
        <span style={{fontSize:'2rem',flexShrink:0}}>🧡</span>
        <div style={{flex:1}}>
          <h2 style={{fontSize:'1.4rem',fontWeight:700}}>{block.name}</h2>
          <div style={{display:'flex',gap:'0.5rem',marginTop:'0.25rem',flexWrap:'wrap'}}>
            {parentName   && <span className="tag">📦 {parentName}</span>}
            {ports.length > 0 && <span className="tag">🔌 {ports.length} puertos</span>}
            {block.stereotype && <span className="tag">{block.stereotype}</span>}
          </div>
        </div>
        <div style={{display:'flex',gap:'0.5rem',flexShrink:0}}>
          {canExport && (
            <>
              <button className="btn btn-ghost" style={{fontSize:'0.78rem'}} onClick={handleExportMD}>💾 .md</button>
              <button className="btn btn-ghost" style={{fontSize:'0.78rem'}} onClick={handleExportPDF}>🖨 PDF</button>
            </>
          )}
          <button className="btn btn-ghost" style={{fontSize:'0.8rem'}} onClick={() => navigate('/explorer')}>← Explorador</button>
        </div>
      </div>

      {block.documentation && (
        <div className="card" style={{marginBottom:'1rem'}}>
          <div className="card-title">📔 Documentación</div>
          <p style={{fontSize:'0.875rem',lineHeight:1.7}}>{block.documentation}</p>
        </div>
      )}

      {ports.length > 0 && (
        <div className="card" style={{marginBottom:'1rem'}}>
          <div className="card-title">🔌 Puertos ({ports.length})</div>
          <div style={{display:'flex',flexWrap:'wrap',gap:'0.4rem',marginTop:'0.5rem'}}>
            {ports.map(p => <span key={p.id} className="tag" style={{fontFamily:'monospace',fontSize:'0.78rem'}}>{p.name}</span>)}
          </div>
        </div>
      )}

      <BlockConnectivity blockId={blockId} project={project} onNavigate={navigate} />

      <div style={{display:'flex',gap:'0.75rem',marginBottom:'1rem',flexWrap:'wrap'}}>
        <button className="btn btn-primary" onClick={generateSummary} disabled={loadingSummary}>
          {loadingSummary ? '⏳ Generando…' : '🤖 Resumen IA'}</button>
        <button className="btn btn-ghost" onClick={generatePrompt} disabled={loadingPrompt}>
          {loadingPrompt ? '⏳ Generando…' : '🎨 Prompt visual'}</button>
        <button className="btn btn-ghost" onClick={generateImage} disabled={loadingImage}
          style={{borderColor:'var(--color-primary)',color:'var(--color-primary)'}}>
          {loadingImage ? '⏳ Generando imagen…' : '🖼️ Generar imagen'}</button>
      </div>

      {aiError && (
        <div style={{marginBottom:'1rem',padding:'0.75rem 1rem',background:'#fffbea',
          border:'1px solid #f0c040',borderRadius:'0.5rem',fontSize:'0.83rem',color:'#7a5800'}}>
          ⚠️ {aiError}
        </div>
      )}
      {loadingImage && (
        <div className="card" style={{marginBottom:'1.25rem',textAlign:'center',padding:'2rem'}}>
          <div style={{fontSize:'2rem',marginBottom:'0.5rem'}}>🎨</div>
          <p style={{color:'var(--color-text-muted)',fontSize:'0.875rem'}}>Generando imagen… (10-20 s)</p>
        </div>
      )}
      {imageData && (
        <div className="card" style={{marginBottom:'1.25rem'}}>
          <div className="card-title" style={{marginBottom:'0.75rem'}}>🖼️ Imagen — {imageData.block_name}</div>
          <img src={imageData.image_url} alt={`Diagrama de ${imageData.block_name}`}
            style={{width:'100%',borderRadius:'0.5rem',marginBottom:'0.75rem'}} loading="lazy" />
          <details style={{fontSize:'0.78rem',color:'var(--color-text-muted)'}}>
            <summary style={{cursor:'pointer',marginBottom:'0.4rem'}}>🔍 Prompt usado</summary>
            <p style={{lineHeight:1.6,padding:'0.5rem',background:'var(--color-surface-offset)',borderRadius:'0.375rem'}}>{imageData.prompt_used}</p>
          </details>
          <div style={{display:'flex',gap:'0.5rem',marginTop:'0.75rem'}}>
            <a href={imageData.image_url} target="_blank" rel="noopener noreferrer"
              className="btn btn-ghost" style={{fontSize:'0.78rem'}}>🔗 Abrir</a>
            <button className="btn btn-ghost" style={{fontSize:'0.78rem'}}
              onClick={() => navigator.clipboard.writeText(imageData.image_url)}>📋 Copiar URL</button>
          </div>
        </div>
      )}
      {loadingSummary && (
        <div className="card" style={{marginBottom:'1.25rem',display:'flex',flexDirection:'column',gap:'0.5rem'}}>
          {[100,90,80,70,55].map((w,i) => <Skeleton key={i} width={`${w}%`} height="0.85rem" />)}
        </div>
      )}
      {summary && (
        <div className="card" style={{marginBottom:'1.25rem',background:'var(--color-primary-highlight)'}}>
          <div className="card-title">🤖 Resumen IA</div>
          <MarkdownView>{summary.summary}</MarkdownView>
        </div>
      )}
      {prompts && prompts.map((p, i) => (
        <div key={i} className="card" style={{marginBottom:'0.75rem'}}>
          <div className="card-title">🎨 Prompt visual</div>
          <p style={{fontSize:'0.85rem',lineHeight:1.7,marginBottom:'0.75rem'}}>{p}</p>
          <button className="btn btn-ghost" style={{fontSize:'0.78rem'}}
            onClick={() => navigator.clipboard.writeText(p)}>📋 Copiar</button>
        </div>
      ))}
    </div>
  )
}

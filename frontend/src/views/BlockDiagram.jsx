import React, { useState, useRef, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAI } from '../context/AIContext'

const BOX_W   = 160
const BOX_H   = 52
const PAD     = 48
const COLS    = 4
const COL_GAP = 210
const ROW_GAP = 110

const PKG_COLORS = [
  '#01a0a8','#0ea5e9','#8b5cf6','#ec4899','#f59e0b',
  '#10b981','#f97316','#6366f1','#14b8a6','#e11d48',
]

export default function BlockDiagram() {
  const { project } = useAI()
  const navigate    = useNavigate()
  const svgRef      = useRef(null)
  const dragging    = useRef(false)
  const lastPos     = useRef({ x: 0, y: 0 })

  const { packages = [], blocks = [], connectors = [], ports = [], idMap = {} } = project || {}

  // Paquetes que realmente tienen bloques con nombre
  const namedPackages = useMemo(() =>
    packages
      .filter(p => p.name)
      .filter(p => blocks.some(b => (b.parentId === p.id || b.parent_id === p.id) && b.name))
      .sort((a, b) => {
        // Ordenar por número de bloques desc
        const ca = blocks.filter(b => b.parentId === a.id && b.name).length
        const cb = blocks.filter(b => b.parentId === b.id && b.name).length
        return cb - ca
      })
  , [packages, blocks])

  const [selectedPkg, setSelectedPkg] = useState('')
  // Inicializar con el primer paquete con bloques cuando cargue el proyecto
  const resolvedPkg = selectedPkg || namedPackages[0]?.id || ''

  const [pan,  setPan]  = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)

  const pkgBlocks = useMemo(() =>
    blocks
      .filter(b => (b.parentId === resolvedPkg || b.parent_id === resolvedPkg) && b.name)
  , [blocks, resolvedPkg])

  // Posiciones en grid
  const positions = useMemo(() => {
    const map = {}
    pkgBlocks.forEach((b, i) => {
      map[b.id] = {
        x: PAD + (i % COLS) * COL_GAP,
        y: PAD + Math.floor(i / COLS) * ROW_GAP,
      }
    })
    return map
  }, [pkgBlocks])

  // Resolver puerto -> bloque padre
  function resolveBlock(portOrBlockId) {
    const entry = idMap[portOrBlockId]
    if (!entry) return null
    if (entry.type === 'uml:Port') {
      // subir al bloque contenedor
      const parent = idMap[entry.parentId]
      return parent?.type === 'uml:Class' || parent?.type === 'uml:Component'
        ? parent.id : null
    }
    return entry.type === 'uml:Class' || entry.type === 'uml:Component'
      ? entry.id : null
  }

  // Conectores entre bloques de este paquete
  const visibleConnectors = useMemo(() => {
    const pkgIds = new Set(pkgBlocks.map(b => b.id))
    const seen   = new Set()
    const result = []
    for (const c of connectors) {
      const srcBlk = resolveBlock(c.source)
      const tgtBlk = resolveBlock(c.target)
      if (!srcBlk || !tgtBlk) continue
      if (!pkgIds.has(srcBlk) || !pkgIds.has(tgtBlk)) continue
      if (srcBlk === tgtBlk) continue
      const key = [srcBlk, tgtBlk].sort().join('|')
      if (seen.has(key)) continue   // deduplicar paralelos
      seen.add(key)
      result.push({ ...c, srcBlk, tgtBlk })
    }
    return result
  }, [connectors, pkgBlocks, idMap])

  const pkgColorMap = useMemo(() => {
    const map = {}
    packages.forEach((p, i) => { map[p.id] = PKG_COLORS[i % PKG_COLORS.length] })
    return map
  }, [packages])

  const svgW = Math.max(PAD * 2 + COLS * COL_GAP, 600)
  const svgH = Math.max(PAD * 2 + Math.ceil(pkgBlocks.length / COLS) * ROW_GAP + BOX_H, 320)

  const onMouseDown = useCallback(e => {
    if (e.button !== 0) return
    dragging.current = true
    lastPos.current  = { x: e.clientX, y: e.clientY }
  }, [])
  const onMouseMove = useCallback(e => {
    if (!dragging.current) return
    setPan(p => ({ x: p.x + e.clientX - lastPos.current.x, y: p.y + e.clientY - lastPos.current.y }))
    lastPos.current = { x: e.clientX, y: e.clientY }
  }, [])
  const onMouseUp   = useCallback(() => { dragging.current = false }, [])
  const onWheel     = useCallback(e => {
    e.preventDefault()
    setZoom(z => Math.min(3, Math.max(0.25, z - e.deltaY * 0.001)))
  }, [])

  function portPoint(blockId, isSource) {
    const pos = positions[blockId]
    if (!pos) return null
    return { x: pos.x + (isSource ? BOX_W : 0), y: pos.y + BOX_H / 2 }
  }

  function bezier(sx, sy, ex, ey) {
    const cx = (sx + ex) / 2
    return `M${sx},${sy} C${cx},${sy} ${cx},${ey} ${ex},${ey}`
  }

  if (!packages.length && !blocks.length) return (
    <div className="empty-state">
      <span style={{fontSize:'3rem'}}>📦</span>
      <p>Carga un proyecto primero.</p>
    </div>
  )

  if (namedPackages.length === 0) return (
    <div className="empty-state">
      <span style={{fontSize:'3rem'}}>📦</span>
      <p>No se encontraron paquetes con bloques en el proyecto.</p>
    </div>
  )

  return (
    <div style={{display:'flex',flexDirection:'column',gap:'1rem',height:'100%'}}>
      {/* Controles */}
      <div style={{display:'flex',alignItems:'center',gap:'0.75rem',flexWrap:'wrap'}}>
        <h2 style={{fontSize:'1.25rem',fontWeight:700,flex:1}}>🗢️ Diagrama de bloques</h2>
        <select
          value={resolvedPkg}
          onChange={e => { setSelectedPkg(e.target.value); setPan({x:0,y:0}); setZoom(1) }}
          style={{padding:'0.5rem 0.75rem',border:'1px solid var(--color-border)',
            borderRadius:'0.5rem',fontSize:'0.85rem',
            background:'var(--color-surface)',color:'var(--color-text)',maxWidth:'280px'}}>
          {namedPackages.map(p => (
            <option key={p.id} value={p.id}>
              {p.name} ({blocks.filter(b => b.parentId === p.id && b.name).length})
            </option>
          ))}
        </select>
        <button className="btn btn-ghost" style={{fontSize:'0.8rem'}}
          onClick={() => { setPan({x:0,y:0}); setZoom(1) }}>🔍 Reset</button>
        <span style={{fontSize:'0.75rem',color:'var(--color-text-muted)'}}>
          {pkgBlocks.length} bloques · {visibleConnectors.length} conexiones
        </span>
      </div>

      {/* Canvas */}
      <div style={{
        border:'1px solid var(--color-border)',borderRadius:'0.75rem',
        overflow:'hidden',background:'var(--color-surface)',
        userSelect:'none',flex:1,minHeight:'460px',
        cursor: dragging.current ? 'grabbing' : 'grab',
      }}
        onMouseDown={onMouseDown} onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}    onMouseLeave={onMouseUp}
        onWheel={onWheel}>

        <svg ref={svgRef} width="100%" height="100%"
          viewBox={`0 0 ${svgW} ${svgH}`} style={{display:'block'}}>
          <defs>
            <marker id="arrow" markerWidth="8" markerHeight="8"
              refX="7" refY="3" orient="auto">
              <path d="M0,0 L0,6 L8,3 z" fill="#94a3b8" />
            </marker>
          </defs>

          <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
            {/* Conectores */}
            {visibleConnectors.map((c, i) => {
              const src = portPoint(c.srcBlk, true)
              const tgt = portPoint(c.tgtBlk, false)
              if (!src || !tgt) return null
              const mx = (src.x + tgt.x) / 2
              const my = (src.y + tgt.y) / 2
              return (
                <g key={c.id || i}>
                  <path d={bezier(src.x, src.y, tgt.x, tgt.y)}
                    fill="none" stroke="#94a3b8" strokeWidth="1.5"
                    markerEnd="url(#arrow)" opacity="0.65" />
                  {c.name && (
                    <text x={mx} y={my - 6} textAnchor="middle"
                      fontSize="9" fill="#94a3b8">{c.name}</text>
                  )}
                </g>
              )
            })}

            {/* Bloques */}
            {pkgBlocks.map(b => {
              const pos    = positions[b.id]
              if (!pos) return null
              const color  = pkgColorMap[b.parentId] || '#01a0a8'
              const bports = ports.filter(p => p.parentId === b.id)
              const label  = b.name.length > 19 ? b.name.slice(0,18) + '…' : b.name
              return (
                <g key={b.id} style={{cursor:'pointer'}}
                  onClick={() => navigate(`/summary/${b.id}`)}>
                  <rect x={pos.x+3} y={pos.y+3} width={BOX_W} height={BOX_H}
                    rx="7" fill="rgba(0,0,0,0.07)" />
                  <rect x={pos.x} y={pos.y} width={BOX_W} height={BOX_H}
                    rx="7" fill="var(--color-bg)" stroke={color} strokeWidth="2" />
                  <rect x={pos.x} y={pos.y} width={BOX_W} height="7"
                    rx="7" fill={color} />
                  <rect x={pos.x} y={pos.y+4} width={BOX_W} height="5" fill={color} />
                  <text x={pos.x + BOX_W/2} y={pos.y + 32}
                    textAnchor="middle" dominantBaseline="middle"
                    fontSize="11" fontWeight="600" fill="var(--color-text)"
                    style={{pointerEvents:'none'}}>
                    {label}
                  </text>
                  {bports.length > 0 && (
                    <text x={pos.x + BOX_W - 7} y={pos.y + BOX_H - 7}
                      textAnchor="end" fontSize="9" fill={color} opacity="0.85"
                      style={{pointerEvents:'none'}}>
                      🔌{bports.length}
                    </text>
                  )}
                </g>
              )
            })}
          </g>
        </svg>
      </div>

      <p style={{fontSize:'0.75rem',color:'var(--color-text-muted)',margin:0}}>
        💡 Arrastra para mover · Rueda para zoom · Clic en un bloque para ver su ficha
      </p>
    </div>
  )
}

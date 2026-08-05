import React, { useState, useRef, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAI } from '../context/AIContext'

const BOX_W   = 160
const BOX_H   = 52
const PAD     = 40
const COLS    = 4
const COL_GAP = 200
const ROW_GAP = 100

// Colores por paquete
const PKG_COLORS = [
  '#01a0a8','#0ea5e9','#8b5cf6','#ec4899','#f59e0b',
  '#10b981','#f97316','#6366f1','#14b8a6','#e11d48',
]

export default function BlockDiagram() {
  const { project } = useAI()
  const navigate = useNavigate()
  const svgRef   = useRef(null)

  const { packages = [], blocks = [], connectors = [], idMap = {} } = project || {}

  const namedPackages = packages.filter(p => p.name)
  const [selectedPkg, setSelectedPkg] = useState(() => namedPackages[0]?.id || '')

  // Pan & zoom
  const [pan,  setPan]  = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const dragging = useRef(false)
  const lastPos  = useRef({ x: 0, y: 0 })

  const pkgBlocks = useMemo(() =>
    blocks.filter(b => b.parentId === selectedPkg || b.parent_id === selectedPkg)
      .filter(b => b.name)
  , [blocks, selectedPkg])

  // Asignar posición en grid
  const positions = useMemo(() => {
    const map = {}
    pkgBlocks.forEach((b, i) => {
      const col = i % COLS
      const row = Math.floor(i / COLS)
      map[b.id] = {
        x: PAD + col * COL_GAP,
        y: PAD + row * ROW_GAP,
      }
    })
    return map
  }, [pkgBlocks])

  // Conectores que tienen los dos extremos en este paquete
  const visibleConnectors = useMemo(() => {
    const ids = new Set(pkgBlocks.map(b => b.id))
    return connectors.filter(c => ids.has(c.source) && ids.has(c.target))
  }, [connectors, pkgBlocks])

  // Colores por paquete padre
  const pkgColorMap = useMemo(() => {
    const map = {}
    packages.forEach((p, i) => { map[p.id] = PKG_COLORS[i % PKG_COLORS.length] })
    return map
  }, [packages])

  // SVG viewport
  const svgW = Math.max(PAD * 2 + COLS * COL_GAP, 600)
  const svgH = Math.max(PAD * 2 + Math.ceil(pkgBlocks.length / COLS) * ROW_GAP + BOX_H, 300)

  // Eventos pan
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
    setZoom(z => Math.min(3, Math.max(0.3, z - e.deltaY * 0.001)))
  }, [])

  // Calcular punto de salida/entrada de una caja
  function portPoint(id, isSource) {
    const pos = positions[id]
    if (!pos) return null
    return {
      x: pos.x + (isSource ? BOX_W : 0),
      y: pos.y + BOX_H / 2,
    }
  }

  // Curva bezier entre dos puntos
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

  const activePkg = packages.find(p => p.id === selectedPkg)

  return (
    <div style={{display:'flex',flexDirection:'column',gap:'1rem',height:'100%'}}>
      {/* Controles */}
      <div style={{display:'flex',alignItems:'center',gap:'0.75rem',flexWrap:'wrap'}}>
        <h2 style={{fontSize:'1.25rem',fontWeight:700,flex:1}}>🗢️ Diagrama de bloques</h2>
        <select value={selectedPkg} onChange={e => { setSelectedPkg(e.target.value); setPan({x:0,y:0}); setZoom(1) }}
          style={{padding:'0.5rem 0.75rem',border:'1px solid var(--color-border)',
            borderRadius:'0.5rem',fontSize:'0.85rem',
            background:'var(--color-surface)',color:'var(--color-text)',maxWidth:'260px'}}>
          {namedPackages.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <button className="btn btn-ghost" style={{fontSize:'0.8rem'}}
          onClick={() => { setPan({x:0,y:0}); setZoom(1) }}>🔍 Reset</button>
        <span style={{fontSize:'0.75rem',color:'var(--color-text-muted)'}}>
          {pkgBlocks.length} bloques · {visibleConnectors.length} conexiones
        </span>
      </div>

      {pkgBlocks.length === 0 && (
        <div className="empty-state" style={{padding:'3rem'}}>
          <span style={{fontSize:'2.5rem'}}>📦</span>
          <p>Este paquete no tiene bloques con nombre.</p>
        </div>
      )}

      {pkgBlocks.length > 0 && (
        <div style={{
          border:'1px solid var(--color-border)',borderRadius:'0.75rem',
          overflow:'hidden',background:'var(--color-surface)',
          cursor: dragging.current?'grabbing':'grab',
          userSelect:'none',flex:1,minHeight:'420px',
        }}
          onMouseDown={onMouseDown} onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}   onMouseLeave={onMouseUp}
          onWheel={onWheel}>
          <svg
            ref={svgRef}
            width="100%" height="100%"
            viewBox={`0 0 ${svgW} ${svgH}`}
            style={{display:'block'}}>

            <defs>
              <marker id="arrow" markerWidth="8" markerHeight="8"
                refX="6" refY="3" orient="auto">
                <path d="M0,0 L0,6 L8,3 z" fill="var(--color-text-muted)" />
              </marker>
            </defs>

            <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>

              {/* Conectores */}
              {visibleConnectors.map((c, i) => {
                const src = portPoint(c.source, true)
                const tgt = portPoint(c.target, false)
                if (!src || !tgt) return null
                return (
                  <g key={c.id || i}>
                    <path d={bezier(src.x, src.y, tgt.x, tgt.y)}
                      fill="none" stroke="var(--color-border)" strokeWidth="1.5"
                      markerEnd="url(#arrow)" opacity="0.7" />
                    {c.name && (
                      <text x={(src.x+tgt.x)/2} y={(src.y+tgt.y)/2 - 5}
                        textAnchor="middle" fontSize="9"
                        fill="var(--color-text-muted)">{c.name}</text>
                    )}
                  </g>
                )
              })}

              {/* Bloques */}
              {pkgBlocks.map(b => {
                const pos   = positions[b.id]
                if (!pos) return null
                const color = pkgColorMap[b.parentId] || '#01a0a8'
                const bports = (project.ports || []).filter(p => p.parentId === b.id)
                return (
                  <g key={b.id} style={{cursor:'pointer'}}
                    onClick={() => navigate(`/summary/${b.id}`)}>
                    {/* Sombra */}
                    <rect x={pos.x+3} y={pos.y+3} width={BOX_W} height={BOX_H}
                      rx="7" fill="rgba(0,0,0,0.08)" />
                    {/* Caja */}
                    <rect x={pos.x} y={pos.y} width={BOX_W} height={BOX_H}
                      rx="7" fill="var(--color-surface)"
                      stroke={color} strokeWidth="1.8" />
                    {/* Barra color superior */}
                    <rect x={pos.x} y={pos.y} width={BOX_W} height="6"
                      rx="7" fill={color} />
                    <rect x={pos.x} y={pos.y+4} width={BOX_W} height="6"
                      fill={color} />
                    {/* Nombre */}
                    <text x={pos.x + BOX_W/2} y={pos.y + 28}
                      textAnchor="middle" dominantBaseline="middle"
                      fontSize="11" fontWeight="600"
                      fill="var(--color-text)"
                      style={{pointerEvents:'none'}}>
                      {b.name.length > 18 ? b.name.slice(0,17)+'…' : b.name}
                    </text>
                    {/* Contador puertos */}
                    {bports.length > 0 && (
                      <text x={pos.x + BOX_W - 8} y={pos.y + BOX_H - 8}
                        textAnchor="end" fontSize="8"
                        fill={color} opacity="0.9"
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
      )}

      <p style={{fontSize:'0.75rem',color:'var(--color-text-muted)',margin:0}}>
        💡 Arrastra para mover · Rueda para zoom · Clic en un bloque para ver su ficha
      </p>
    </div>
  )
}
